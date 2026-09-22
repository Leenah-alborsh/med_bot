import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
@Controller('audit')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get()
  @RequirePermissions('audit.read')
  list(@Query(new ZodValidationPipe(querySchema)) query: { page: number; pageSize: number }) {
    return this.audit.list(query.page, query.pageSize);
  }
}
