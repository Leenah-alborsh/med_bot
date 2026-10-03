import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TelegramInboxController } from './telegram-inbox.controller.js';
import { TelegramInboxService } from './telegram-inbox.service.js';
import { TelegramController } from './telegram.controller.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TelegramController, TelegramInboxController],
  providers: [TelegramWebhookService, TelegramInboxService],
  exports: [TelegramWebhookService],
})
export class TelegramModule {}
