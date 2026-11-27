import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cancelOrderWithRestock } from '../../orders/order-cancel';
import { retryBackoff } from '../job-ledger';

@Processor('maintenance', { settings: { backoffStrategy: retryBackoff } })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ outboxId?: string }>) {
    switch (job.name) {
      case 'idempotency.cleanup':
        return this.cleanupIdempotencyKeys();
      case 'order.sweep-expired':
        return this.sweepExpiredOrders();
      default:
        this.logger.warn({ name: job.name }, 'Unknown maintenance job');
        return { skipped: true };
    }
  }

  private async cleanupIdempotencyKeys() {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log({ removed: result.count }, 'Expired idempotency keys removed');
    }
    return { removed: result.count };
  }

  private async sweepExpiredOrders() {
    const minutes = Number(this.config.get('ORDER_RESERVATION_MINUTES') ?? 30);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });

    let cancelled = 0;
    for (const order of stale) {
      const result = await this.prisma.$transaction((tx) =>
        cancelOrderWithRestock(tx, order.id, 'reservation_expired'),
      );
      if (result.cancelled) {
        cancelled += 1;
      }
    }
    if (cancelled > 0) {
      this.logger.log({ cancelled }, 'Swept expired pending orders');
    }
    return { scanned: stale.length, cancelled };
  }
}
