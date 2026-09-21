import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentAdmin } from './current-admin.decorator.js';
import type { AuthenticatedAdmin } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  changePasswordSchema,
  loginSchema,
  setupPasswordSchema,
  type ChangePasswordInput,
  type LoginInput,
  type SetupPasswordInput,
} from './auth.schemas.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input, metadata(request));
    this.auth.setCookies(response, result.rawToken, result.csrfToken, result.expiresAt);
    return { admin: result.admin };
  }

  @Post('setup-password')
  async setupPassword(
    @Body(new ZodValidationPipe(setupPasswordSchema)) input: SetupPasswordInput,
    @Req() request: Request,
  ) {
    await this.auth.setupPassword(input, metadata(request));
    return { success: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return { admin };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  async logout(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(admin, metadata(request));
    this.auth.clearCookies(response);
    return { success: true };
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  async changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
    @Req() request: Request,
  ) {
    await this.auth.changePassword(admin, input, metadata(request));
    return { success: true };
  }
}
