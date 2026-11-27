import { OrderStatus } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PAID];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw AppException.conflict(
      'INVALID_ORDER_TRANSITION',
      `An order cannot move from ${from} to ${to}`,
      [{ message: `Allowed targets from ${from}: ${ORDER_TRANSITIONS[from].join(', ') || 'none'}` }],
    );
  }
}

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}
