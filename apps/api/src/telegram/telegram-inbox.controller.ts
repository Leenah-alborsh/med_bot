import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  classifyTelegramInboxSchema,
  listTelegramInboxSchema,
  type ClassifyTelegramInboxInput,
  type ListTelegramInboxInput,
} from './telegram-inbox.schemas.js';
import { TelegramInboxService } from './telegram-inbox.service.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('telegram-inbox')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class TelegramInboxController {
  constructor(private readonly inbox: TelegramInboxService) {}

  @Get()
  @RequirePermissions('content.read')
  list(@Query(new ZodValidationPipe(listTelegramInboxSchema)) query: ListTelegramInboxInput) {
    return this.inbox.list(query);
  }

  @Post(':id/classify')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.create')
  classify(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(classifyTelegramInboxSchema)) input: ClassifyTelegramInboxInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.inbox.classify(id, input, actor, metadata(request));
  }
}
