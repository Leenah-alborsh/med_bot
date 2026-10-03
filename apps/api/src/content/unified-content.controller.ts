import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { listContentSchema, type ListContentInput } from './content.schemas.js';
import { UnifiedContentService } from './unified-content.service.js';

@Controller('unified-content')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class UnifiedContentController {
  constructor(private readonly content: UnifiedContentService) {}

  @Get()
  @RequirePermissions('content.read')
  list(
    @Query(new ZodValidationPipe(listContentSchema)) query: ListContentInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.content.list(query, actor);
  }
}
