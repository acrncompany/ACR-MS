import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Single place that turns any thrown value into a consistent JSON error response. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: request.id },
        'Unhandled exception while processing request',
      );
    }

    response.status(body.statusCode).json({
      ...body,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof AppError) {
      return { statusCode: exception.httpStatus, code: exception.code, message: exception.message };
    }
    if (exception instanceof ZodError) {
      return {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    }
    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        code: 'HTTP_ERROR',
        message: exception.message,
      };
    }
    // Never leak internals for unknown errors.
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
