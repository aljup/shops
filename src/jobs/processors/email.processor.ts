import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { markOutbox, retryBackoff } from '../job-ledger';

interface EmailPayload {
  template: string;
  to: string;
  orderId?: string;
  amount?: number;
  outboxId?: string;
}

const SUBJECTS: Record<string, string> = {
  order_created: 'تم استلام طلبك',
  order_paid: 'تم تأكيد الدفع',
};

@Processor('email', { settings: { backoffStrategy: retryBackoff } })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<EmailPayload>) {
    await markOutbox(this.prisma, job.data.outboxId, JobStatus.PROCESSING);
    try {
      const subject = SUBJECTS[job.data.template] ?? 'تحديث على طلبك';
      // No SMTP provider is configured for this deployment: messages are written to
      // the structured application log, where the mail pipeline picks them up.
      this.logger.log(
        {
          transport: 'log',
          template: job.data.template,
          to: job.data.to,
          subject,
          orderId: job.data.orderId,
          amount: job.data.amount,
        },
        'Outbound transaction email',
      );
      await markOutbox(this.prisma, job.data.outboxId, JobStatus.DONE);
      return { delivered: true, transport: 'log' };
    } catch (error) {
      await markOutbox(this.prisma, job.data.outboxId, JobStatus.FAILED, error);
      throw error;
    }
  }
}
