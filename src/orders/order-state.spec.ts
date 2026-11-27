import { OrderStatus } from '@prisma/client';
import {
  assertTransition,
  canTransition,
  CANCELLABLE_STATUSES,
  ORDER_TRANSITIONS,
} from './order-state';

describe('order state machine', () => {
  it('allows the happy path PENDING -> PAID -> SHIPPED -> DELIVERED', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('allows cancelling only before shipping', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
  });

  it('treats terminal states as final', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });

  it('rejects skipping PENDING -> SHIPPED with a 409 exception', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toThrow(
      expect.objectContaining({ code: 'INVALID_ORDER_TRANSITION', status: 409 }),
    );
  });

  it('reports cancellable statuses', () => {
    expect(CANCELLABLE_STATUSES).toEqual([OrderStatus.PENDING, OrderStatus.PAID]);
  });
});
