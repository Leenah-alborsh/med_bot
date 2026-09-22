import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: unknown,
  ) {
    if (!this.telegram.isSecretValid(secret)) throw new UnauthorizedException();
    return { ok: true, duplicate: await this.telegram.handleUpdate(update) };
  }
}
