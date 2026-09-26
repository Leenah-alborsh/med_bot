import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@medical/database';
import { Bot, InlineKeyboard, InputFile, type Context } from 'grammy';
import {
  BACK_TEXT,
  HOME_TEXT,
  STAGES,
  navigationKeyboard,
  nextLevelAfterCourse,
  previousLevel,
  resolveVisibleOption,
  stageKeyboard,
  visibleOptions,
  type MenuOption,
  type NavigationLevel,
} from './navigation.js';

type Options = {
  token: string;
  prisma: PrismaClient;
  uploadDirectory: string;
  apiRoot?: string;
  allowLocalFiles?: boolean;
};
type Membership = Awaited<ReturnType<PrismaClient['studentBotMembership']['upsert']>>;
type Identity = {
  student: Awaited<ReturnType<PrismaClient['student']['upsert']>>;
  membership: Membership;
};

const reportCallback = (id: string) => `report:${id}`;
export const externalUrlKeyboard = (url: string) => new InlineKeyboard().url('فتح الرابط', url);
export const brokenReportKeyboard = (id: string) =>
  new InlineKeyboard().text('الإبلاغ عن ملف تالف', reportCallback(id));
export const publishedContentWhere = (sectionId: string) => ({
  sectionId,
  state: 'PUBLISHED' as const,
  isActive: true,
  archivedAt: null,
});
export const brokenReportSince = (now = Date.now()) => new Date(now - 86_400_000);
export function parseCallbackData(data: string) {
  const match = /^report:([0-9a-f-]{1,36})$/.exec(data);
  return match ? { action: 'report' as const, id: match[1]! } : null;
}

const promptFor = (level: NavigationLevel, hasOptions: boolean) => {
  if (!hasOptions) return 'لا توجد خيارات متاحة حالياً.';
  return {
    STAGE: 'اختر المرحلة:',
    YEAR: 'اختر السنة الدراسية:',
    SEMESTER: 'اختر الفصل الدراسي:',
    COURSE: 'اختر المادة:',
    SECTION: 'اختر القسم:',
    CONTENT_CATEGORY: 'اختر نوع المحتوى:',
    CONTENT: 'اختر المحتوى:',
  }[level];
};

export function createMedicalBot({ token, prisma, apiRoot, allowLocalFiles = true }: Options) {
  const bot = new Bot(token, apiRoot ? { client: { apiRoot } } : undefined);

  const identify = async (ctx: Context): Promise<Identity> => {
    if (!ctx.from) throw new Error('Telegram user context is missing');
    const student = await prisma.student.upsert({
      where: { telegramUserId: BigInt(ctx.from.id) },
      update: {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        lastSeenAt: new Date(),
      },
      create: {
        telegramUserId: BigInt(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
    });
    const configuredBot = await prisma.bot.findUniqueOrThrow({ where: { key: 'medical-main' } });
    const membership = await prisma.studentBotMembership.upsert({
      where: { studentId_botId: { studentId: student.id, botId: configuredBot.id } },
      update: { lastInteraction: new Date() },
      create: { studentId: student.id, botId: configuredBot.id },
    });
    return { student, membership };
  };

  const reset = (membershipId: string) =>
    prisma.studentBotMembership.update({
      where: { id: membershipId },
      data: {
        navigationLevel: 'STAGE',
        navigationStage: null,
        navigationYearId: null,
        navigationSemesterId: null,
        navigationCourseId: null,
        navigationSectionId: null,
        navigationContentType: null,
        navigationContentCategoryId: null,
      },
    });

  const optionsFor = async (membership: Membership): Promise<MenuOption[]> => {
    switch (membership.navigationLevel as NavigationLevel) {
      case 'STAGE':
        return STAGES.map(({ id, label }) => ({ id: String(id), label }));
      case 'YEAR': {
        if (!membership.navigationStage) return [];
        const rows = await prisma.academicYear.findMany({
          where: {
            number: { gte: membership.navigationStage, lte: membership.navigationStage + 2 },
            isActive: true,
            archivedAt: null,
            botVisibility: { some: { bot: { key: 'medical-main', status: 'ACTIVE' } } },
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.nameAr })));
      }
      case 'SEMESTER': {
        if (!membership.navigationYearId) return [];
        const rows = await prisma.semester.findMany({
          where: {
            academicYearId: membership.navigationYearId,
            isActive: true,
            archivedAt: null,
            academicYear: {
              isActive: true,
              archivedAt: null,
              botVisibility: { some: { bot: { key: 'medical-main', status: 'ACTIVE' } } },
            },
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.nameAr })));
      }
      case 'COURSE': {
        if (!membership.navigationSemesterId) return [];
        const rows = await prisma.course.findMany({
          where: {
            semesterId: membership.navigationSemesterId,
            isActive: true,
            archivedAt: null,
            semester: { isActive: true, archivedAt: null },
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.nameAr })));
      }
      case 'SECTION': {
        if (!membership.navigationCourseId) return [];
        const rows = await prisma.section.findMany({
          where: {
            courseId: membership.navigationCourseId,
            isActive: true,
            archivedAt: null,
            course: { isActive: true, archivedAt: null, hasSections: true },
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.nameAr })));
      }
      case 'CONTENT_CATEGORY': {
        if (!membership.navigationCourseId) return [];
        const rows = await prisma.contentCategory.findMany({
          where: {
            section: {
              ...(membership.navigationSectionId
                ? { id: membership.navigationSectionId }
                : { courseId: membership.navigationCourseId }),
              isActive: true,
              archivedAt: null,
              course: { isActive: true, archivedAt: null },
            },
            isActive: true,
            archivedAt: null,
            contentItems: {
              some: {
                state: 'PUBLISHED',
                isActive: true,
                archivedAt: null,
              },
            },
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.nameAr })));
      }
      case 'CONTENT': {
        if (!membership.navigationSectionId || !membership.navigationContentCategoryId) return [];
        const rows = await prisma.contentItem.findMany({
          where: {
            ...publishedContentWhere(membership.navigationSectionId),
            contentCategoryId: membership.navigationContentCategoryId,
          },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return visibleOptions(rows.map((row) => ({ id: row.id, label: row.titleAr })));
      }
    }
  };

  const showMenu = async (ctx: Context, membership: Membership, prefix?: string) => {
    const level = membership.navigationLevel as NavigationLevel;
    const options = await optionsFor(membership);
    const keyboard = level === 'STAGE' ? stageKeyboard() : navigationKeyboard(options);
    const prompt = promptFor(level, options.length > 0);
    await ctx.reply(
      prefix
        ? `${prefix}
${prompt}`
        : prompt,
      { reply_markup: keyboard },
    );
  };

  const goHome = async (ctx: Context, membershipId: string) => {
    const membership = await reset(membershipId);
    await showMenu(ctx, membership);
  };

  const goBack = async (ctx: Context, membership: Membership) => {
    const level = membership.navigationLevel as NavigationLevel;
    if (level === 'STAGE' || level === 'YEAR') return goHome(ctx, membership.id);
    const course =
      (level === 'CONTENT_CATEGORY' || level === 'CONTENT') && membership.navigationCourseId
        ? await prisma.course.findUnique({
            where: { id: membership.navigationCourseId },
            select: { hasSections: true },
          })
        : null;
    const data: Record<string, unknown> = {
      navigationLevel: previousLevel(level, course?.hasSections ?? false),
    };
    if (level === 'SEMESTER') {
      data.navigationYearId = null;
      data.navigationSemesterId = null;
      data.navigationCourseId = null;
      data.navigationSectionId = null;
      data.navigationContentCategoryId = null;
    } else if (level === 'COURSE') {
      data.navigationSemesterId = null;
      data.navigationCourseId = null;
      data.navigationSectionId = null;
      data.navigationContentCategoryId = null;
    } else if (level === 'SECTION') {
      data.navigationSectionId = null;
      data.navigationContentCategoryId = null;
    } else if (level === 'CONTENT_CATEGORY') {
      if (!course?.hasSections) data.navigationCourseId = null;
      data.navigationSectionId = null;
      data.navigationContentCategoryId = null;
    } else {
      if (!course?.hasSections) data.navigationSectionId = null;
      data.navigationContentCategoryId = null;
    }
    const updated = await prisma.studentBotMembership.update({
      where: { id: membership.id },
      data,
    });
    await showMenu(ctx, updated);
  };

  bot.command('start', async (ctx) => {
    const { membership } = await identify(ctx);
    const fresh = await reset(membership.id);
    const settings = await prisma.bot.findUnique({
      where: { key: 'medical-main' },
      select: { welcomeMessage: true, welcomePhotoFileId: true },
    });
    const welcomeMessage = settings?.welcomeMessage?.trim() || 'أهلًا بك في Medical Students Hub.';
    if (settings?.welcomePhotoFileId) {
      await ctx.replyWithPhoto(settings.welcomePhotoFileId, {
        caption: `${welcomeMessage}\n\nاختر المرحلة:`,
        reply_markup: stageKeyboard(),
      });
      return;
    }
    await showMenu(ctx, fresh, welcomeMessage);
  });

  bot.command('menu', async (ctx) => {
    const { membership } = await identify(ctx);
    await goHome(ctx, membership.id);
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    const { student, membership } = await identify(ctx);
    if (text === HOME_TEXT) return goHome(ctx, membership.id);
    if (text === BACK_TEXT) return goBack(ctx, membership);

    const options = await optionsFor(membership);
    const selected = resolveVisibleOption(text, options);
    if (!selected) {
      return showMenu(ctx, membership, 'هذا الخيار غير متاح. اختر من القائمة الحالية.');
    }

    const level = membership.navigationLevel as NavigationLevel;
    if (level === 'STAGE') {
      const stage = Number(selected.id);
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: {
          navigationLevel: 'YEAR',
          navigationStage: stage,
          navigationYearId: null,
          navigationSemesterId: null,
          navigationCourseId: null,
          navigationSectionId: null,
          navigationContentType: null,
          navigationContentCategoryId: null,
        },
      });
      return showMenu(ctx, updated);
    }
    if (level === 'YEAR') {
      const year = await prisma.academicYear.findFirst({
        where: {
          id: selected.id,
          number: { gte: membership.navigationStage!, lte: membership.navigationStage! + 2 },
          isActive: true,
          archivedAt: null,
          botVisibility: { some: { bot: { key: 'medical-main', status: 'ACTIVE' } } },
        },
      });
      if (!year) return showMenu(ctx, membership, 'هذا الخيار لم يعد متاحاً.');
      await prisma.student.update({
        where: { id: student.id },
        data: { selectedAcademicYearId: year.id },
      });
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: { navigationLevel: 'SEMESTER', navigationYearId: year.id },
      });
      return showMenu(ctx, updated);
    }
    if (level === 'SEMESTER') {
      const semester = await prisma.semester.findFirst({
        where: {
          id: selected.id,
          academicYearId: membership.navigationYearId!,
          isActive: true,
          archivedAt: null,
        },
      });
      if (!semester) return showMenu(ctx, membership, 'هذا الخيار لم يعد متاحاً.');
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: { navigationLevel: 'COURSE', navigationSemesterId: semester.id },
      });
      return showMenu(ctx, updated);
    }
    if (level === 'COURSE') {
      const course = await prisma.course.findFirst({
        where: {
          id: selected.id,
          semesterId: membership.navigationSemesterId!,
          isActive: true,
          archivedAt: null,
        },
      });
      if (!course) return showMenu(ctx, membership, 'هذا الخيار لم يعد متاحاً.');
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: {
          navigationLevel: nextLevelAfterCourse(course.hasSections),
          navigationCourseId: course.id,
          navigationSectionId: null,
          navigationContentType: null,
          navigationContentCategoryId: null,
        },
      });
      return showMenu(ctx, updated);
    }
    if (level === 'SECTION') {
      const section = await prisma.section.findFirst({
        where: {
          id: selected.id,
          courseId: membership.navigationCourseId!,
          isActive: true,
          archivedAt: null,
          course: { hasSections: true },
        },
      });
      if (!section) return showMenu(ctx, membership, 'هذا القسم لم يعد متاحاً.');
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: {
          navigationLevel: 'CONTENT_CATEGORY',
          navigationSectionId: section.id,
          navigationContentCategoryId: null,
        },
      });
      return showMenu(ctx, updated);
    }
    if (level === 'CONTENT_CATEGORY') {
      const category = await prisma.contentCategory.findFirst({
        where: {
          id: selected.id,
          section: {
            ...(membership.navigationSectionId
              ? { id: membership.navigationSectionId }
              : { courseId: membership.navigationCourseId! }),
            isActive: true,
            archivedAt: null,
          },
          isActive: true,
          archivedAt: null,
          contentItems: {
            some: {
              state: 'PUBLISHED',
              isActive: true,
              archivedAt: null,
            },
          },
        },
      });
      if (!category) return showMenu(ctx, membership, 'هذا النوع لم يعد متاحاً.');
      const updated = await prisma.studentBotMembership.update({
        where: { id: membership.id },
        data: {
          navigationLevel: 'CONTENT',
          navigationSectionId: category.sectionId,
          navigationContentCategoryId: category.id,
        },
      });
      return showMenu(ctx, updated);
    }

    const item = await prisma.contentItem.findFirst({
      where: {
        id: selected.id,
        ...publishedContentWhere(membership.navigationSectionId!),
        contentCategoryId: membership.navigationContentCategoryId!,
      },
      include: { attachments: { where: { isCurrent: true }, orderBy: { version: 'desc' } } },
    });
    if (!item) return showMenu(ctx, membership, 'هذا المحتوى لم يعد متاحاً.');

    const description = item.descriptionAr ?? item.bodyText;
    await ctx.reply([item.titleAr, description].filter(Boolean).join('\n\n'));

    let delivered = item.contentType === 'TEXT';
    if (item.contentType === 'LINK') {
      const links = item.attachments.filter(
        (attachment) => attachment.storageProvider === 'EXTERNAL_URL' && attachment.externalUrl,
      );
      if (!links.length) await ctx.reply('لا توجد روابط متاحة حالياً.');
      for (const [index, attachment] of links.entries()) {
        await ctx.reply(links.length > 1 ? `الرابط ${index + 1}` : 'فتح الرابط', {
          reply_markup: externalUrlKeyboard(attachment.externalUrl!),
        });
        delivered = true;
      }
    }
    if (item.contentType === 'FILE') {
      const files = item.attachments.filter(
        (attachment) => attachment.storageProvider === 'TELEGRAM' || attachment.storedPath,
      );
      if (!files.length) await ctx.reply('لا توجد ملفات متاحة حالياً.');
      for (const [index, attachment] of files.entries()) {
        let source: string | InputFile | null = attachment.telegramFileId ?? null;
        if (!source && allowLocalFiles && attachment.storedPath) {
          const path = resolve(attachment.storedPath);
          source = existsSync(path)
            ? new InputFile(createReadStream(path), attachment.originalFilename)
            : null;
        }
        if (!source) continue;
        const caption =
          files.length > 1 ? `${item.titleAr} - ملف ${index + 1} من ${files.length}` : item.titleAr;
        if (attachment.storageChatId && attachment.storageMessageId) {
          await ctx.api.copyMessage(
            ctx.chat.id,
            attachment.storageChatId.toString(),
            attachment.storageMessageId,
            { caption, reply_markup: brokenReportKeyboard(item.id) },
          );
        } else {
          const message = await ctx.replyWithDocument(source, {
            caption,
            reply_markup: brokenReportKeyboard(item.id),
          });
          if (!attachment.telegramFileId && message.document?.file_id)
            await prisma.contentAttachment.update({
              where: { id: attachment.id },
              data: { telegramFileId: message.document.file_id },
            });
        }
        delivered = true;
      }
      if (!delivered && files.length) await ctx.reply('تعذر إرسال الملفات حالياً.');
    }
    if (!delivered) return;
    await prisma.contentAccessEvent.create({
      data: {
        studentId: student.id,
        contentItemId: item.id,
        botMembershipId: membership.id,
        eventType:
          item.contentType === 'LINK'
            ? 'OPEN_LINK'
            : item.contentType === 'FILE'
              ? 'DOWNLOAD_REQUEST'
              : 'VIEW',
      },
    });
  });

  bot.on('callback_query:data', async (ctx) => {
    const data = parseCallbackData(ctx.callbackQuery.data);
    if (!data) return ctx.answerCallbackQuery({ text: 'هذا الإجراء غير صالح أو قديم.' });
    await ctx.answerCallbackQuery();
    const { student } = await identify(ctx);
    const item = await prisma.contentItem.findFirst({
      where: {
        id: data.id,
        contentType: 'FILE',
        state: 'PUBLISHED',
        isActive: true,
        archivedAt: null,
      },
      include: { attachments: { where: { isCurrent: true }, orderBy: { version: 'desc' } } },
    });
    if (!item) return ctx.reply('تعذر العثور على الملف.');
    const recent = await prisma.brokenFileReport.findFirst({
      where: {
        studentId: student.id,
        contentItemId: item.id,
        createdAt: { gte: brokenReportSince() },
      },
    });
    if (recent) return ctx.reply('تم استلام بلاغك مسبقاً، شكراً لك.');
    await prisma.brokenFileReport.create({
      data: {
        studentId: student.id,
        contentItemId: item.id,
        attachmentId: item.attachments[0]?.id,
        reasonCategory: 'BROKEN_FILE',
      },
    });
    return ctx.reply('تم إرسال البلاغ بنجاح. شكراً لمساعدتنا.');
  });

  bot.catch((error) =>
    console.error({
      updateId: error.ctx.update.update_id,
      message: error.error instanceof Error ? error.error.message : 'Telegram update failed',
    }),
  );
  return bot;
}
