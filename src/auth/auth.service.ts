import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_ROUNDS = 12;
const ACCESS_TOKEN_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppException.conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name.trim(), role: Role.CUSTOMER },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const matches = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !matches) {
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw AppException.unauthorized('INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  async logout(userId: string, refreshToken: string): Promise<{ success: true }> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new AppException(
        'INVALID_REFRESH_TOKEN',
        'The refresh token is invalid or already revoked',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { success: true };
  }

  private hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.get<string>('JWT_REFRESH_SECRET') ?? '')
      .update(token)
      .digest('hex');
  }

  private async issueTokens(user: User): Promise<AuthTokensDto> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: accessTtl as unknown as number },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_SECONDS,
    };
  }
}
