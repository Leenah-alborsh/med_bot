import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { PermissionGuard } from './permission.guard.js';
import { ScopeAuthorizationService } from './scope-authorization.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, CsrfGuard, PermissionGuard, ScopeAuthorizationService],
  exports: [AuthService, SessionAuthGuard, CsrfGuard, PermissionGuard, ScopeAuthorizationService],
})
export class AuthModule {}
