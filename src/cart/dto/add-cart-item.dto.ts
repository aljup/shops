import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ example: '0b5c1a4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}
