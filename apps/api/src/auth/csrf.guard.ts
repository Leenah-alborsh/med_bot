import {
  BadRequestException,
  CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthService, CSRF_COOKIE } from './auth.service.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies?.[CSRF_COOKIE] as string | undefined;
    const token = Array.isArray(header) ? header[0] : header;
    if (!request.admin || !token || token !== cookie)
      throw new BadRequestException('Invalid CSRF token');
    await this.auth.assertCsrf(request.admin.sessionId, token);
    return true;
  }
}
