import { OrderStatus, Prisma } from '@prisma/client';
import { canTransition } from './order-state';

export interface CancelResult {
  cancelled: boolean;
  reason?: 'not_found' | 'already_cancelled' | 'not_cancellable';
}

export async function cancelOrderWithRestock(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: string,
): Promise<CancelResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return { cancelled: false, reason: 'not_found' };
  }
  if (order.status === OrderStatus.CANCELLED) {
    return { cancelled: false, reason: 'already_cancelled' };
  }
  if (!canTransition(order.status, OrderStatus.CANCELLED)) {
    return { cancelled: false, reason: 'not_cancellable' };
  }

  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity }, version: { increment: 1 } },
    });
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  return { cancelled: true };
}
