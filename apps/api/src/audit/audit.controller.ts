import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { ActionHistoryService } from './action-history.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
@Controller('audit')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly history: ActionHistoryService,
  ) {}
  @Get()
  @RequirePermissions('audit.read')
  list(@Query(new ZodValidationPipe(querySchema)) query: { page: number; pageSize: number }) {
    return this.audit.list(query.page, query.pageSize);
  }
  @Get('actions')
  actions(@CurrentAdmin() actor: AuthenticatedAdmin) {
    return this.history.status(actor.id);
  }

  @Post('actions/undo')
  @UseGuards(CsrfGuard)
  undo(@CurrentAdmin() actor: AuthenticatedAdmin, @Req() request: Request) {
    return this.history.undo(actor, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('actions/redo')
  @UseGuards(CsrfGuard)
  redo(@CurrentAdmin() actor: AuthenticatedAdmin, @Req() request: Request) {
    return this.history.redo(actor, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
