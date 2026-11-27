import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { EmailProcessor } from './processors/email.processor';
import { MaintenanceProcessor } from './processors/maintenance.processor';
import { OrderExpiryProcessor } from './processors/order-expiry.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'order-expiry' },
      { name: 'maintenance' },
    ),
  ],
  providers: [JobsService, EmailProcessor, OrderExpiryProcessor, MaintenanceProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule implements OnModuleInit {
  constructor(private readonly jobsService: JobsService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_JOB_SCHEDULER === 'true') {
      return;
    }
    await this.jobsService.scheduleRecurringJobs();
  }
}
