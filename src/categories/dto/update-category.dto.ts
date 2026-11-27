import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'أجهزة إلكترونية' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'devices' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;
}
