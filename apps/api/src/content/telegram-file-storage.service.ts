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
  private readonly token: string | undefined;
  private readonly apiRoot: string;

  constructor(config: ConfigService<Environment, true>) {
    const token = config.get('MEDICAL_BOT_TOKEN', { infer: true });
    this.token = token;
    this.apiRoot = config.get('TELEGRAM_API_ROOT', { infer: true }) ?? 'https://api.telegram.org';
    this.channelId = config.get('TELEGRAM_FILE_CHANNEL_ID', { infer: true }) ?? null;
    this.api = token
      ? new Api(token, {
          apiRoot: config.get('TELEGRAM_API_ROOT', { infer: true }),
          timeoutSeconds: config.get('TELEGRAM_UPLOAD_TIMEOUT_SECONDS', { infer: true }) ?? 3600,
        })
      : null;
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

  async open(fileId: string) {
    if (!this.api || !this.token) throw new ServiceUnavailableException('مستودع الملفات غير مهيأ.');
    try {
      const file = await this.api.getFile(fileId);
      if (
        !file.file_path ||
        file.file_path.startsWith('/') ||
        file.file_path.split('/').includes('..')
      ) {
        throw new Error('Unsupported file path');
      }
      // The bot token stays on the server; never return Telegram download URLs to clients.
      const root = this.apiRoot.replace(/\/$/, '');
      const path = file.file_path.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${root}/file/bot${this.token}/${path}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok || !response.body) throw new Error('File download failed');
      return response.body;
    } catch {
      throw new ServiceUnavailableException(
        'تعذر فتح الملف من تليجرام. قد يتجاوز حد تنزيل Bot API أو يحتاج إعداد خدمة الملفات المحلية.',
      );
    }
  }

  async compensate(file: StoredTelegramFile) {
    if (!this.api) return;
    await this.api
      .deleteMessage(file.storageChatId.toString(), file.storageMessageId)
      .catch(() => this.logger.warn('Could not remove an orphaned Telegram storage message'));
  }

  async remove(storageChatId: bigint, storageMessageId: number) {
    if (!this.api) return;
    await this.api
      .deleteMessage(storageChatId.toString(), storageMessageId)
      .catch(() =>
        this.logger.warn('Could not remove a deleted content file from Telegram storage'),
      );
  }
  private configuration() {
    if (!this.api || !this.channelId)
      throw new ServiceUnavailableException(
        'مستودع الملفات غير مهيأ. أضف TELEGRAM_FILE_CHANNEL_ID وتأكد من رمز البوت.',
      );
    return { api: this.api, channelId: this.channelId };
  }
}
