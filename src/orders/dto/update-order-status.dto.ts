import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED] })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ example: 'تم الإلغاء بناءً على طلب العميل', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
