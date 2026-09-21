import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const secretHeaderNames = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-csrf-token',
]);

export function redactHeaders(headers: Request['headers']) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      secretHeaderNames.has(key.toLowerCase()) ? '[redacted]' : value,
    ]),
  );
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on('finish', () => {
      this.logger.log({
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        headers: redactHeaders(request.headers),
      });
    });

    next();
  }
}
