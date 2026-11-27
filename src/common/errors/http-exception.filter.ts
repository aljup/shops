import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppException, ApiErrorDetail } from './app.exception';

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request?.requestId ?? randomUUID();

    if (!response.headersSent) {
      response.setHeader('x-request-id', requestId);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = STATUS_CODES[status];
    let message = 'Unexpected server error';
    let details: ApiErrorDetail[] = [];

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? 'HTTP_ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as { message?: string | string[]; error?: string; details?: ApiErrorDetail[] };
        if (Array.isArray(payload.message)) {
          message = 'Request validation failed';
          details = payload.message.map((item) => ({ message: item }));
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        } else if (typeof payload.error === 'string') {
          message = payload.error;
        }
        if (Array.isArray(payload.details)) {
          details = payload.details;
        }
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        message = 'Too many requests';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_RESOURCE';
        message = 'A resource with these unique values already exists';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Resource not found';
      }
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request?.url },
        'Unhandled error while serving request',
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
        requestId,
      },
    });
  }
}
