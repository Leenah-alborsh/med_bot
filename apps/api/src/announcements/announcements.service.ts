import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TelegramWebhookService } from '../telegram/telegram-webhook.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import type { AnnouncementInput, WelcomeInput } from './announcements.schemas.js';

@Injectable()
export class AnnouncementsService implements OnModuleInit {
  private readonly logger = new Logger(AnnouncementsService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramWebhookService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processNext(), 5000);
    this.timer.unref();
    void this.processNext();
  }

  async settings() {
    const bot = await this.mainBot();
    const years = await this.prisma.academicYear.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { displayOrder: 'asc' },
    });
    const recent = await this.prisma.announcement.findMany({
      where: { botId: bot.id },
      select: {
        id: true,
        message: true,
        targetYearIds: true,
        status: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return {
      welcomeMessage: bot.welcomeMessage ?? 'أهلًا بك في Medical Students Hub.',
      hasWelcomePhoto: Boolean(bot.welcomePhotoFileId),
      years,
      recent,
    };
  }

  async updateWelcome(
    input: WelcomeInput,
    photo: Express.Multer.File | undefined,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    const bot = await this.mainBot();
    const photoFileId = photo
      ? await this.telegram.storePhoto(photo)
      : input.removePhoto
        ? null
        : bot.welcomePhotoFileId;
    const updated = await this.prisma.bot.update({
      where: { id: bot.id },
      data: { welcomeMessage: input.message, welcomePhotoFileId: photoFileId },
      select: { welcomeMessage: true, welcomePhotoFileId: true },
    });
    await this.audit.record({
      actorId: actor.id,
      actionKey: 'bot.welcome.updated',
      entityType: 'Bot',
      entityId: bot.id,
      after: {
        welcomeMessage: updated.welcomeMessage,
        hasPhoto: Boolean(updated.welcomePhotoFileId),
      },
      metadata,
    });
    return {
      welcomeMessage: updated.welcomeMessage,
      hasWelcomePhoto: Boolean(updated.welcomePhotoFileId),
    };
  }

  async create(input: AnnouncementInput, actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    const bot = await this.mainBot();
    const uniqueYears = [...new Set(input.yearIds)];
    if (uniqueYears.length) {
      const count = await this.prisma.academicYear.count({
        where: { id: { in: uniqueYears }, isActive: true },
      });
      if (count !== uniqueYears.length)
        throw new BadRequestException('إحدى السنوات المحددة غير متاحة.');
    }
    const announcement = await this.prisma.announcement.create({
      data: {
        botId: bot.id,
        createdById: actor.id,
        message: input.message,
        targetYearIds: uniqueYears,
        photoFileId: input.useWelcomePhoto ? bot.welcomePhotoFileId : null,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      actionKey: 'announcement.queued',
      entityType: 'Announcement',
      entityId: announcement.id,
      after: { targetYearIds: uniqueYears, usePhoto: Boolean(announcement.photoFileId) },
      metadata,
    });
    void this.processNext();
    return { id: announcement.id, status: announcement.status };
  }

  private async processNext() {
    if (this.processing) return;
    this.processing = true;
    try {
      const next = await this.prisma.announcement.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!next) return;
      const claimed = await this.prisma.announcement.updateMany({
        where: { id: next.id, status: 'QUEUED' },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });
      if (!claimed.count) return;
      const students = await this.prisma.student.findMany({
        where: {
          isBlocked: false,
          ...(next.targetYearIds.length
            ? { selectedAcademicYearId: { in: next.targetYearIds } }
            : {}),
          memberships: { some: { botId: next.botId, isBlocked: false } },
        },
        select: { telegramUserId: true },
      });
      await this.prisma.announcement.update({
        where: { id: next.id },
        data: { recipientCount: students.length },
      });
      let sent = 0;
      let failed = 0;
      for (const student of students) {
        try {
          await this.telegram.sendAnnouncement(
            student.telegramUserId,
            next.message,
            next.photoFileId,
          );
          sent += 1;
        } catch {
          failed += 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      await this.prisma.announcement.update({
        where: { id: next.id },
        data: {
          status: 'COMPLETED',
          sentCount: sent,
          failedCount: failed,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Announcement processing failed');
      const processing = await this.prisma.announcement.findFirst({
        where: { status: 'PROCESSING' },
        orderBy: { startedAt: 'desc' },
      });
      if (processing)
        await this.prisma.announcement.update({
          where: { id: processing.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
            completedAt: new Date(),
          },
        });
    } finally {
      this.processing = false;
    }
  }

  private async mainBot() {
    const bot = await this.prisma.bot.findUnique({ where: { key: 'medical-main' } });
    if (!bot) throw new BadRequestException('البوت الرئيسي غير مهيأ.');
    return bot;
  }
}
