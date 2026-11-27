import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { DispatchOptions } from './jobs.types';

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('order-expiry') private readonly expiryQueue: Queue,
    @InjectQueue('maintenance') private readonly maintenanceQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dispatch(options: DispatchOptions): Promise<string> {
    const delay = options.delayMs ?? 0;
    const ledger = await this.prisma.outboxJob.create({
      data: {
        type: options.type,
        payload: options.payload as Prisma.InputJsonValue,
        runAt: new Date(Date.now() + delay),
      },
    });

    const queue = this.queueFor(options.queue);
    await queue.add(
      options.type,
      { ...options.payload, outboxId: ledger.id },
      { ...DEFAULT_JOB_OPTIONS, delay, jobId: options.jobId },
    );

    return ledger.id;
  }

  enqueueOrderExpiry(orderId: string): Promise<string> {
    const minutes = Number(this.config.get('ORDER_RESERVATION_MINUTES') ?? 30);
    return this.dispatch({
      type: 'order.cancel-expired',
      queue: 'order-expiry',
      jobId: `order-expiry:${orderId}`,
      payload: { orderId },
      delayMs: minutes * 60 * 1000,
    });
  }

  enqueueEmail(
    template: string,
    to: string,
    data: Record<string, unknown> & { orderId?: string },
  ): Promise<string> {
    return this.dispatch({
      type: 'email.send',
      queue: 'email',
      jobId: data.orderId ? `email:${template}:${data.orderId}` : undefined,
      payload: { template, to, ...data },
    });
  }

  async scheduleRecurringJobs(): Promise<void> {
    await this.maintenanceQueue.upsertJobScheduler(
      'idempotency-cleanup',
      { every: 15 * 60 * 1000 },
      { name: 'idempotency.cleanup', data: {} },
    );
    await this.maintenanceQueue.upsertJobScheduler(
      'expired-order-sweeper',
      { every: 60 * 1000 },
      { name: 'order.sweep-expired', data: {} },
    );
    this.logger.log('Recurring maintenance jobs scheduled');
  }

  private queueFor(name: DispatchOptions['queue']): Queue {
    switch (name) {
      case 'email':
        return this.emailQueue;
      case 'order-expiry':
        return this.expiryQueue;
      case 'maintenance':
        return this.maintenanceQueue;
      default:
        throw new Error(`Unknown queue: ${String(name)}`);
    }
  }
}
