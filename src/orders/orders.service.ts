import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AppException } from '../common/errors/app.exception';
import { buildPage, cursorFilter, decodeCursor } from '../common/pagination/cursor';
import { PrismaService } from '../common/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateOrderDto, PaymentMethodInput } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { cancelOrderWithRestock } from './order-cancel';
import { toOrderDto } from './order.mapper';
import { assertTransition } from './order-state';

const IDEMPOTENCY_TTL_DAYS = 7;
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{8,128}$/;

export interface OrderResult {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async create(
    userId: string,
    userEmail: string,
    idempotencyKey: string | undefined,
    dto: CreateOrderDto,
  ): Promise<OrderResult> {
    const key = idempotencyKey?.trim();
    if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new AppException(
        'IDEMPOTENCY_KEY_REQUIRED',
        'An Idempotency-Key header of 8-128 printable characters is required',
        400,
      );
    }

    const items = this.mergeItems(dto.items);
    const requestHash = this.hashRequest(items, dto.paymentMethod);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (existing) {
      return this.replay(existing, requestHash);
    }

    try {
      const order = await this.prisma.$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: items.map((item) => item.productId) } },
          });
          const byId = new Map(products.map((product) => [product.id, product]));

          const missing = items.filter((item) => !byId.get(item.productId)?.isActive);
          if (missing.length > 0) {
            throw new AppException(
              'PRODUCT_NOT_FOUND',
              'One or more products are missing or inactive',
              404,
              missing.map((item) => ({ field: item.productId, message: 'Product not available' })),
            );
          }

          const snapshots: {
            productId: string;
            productName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
          }[] = [];

          for (const item of items) {
            const product = byId.get(item.productId)!;
            const updated = await tx.product.updateMany({
              where: { id: product.id, isActive: true, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity }, version: { increment: 1 } },
            });
            if (updated.count === 0) {
              const fresh = await tx.product.findUnique({ where: { id: product.id } });
              throw new AppException(
                'INSUFFICIENT_STOCK',
                'Not enough stock for one or more products',
                409,
                [
                  {
                    field: product.id,
                    message: `Only ${fresh?.stock ?? 0} of "${product.name}" available`,
                  },
                ],
              );
            }
            snapshots.push({
              productId: product.id,
              productName: product.name,
              unitPrice: product.price,
              quantity: item.quantity,
              lineTotal: product.price * item.quantity,
            });
          }

          const subtotal = snapshots.reduce((sum, item) => sum + item.lineTotal, 0);
          const currency = byId.get(items[0].productId)?.currency ?? 'SAR';

          const created = await tx.order.create({
            data: {
              userId,
              status: OrderStatus.PENDING,
              paymentMethod: this.toPaymentMethod(dto.paymentMethod),
              paymentStatus: 'pending',
              subtotal,
              total: subtotal,
              currency,
              items: { create: snapshots },
            },
            include: { items: true },
          });

          const body = toOrderDto(created);
          await tx.idempotencyKey.create({
            data: {
              userId,
              key,
              requestHash,
              status: 201,
              response: JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue,
              expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000),
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
      );

      await this.afterOrderCreated(order.id, order.total, userEmail);
      return { statusCode: 201, body: toOrderDto(order) };
    } catch (error) {
      if (this.isIdempotencyClash(error)) {
        const stored = await this.prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId, key } },
        });
        if (stored) {
          return this.replay(stored, requestHash);
        }
      }
      throw error;
    }
  }

  async list(userId: string, query: ListOrdersQueryDto) {
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) {
      where.status = query.status;
    }
    const and: Prisma.OrderWhereInput[] = [];
    if (query.cursor) {
      and.push(cursorFilter(decodeCursor(query.cursor)));
      where.AND = and;
    }

    const rows = await this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const { items, pageInfo } = buildPage(rows, limit);
    return { data: items.map(toOrderDto), pageInfo };
  }

  async findOne(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) {
      throw AppException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }
    return toOrderDto(order);
  }

  async cancel(userId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) {
      throw AppException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }

    const result = await this.prisma.$transaction((tx) =>
      cancelOrderWithRestock(tx, orderId, reason),
    );
    if (!result.cancelled) {
      const code =
        result.reason === 'already_cancelled' ? 'ORDER_ALREADY_CANCELLED' : 'ORDER_NOT_CANCELLABLE';
      throw AppException.conflict(
        code,
        result.reason === 'already_cancelled'
          ? 'The order is already cancelled'
          : 'The order cannot be cancelled in its current state',
      );
    }

    return this.findOne(userId, orderId);
  }

  async adminUpdateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw AppException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }
    assertTransition(order.status, dto.status);

    if (dto.status === OrderStatus.CANCELLED) {
      const reason = dto.reason?.trim() || 'cancelled_by_admin';
      const result = await this.prisma.$transaction((tx) =>
        cancelOrderWithRestock(tx, orderId, reason),
      );
      if (!result.cancelled) {
        throw AppException.conflict(
          'INVALID_ORDER_TRANSITION',
          'The order cannot be cancelled in its current state',
        );
      }
      const updated = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      return toOrderDto(updated);
    }

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        paymentStatus: dto.status === OrderStatus.PAID ? 'paid' : undefined,
        paidAt: dto.status === OrderStatus.PAID ? now : undefined,
        shippedAt: dto.status === OrderStatus.SHIPPED ? now : undefined,
        deliveredAt: dto.status === OrderStatus.DELIVERED ? now : undefined,
      },
      include: { items: true },
    });

    if (dto.status === OrderStatus.PAID) {
      await this.afterOrderPaid(updated.id);
    }
    return toOrderDto(updated);
  }

  private replay(
    record: { requestHash: string; status: number | null; response: Prisma.JsonValue | null },
    requestHash: string,
  ): OrderResult {
    if (record.requestHash !== requestHash) {
      throw AppException.conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used with a different request body',
      );
    }
    if (record.status === null || record.response === null) {
      throw AppException.conflict(
        'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        'A request with this Idempotency-Key is still being processed',
      );
    }
    return { statusCode: 200, body: record.response };
  }

  private async afterOrderCreated(orderId: string, amount: number, email: string): Promise<void> {
    try {
      await this.jobs.enqueueEmail('order_created', email, { orderId, amount });
      await this.jobs.enqueueOrderExpiry(orderId);
    } catch (error) {
      this.logger.warn({ err: error, orderId }, 'Failed to enqueue post-order background jobs');
    }
  }

  private async afterOrderPaid(orderId: string): Promise<void> {
    try {
      await this.jobs.dispatch({
        type: 'email.send',
        queue: 'email',
        jobId: `email:order-paid:${orderId}`,
        payload: { template: 'order_paid', orderId },
      });
    } catch (error) {
      this.logger.warn({ err: error, orderId }, 'Failed to enqueue order paid email');
    }
  }

  private mergeItems(items: { productId: string; quantity: number }[]) {
    const merged = new Map<string, number>();
    for (const item of items) {
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    }
    return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }

  private hashRequest(
    items: { productId: string; quantity: number }[],
    paymentMethod: PaymentMethodInput,
  ): string {
    const canonical = JSON.stringify({
      items: [...items].sort((a, b) => a.productId.localeCompare(b.productId)),
      paymentMethod,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private toPaymentMethod(method: PaymentMethodInput) {
    return method === 'cod' ? ('COD' as const) : ('MANUAL' as const);
  }

  private isIdempotencyClash(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta?.target as string[]).includes('key')
    );
  }
}
