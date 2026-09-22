import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, InputFile } from 'grammy';
import { createReadStream } from 'node:fs';
import type { Environment } from '../config/environment.js';

export type StoredTelegramFile = {
  storageChatId: bigint;
  storageMessageId: number;
  telegramFileId: string;
  telegramFileUniqueId: string;
};

@Injectable()
export class TelegramFileStorageService {
  private readonly logger = new Logger(TelegramFileStorageService.name);
  private readonly api: Api | null;
  private readonly channelId: string | null;

  constructor(config: ConfigService<Environment, true>) {
    const token = config.get('MEDICAL_BOT_TOKEN', { infer: true });
    this.channelId = config.get('TELEGRAM_FILE_CHANNEL_ID', { infer: true }) ?? null;
    this.api = token ? new Api(token) : null;
  }

  async verifyConfiguration() {
    const { api, channelId } = this.configuration();
    const [chat, me] = await Promise.all([api.getChat(channelId), api.getMe()]);
    if (chat.type !== 'channel')
      throw new BadRequestException('معرّف التخزين لا يعود إلى قناة Telegram.');
    const member = await api.getChatMember(channelId, me.id);
    if (member.status !== 'administrator' || member.can_post_messages === false)
      throw new BadRequestException(
        'يجب إضافة البوت كمسؤول في قناة التخزين مع صلاحية نشر الرسائل.',
      );
    return { ok: true, title: chat.title };
  }

  async store(path: string, filename: string, mimeType: string): Promise<StoredTelegramFile> {
    const { api, channelId } = this.configuration();
    try {
      const message = await api.sendDocument(
        channelId,
        new InputFile(createReadStream(path), filename),
        { caption: filename },
      );
      if (!message.document) throw new Error('Telegram response did not include a document');
      return {
        storageChatId: BigInt(message.chat.id),
        storageMessageId: message.message_id,
        telegramFileId: message.document.file_id,
        telegramFileUniqueId: message.document.file_unique_id,
      };
    } catch (error) {
      this.logger.error('Telegram file storage upload failed');
      throw new ServiceUnavailableException(
        `تعذر رفع الملف إلى مستودع Telegram. تحقق من إعداد القناة وحجم الملف ونوعه.${mimeType ? '' : ''}`,
        { cause: error },
      );
    }
  }

  async compensate(file: StoredTelegramFile) {
    if (!this.api) return;
    await this.api
      .deleteMessage(file.storageChatId.toString(), file.storageMessageId)
      .catch(() => this.logger.warn('Could not remove an orphaned Telegram storage message'));
  }

  private configuration() {
    if (!this.api || !this.channelId)
      throw new ServiceUnavailableException(
        'مستودع الملفات غير مهيأ. أضف TELEGRAM_FILE_CHANNEL_ID وتأكد من رمز البوت.',
      );
    return { api: this.api, channelId: this.channelId };
  }
}
