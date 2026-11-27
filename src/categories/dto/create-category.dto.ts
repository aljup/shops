import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiPropertyOptional({ example: 'إلكترونيات', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'electronics', description: 'Generated from the name when omitted' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;
}
