import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cancelOrderWithRestock } from '../../orders/order-cancel';
import { markOutbox, retryBackoff } from '../job-ledger';

interface OrderExpiryPayload {
  orderId: string;
  outboxId?: string;
}

@Processor('order-expiry', { settings: { backoffStrategy: retryBackoff } })
export class OrderExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderExpiryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<OrderExpiryPayload>) {
    await markOutbox(this.prisma, job.data.outboxId, JobStatus.PROCESSING);
    try {
      const result = await this.prisma.$transaction((tx) =>
        cancelOrderWithRestock(tx, job.data.orderId, 'reservation_expired'),
      );
      await markOutbox(this.prisma, job.data.outboxId, JobStatus.DONE);
      if (result.cancelled) {
        this.logger.log({ orderId: job.data.orderId }, 'Expired order cancelled and restocked');
      }
      return result;
    } catch (error) {
      await markOutbox(this.prisma, job.data.outboxId, JobStatus.FAILED, error);
      throw error;
    }
  }
}
