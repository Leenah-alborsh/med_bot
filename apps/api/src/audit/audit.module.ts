import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { ActionHistoryService } from './action-history.service.js';

@Global()
@Module({
  providers: [AuditService, ActionHistoryService],
  exports: [AuditService, ActionHistoryService],
})
export class AuditModule {}
