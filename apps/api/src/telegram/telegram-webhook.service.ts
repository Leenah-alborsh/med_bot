import { timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@medical/database';
import { createMedicalBot } from '@medical/bot-worker';
import { InputFile } from 'grammy';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class TelegramWebhookService implements OnModuleInit {
  private readonly logger = new Logger(TelegramWebhookService.name);
  private bot?: ReturnType<typeof createMedicalBot>;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.config.get('TELEGRAM_WEBHOOK_ENABLED', { infer: true })) return;
    const token = this.config.get('MEDICAL_BOT_TOKEN', { infer: true });
    const secret = this.config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
    const explicitUrl = this.config.get('TELEGRAM_WEBHOOK_URL', { infer: true });
    const renderUrl = this.config.get('RENDER_EXTERNAL_URL', { infer: true });
    if (!token || !secret || (!explicitUrl && !renderUrl))
      throw new Error('Telegram webhook configuration is incomplete');

    this.bot = createMedicalBot({
      token,
      prisma: this.prisma,
      uploadDirectory: this.config.get('UPLOAD_DIRECTORY', { infer: true }),
      allowLocalFiles: false,
    });
    await this.bot.init();
    const url = explicitUrl ?? `${renderUrl}/api/v1/telegram/webhook`;
    await this.bot.api.setWebhook(url, {
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    await this.prisma.bot.update({
      where: { key: 'medical-main' },
      data: { telegramUsername: this.bot.botInfo.username, status: 'ACTIVE' },
    });
    this.logger.log('Telegram webhook registered');
  }

  async storePhoto(file: Express.Multer.File) {
    if (!this.bot) throw new ServiceUnavailableException('Telegram webhook is disabled');
    const channelId = this.config.get('TELEGRAM_FILE_CHANNEL_ID', { infer: true });
    if (!channelId)
      throw new ServiceUnavailableException('Telegram file channel is not configured');
    const message = await this.bot.api.sendPhoto(
      channelId,
      new InputFile(file.buffer, file.originalname),
      { caption: 'صورة ترحيب البوت' },
    );
    const photo = message.photo?.at(-1);
    if (!photo) throw new ServiceUnavailableException('Telegram did not return a photo reference');
    return photo.file_id;
  }

  async sendAnnouncement(chatId: bigint, message: string, photoFileId?: string | null) {
    if (!this.bot) throw new ServiceUnavailableException('Telegram webhook is disabled');
    if (photoFileId) {
      await this.bot.api.sendPhoto(chatId.toString(), photoFileId, { caption: message });
    } else {
      await this.bot.api.sendMessage(chatId.toString(), message);
    }
  }

  isSecretValid(candidate?: string) {
    const expected = this.config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
    if (!candidate || !expected) return false;
    const left = Buffer.from(candidate);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  async handleUpdate(update: unknown) {
    if (!this.bot) throw new ServiceUnavailableException('Telegram webhook is disabled');
    const updateId = this.readUpdateId(update);
    try {
      await this.prisma.telegramWebhookUpdate.create({ data: { updateId: BigInt(updateId) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return true;
      throw error;
    }

    try {
      await this.bot.handleUpdate(update as Parameters<typeof this.bot.handleUpdate>[0]);
      await this.prisma.telegramWebhookUpdate.update({
        where: { updateId: BigInt(updateId) },
        data: { processedAt: new Date() },
      });
      return false;
    } catch (error) {
      await this.prisma.telegramWebhookUpdate
        .delete({ where: { updateId: BigInt(updateId) } })
        .catch(() => undefined);
      throw error;
    }
  }

  private readUpdateId(update: unknown) {
    if (!update || typeof update !== 'object' || !('update_id' in update))
      throw new UnauthorizedException('Invalid Telegram update');
    const updateId = (update as { update_id?: unknown }).update_id;
    if (typeof updateId !== 'number' || !Number.isSafeInteger(updateId) || updateId < 0)
      throw new UnauthorizedException('Invalid Telegram update');
    return updateId;
  }
}
