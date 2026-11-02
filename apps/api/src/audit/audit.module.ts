import { ContributionsService } from './contributions.service.js';
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { ActionHistoryService } from './action-history.service.js';

@Global()
@Module({
  providers: [AuditService, ActionHistoryService, ContributionsService],
  exports: [AuditService, ActionHistoryService, ContributionsService],
})
export class AuditModule {}
