import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';
import { ContentUploadController } from './content-upload.controller.js';
import { ContentService } from './content.service.js';
import { TelegramFileStorageService } from './telegram-file-storage.service.js';
import { UploadTicketService } from './upload-ticket.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, ContentUploadController],
  providers: [ContentService, TelegramFileStorageService, UploadTicketService],
})
export class ContentModule {}
