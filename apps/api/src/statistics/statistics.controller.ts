import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BotUsersService } from './bot-users.service.js';
import { botUsersQuerySchema, type BotUsersQuery } from './bot-users.schemas.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { StatisticsService } from './statistics.service.js';

@Controller('statistics')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class StatisticsController {
  constructor(
    private readonly statistics: StatisticsService,
    private readonly botUsers: BotUsersService,
  ) {}

  @Get('bot-users')
  users(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Query(new ZodValidationPipe(botUsersQuerySchema)) query: BotUsersQuery,
  ) {
    return this.botUsers.list(actor, query);
  }

  @Get('bot-users/:id')
  user(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(botUsersQuerySchema)) query: BotUsersQuery,
  ) {
    return this.botUsers.detail(actor, id, query);
  }

  @Get('students')
  @RequirePermissions('students.stats.read')
  students() {
    return this.statistics.students();
  }
}
