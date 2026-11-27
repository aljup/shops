import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [JobsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
