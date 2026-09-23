import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Module({
  controllers: [TelegramController],
  providers: [TelegramWebhookService],
  exports: [TelegramWebhookService],
})
export class TelegramModule {}
