import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthService, SESSION_COOKIE } from './auth.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.admin = await this.auth.authenticate(
      request.cookies?.[SESSION_COOKIE] as string | undefined,
    );
    return true;
  }
}
