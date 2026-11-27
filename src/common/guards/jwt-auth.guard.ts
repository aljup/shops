import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../errors/app.exception';
import type { AccessTokenPayload, AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppException.unauthorized('UNAUTHENTICATED', 'A bearer access token is required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw AppException.unauthorized('UNAUTHENTICATED', 'A bearer access token is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw AppException.unauthorized('INVALID_TOKEN', 'The access token is invalid or has expired');
    }

    if (!payload?.sub || !payload?.role) {
      throw AppException.unauthorized('INVALID_TOKEN', 'The access token is invalid or has expired');
    }

    request.user = { id: payload.sub, email: payload.email, role: payload.role };
    return true;
  }
}
