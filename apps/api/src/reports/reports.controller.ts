import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { reportListSchema, reportUpdateSchema, usageSchema } from './reports.schemas.js';
import { ReportsService } from './reports.service.js';

@Controller()
@UseGuards(SessionAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('broken-file-reports')
  @RequirePermissions('broken-file-reports.read')
  list(
    @Query(new ZodValidationPipe(reportListSchema))
    query: {
      status?: 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
      page: number;
      pageSize: number;
    },
  ) {
    return this.reports.list(query.status, query.page, query.pageSize);
  }
  @Patch('broken-file-reports/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('broken-file-reports.manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reportUpdateSchema))
    input: { status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED'; resolutionNote?: string },
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.reports.update(id, input, actor, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
  @Get('content-usage')
  @RequirePermissions('content.usage-analytics.read')
  usage(@Query(new ZodValidationPipe(usageSchema)) query: { from?: Date; to?: Date }) {
    return this.reports.usage(query.from, query.to);
  }
}
