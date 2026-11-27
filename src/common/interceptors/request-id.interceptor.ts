import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string; id?: string }>();
    const response = http.getResponse<Response>();

    const incoming = request.header('x-request-id');
    const requestId =
      (typeof request.id === 'string' && request.id) ||
      (incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID());

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
