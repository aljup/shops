import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] }) role!: string;
}

export class AuthTokensDto {
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}
