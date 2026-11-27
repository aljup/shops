import { CreateOrderDto } from '../orders/dto/create-order.dto';

export type QueueName = 'email' | 'order-expiry' | 'maintenance';

export interface DispatchOptions {
  type: string;
  queue: QueueName;
  payload: Record<string, unknown>;
  jobId?: string;
  delayMs?: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  amount: number;
}

export type { CreateOrderDto };
