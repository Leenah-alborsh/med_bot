import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';
import { ContentUploadController } from './content-upload.controller.js';
import { ContentService } from './content.service.js';
import { TelegramFileStorageService } from './telegram-file-storage.service.js';
import { UploadTicketGuard } from './upload-ticket.guard.js';
import { UploadTicketService } from './upload-ticket.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { UnifiedContentController } from './unified-content.controller.js';
import { UnifiedContentService } from './unified-content.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, ContentUploadController, UnifiedContentController],
  providers: [
    ContentService,
    TelegramFileStorageService,
    UploadTicketService,
    UploadTicketGuard,
    UnifiedContentService,
  ],
})
export class ContentModule {}
