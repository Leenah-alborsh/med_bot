import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolveUploadEnvironment } from '../config/environment.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const fileTooLarge =
      exception instanceof Error && 'code' in exception && exception.code === 'LIMIT_FILE_SIZE';
    const status = fileTooLarge
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const uploadTooLarge = fileTooLarge || status === 413;
    const message = uploadTooLarge
      ? `حجم الملف يتجاوز الحد المسموح للرفع من الداشبورد (${resolveUploadEnvironment(process.env).MAX_UPLOAD_BYTES / 1_000_000} ميجابايت).`
      : exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    response.status(status).json({
      error: {
        statusCode: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
