import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message, status);
  }

  static notFound(code: string, message: string): AppException {
    return new AppException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: string, message: string, details: ApiErrorDetail[] = []): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  static unauthorized(code: string, message: string): AppException {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(code: string, message: string): AppException {
    return new AppException(code, message, HttpStatus.FORBIDDEN);
  }
}
