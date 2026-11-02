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
import { ContributionsService } from './contributions.service.js';
import { AuditService } from './audit.service.js';
const contributionsQuery = z.object({
  month: z
    .string()
    .regex(/^(20\d{2})-(0[1-9]|1[0-2])$/)
    .default(() =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Hebron',
        year: 'numeric',
        month: '2-digit',
      })
        .format(new Date())
        .slice(0, 7),
    ),
  adminId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
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
    private readonly contributions: ContributionsService,
  ) {}
  @Get()
  @RequirePermissions('audit.read')
  list(@Query(new ZodValidationPipe(querySchema)) query: { page: number; pageSize: number }) {
    return this.audit.list(query.page, query.pageSize);
  }
  @Get('contributions')
  @RequirePermissions('audit.read')
  contributionsReport(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Query(new ZodValidationPipe(contributionsQuery)) query: z.infer<typeof contributionsQuery>,
  ) {
    return this.contributions.report(actor, query.month, query.adminId, query.page);
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
