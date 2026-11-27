import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

const cartItemInclude = {
  product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
} satisfies Prisma.CartItemInclude;

type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: 'asc' },
    });
    return this.toCartResponse(items);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isActive: true },
    });
    if (!product) {
      throw AppException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
    });
    const quantity = (existing?.quantity ?? 0) + dto.quantity;
    this.assertStock(product.stock, quantity);

    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await this.prisma.cartItem.create({
        data: { userId, productId: dto.productId, quantity: dto.quantity },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      include: { product: true },
    });
    if (!item) {
      throw AppException.notFound('CART_ITEM_NOT_FOUND', 'Cart item not found');
    }
    if (!item.product.isActive) {
      throw AppException.conflict('PRODUCT_INACTIVE', 'This product is no longer available');
    }
    this.assertStock(item.product.stock, quantity);

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
    if (result.count === 0) {
      throw AppException.notFound('CART_ITEM_NOT_FOUND', 'Cart item not found');
    }
    return this.getCart(userId);
  }

  private assertStock(available: number, requested: number): void {
    if (requested > available) {
      throw AppException.conflict('INSUFFICIENT_STOCK', 'Not enough stock for this product', [
        { message: `Requested ${requested} but only ${available} available` },
      ]);
    }
  }

  private toCartResponse(items: CartItemWithProduct[]) {
    const data = items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      lineTotal: item.product.price * item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        currency: item.product.currency,
        stock: item.product.stock,
        image: item.product.images[0]?.url ?? null,
      },
    }));

    return {
      data,
      summary: {
        itemCount: data.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: data.reduce((sum, item) => sum + item.lineTotal, 0),
        currency: data[0]?.product.currency ?? null,
      },
    };
  }
}
