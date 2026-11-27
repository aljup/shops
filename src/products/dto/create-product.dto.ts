import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProductImageDto {
  @ApiProperty({ example: 'https://cdn.example.com/headphones.jpg', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: 'سماعات لاسلكية' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'سماعات لاسلكية', minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'wireless-headphones' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ example: 'سماعات بعزل ضوضاء وبطارية 30 ساعة', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ example: 49900, description: 'Price in minor units (halalas)' })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 25, minimum: 0 })
  @IsInt()
  @Min(0)
  stock!: number;

  @ApiProperty({ example: '0b5c1a4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'SAR', maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}
