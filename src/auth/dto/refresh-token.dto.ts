import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token returned by register/login/refresh' })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  refreshToken!: string;
}
