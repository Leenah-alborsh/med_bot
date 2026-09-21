import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { StatisticsService } from './statistics.service.js';

@Controller('statistics')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('students')
  @RequirePermissions('students.stats.read')
  students() {
    return this.statistics.students();
  }
}
