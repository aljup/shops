import { Order, OrderItem, PaymentMethod } from '@prisma/client';

type OrderWithItems = Order & { items: OrderItem[] };

export function paymentMethodToApi(method: PaymentMethod): 'cod' | 'manual' {
  return method === PaymentMethod.COD ? 'cod' : 'manual';
}

export function toOrderDto(order: OrderWithItems) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: paymentMethodToApi(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    total: order.total,
    currency: order.currency,
    cancelReason: order.cancelReason,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export type OrderDto = ReturnType<typeof toOrderDto>;
