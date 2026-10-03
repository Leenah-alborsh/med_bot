import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

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
    const message = fileTooLarge
      ? 'هذا الملف كبير للرفع المباشر. ارفعه إلى قناة التخزين ثم صنّفه من صفحة الملفات الواردة.'
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
