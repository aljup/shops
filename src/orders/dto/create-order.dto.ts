import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_METHODS = ['cod', 'manual'] as const;
export type PaymentMethodInput = (typeof PAYMENT_METHODS)[number];

export class OrderItemInputDto {
  @ApiProperty({ example: '0b5c1a4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemInputDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'cod' })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethodInput;
}
