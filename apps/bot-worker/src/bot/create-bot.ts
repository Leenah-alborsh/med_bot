import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@medical/database';
import { Bot, InlineKeyboard, InputFile, type Context } from 'grammy';

type Options = { token: string; prisma: PrismaClient; uploadDirectory: string };
const PAGE_SIZE = 8;
const cb = (action: string, id = '0', page = 0) => `${action}:${id}:${page}`;
export const publishedContentWhere = (sectionId: string) => ({
  sectionId,
  state: 'PUBLISHED' as const,
  isActive: true,
  archivedAt: null,
});
export const brokenReportSince = (now = Date.now()) => new Date(now - 86_400_000);
export function parseCallbackData(data: string) {
  const match = /^([a-z]+):([0-9a-f-]{1,36}|[1-6]|0):(\d{1,3})$/.exec(data);
  return match ? { action: match[1]!, id: match[2]!, page: Number(match[3]) } : null;
}
export function createMedicalBot({ token, prisma }: Options) {
  const bot = new Bot(token);
  const home = () =>
    new InlineKeyboard()
      .text(
        '\u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u0623\u0648\u0644\u0649\u2013\u0627\u0644\u062b\u0627\u0644\u062b\u0629',
        cb('stage', '1'),
      )
      .row()
      .text(
        '\u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u0631\u0627\u0628\u0639\u0629\u2013\u0627\u0644\u0633\u0627\u062f\u0633\u0629',
        cb('stage', '4'),
      );
  const edit = (ctx: Context, text: string, keyboard: InlineKeyboard) =>
    ctx
      .editMessageText(text, { reply_markup: keyboard })
      .catch(() => ctx.reply(text, { reply_markup: keyboard }));
  const stale = (ctx: Context) =>
    edit(
      ctx,
      '\u0647\u0630\u0627 \u0627\u0644\u062e\u064a\u0627\u0631 \u0644\u0645 \u064a\u0639\u062f \u0645\u062a\u0627\u062d\u0627\u064b.',
      home(),
    );
  const identify = async (ctx: Context) => {
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
  bot.command('start', async (ctx) => {
    await identify(ctx);
    await ctx.reply(
      '\u0623\u0647\u0644\u0627\u064b \u0628\u0643 \u0641\u064a \u0645\u0646\u0635\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0637\u0628\u064a. \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0631\u062d\u0644\u0629:',
      { reply_markup: home() },
    );
  });
  bot.command('menu', (ctx) =>
    ctx.reply(
      '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629:',
      { reply_markup: home() },
    ),
  );
  bot.on('callback_query:data', async (ctx) => {
    const data = parseCallbackData(ctx.callbackQuery.data);
    if (!data)
      return ctx.answerCallbackQuery({
        text: '\u0647\u0630\u0627 \u0627\u0644\u062e\u064a\u0627\u0631 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0642\u062f\u064a\u0645.',
      });
    await ctx.answerCallbackQuery();
    const { student, membership } = await identify(ctx);
    if (data.action === 'home')
      return edit(
        ctx,
        '\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0631\u062d\u0644\u0629:',
        home(),
      );
    if (data.action === 'stage') {
      const n = Number(data.id);
      const rows = await prisma.academicYear.findMany({
        where: {
          number: { gte: n, lte: n + 2 },
          isActive: true,
          archivedAt: null,
          botVisibility: { some: { bot: { key: 'medical-main', status: 'ACTIVE' } } },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      const k = new InlineKeyboard();
      rows.forEach((r) => k.text(r.nameAr, cb('year', r.id)).row());
      k.text(
        '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
        cb('home'),
      );
      return edit(
        ctx,
        rows.length
          ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629:'
          : '\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u0646\u0648\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.',
        k,
      );
    }
    if (data.action === 'year') {
      const row = await prisma.academicYear.findFirst({
        where: { id: data.id, isActive: true, archivedAt: null },
      });
      if (!row) return stale(ctx);
      await prisma.student.update({
        where: { id: student.id },
        data: { selectedAcademicYearId: row.id },
      });
      const rows = await prisma.semester.findMany({
        where: { academicYearId: row.id, isActive: true, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      const k = new InlineKeyboard();
      rows.forEach((r) => k.text(r.nameAr, cb('semester', r.id)).row());
      k.text('\u0631\u062c\u0648\u0639', cb('stage', row.number <= 3 ? '1' : '4')).text(
        '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
        cb('home'),
      );
      return edit(
        ctx,
        rows.length
          ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062f\u0631\u0627\u0633\u064a:'
          : '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0635\u0648\u0644 \u0645\u062a\u0627\u062d\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.',
        k,
      );
    }
    if (data.action === 'semester') {
      const row = await prisma.semester.findFirst({
        where: { id: data.id, isActive: true, archivedAt: null },
      });
      if (!row) return stale(ctx);
      const rows = await prisma.course.findMany({
        where: { semesterId: row.id, isActive: true, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      const k = new InlineKeyboard();
      rows.forEach((r) => k.text(r.nameAr, cb('course', r.id)).row());
      k.text('\u0631\u062c\u0648\u0639', cb('year', row.academicYearId)).text(
        '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
        cb('home'),
      );
      return edit(
        ctx,
        rows.length
          ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629:'
          : '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0648\u0627\u062f \u0645\u062a\u0627\u062d\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.',
        k,
      );
    }
    if (data.action === 'course') {
      const row = await prisma.course.findFirst({
        where: { id: data.id, isActive: true, archivedAt: null },
      });
      if (!row) return stale(ctx);
      const rows = await prisma.section.findMany({
        where: { courseId: row.id, isActive: true, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      const k = new InlineKeyboard();
      rows.forEach((r) => k.text(r.nameAr, cb('section', r.id)).row());
      k.text('\u0631\u062c\u0648\u0639', cb('semester', row.semesterId)).text(
        '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
        cb('home'),
      );
      return edit(
        ctx,
        rows.length
          ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645:'
          : '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0642\u0633\u0627\u0645 \u0645\u062a\u0627\u062d\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.',
        k,
      );
    }
    if (data.action === 'section') {
      const row = await prisma.section.findFirst({
        where: { id: data.id, isActive: true, archivedAt: null },
      });
      if (!row) return stale(ctx);
      const where = publishedContentWhere(row.id);
      const [rows, total] = await Promise.all([
        prisma.contentItem.findMany({
          where,
          skip: data.page * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        }),
        prisma.contentItem.count({ where }),
      ]);
      const k = new InlineKeyboard();
      rows.forEach((r) => k.text(r.titleAr, cb('content', r.id)).row());
      if (data.page)
        k.text('\u0627\u0644\u0633\u0627\u0628\u0642', cb('section', row.id, data.page - 1));
      if ((data.page + 1) * PAGE_SIZE < total)
        k.text('\u0627\u0644\u062a\u0627\u0644\u064a', cb('section', row.id, data.page + 1));
      k.row()
        .text('\u0631\u062c\u0648\u0639', cb('course', row.courseId))
        .text(
          '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
          cb('home'),
        );
      return edit(
        ctx,
        rows.length
          ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062d\u062a\u0648\u0649:'
          : '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062d\u062a\u0648\u0649 \u0645\u0646\u0634\u0648\u0631 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.',
        k,
      );
    }
    if (data.action === 'content') {
      const item = await prisma.contentItem.findFirst({
        where: { id: data.id, state: 'PUBLISHED', isActive: true, archivedAt: null },
        include: { attachments: true },
      });
      if (!item) return stale(ctx);
      if (item.contentType === 'TEXT')
        await ctx.reply(item.bodyText ?? item.descriptionAr ?? item.titleAr);
      if (item.contentType === 'LINK') {
        const url = item.attachments.find((a) => a.storageProvider === 'EXTERNAL_URL')?.externalUrl;
        await ctx.reply(
          url
            ? item.titleAr
            : '\u0627\u0644\u0631\u0627\u0628\u0637 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u062d\u0627\u0644\u064a\u0627\u064b.',
          url
            ? {
                reply_markup: new InlineKeyboard().url(
                  '\u0641\u062a\u062d \u0627\u0644\u0631\u0627\u0628\u0637',
                  url,
                ),
              }
            : undefined,
        );
      }
      if (item.contentType === 'FILE') {
        const a = item.attachments[0];
        let source: string | InputFile | null = a?.telegramFileId ?? null;
        if (!source && a?.storedPath) {
          const path = resolve(a.storedPath);
          source = existsSync(path)
            ? new InputFile(createReadStream(path), a.originalFilename)
            : null;
        }
        if (!source)
          await ctx.reply(
            '\u0627\u0644\u0645\u0644\u0641 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u062d\u0627\u0644\u064a\u0627\u064b.',
          );
        else {
          const msg = await ctx.replyWithDocument(source, {
            caption: item.titleAr,
            reply_markup: new InlineKeyboard().text(
              '\u0627\u0644\u0625\u0628\u0644\u0627\u063a \u0639\u0646 \u0645\u0644\u0641 \u062a\u0627\u0644\u0641',
              cb('report', item.id),
            ),
          });
          if (a && !a.telegramFileId && msg.document?.file_id)
            await prisma.contentAttachment.update({
              where: { id: a.id },
              data: { telegramFileId: msg.document.file_id },
            });
        }
      }
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
      return;
    }
    if (data.action === 'report') {
      const item = await prisma.contentItem.findFirst({
        where: { id: data.id, contentType: 'FILE', state: 'PUBLISHED', isActive: true },
        include: { attachments: true },
      });
      if (!item)
        return ctx.reply(
          '\u062a\u0639\u0630\u0631 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641.',
        );
      const recent = await prisma.brokenFileReport.findFirst({
        where: {
          studentId: student.id,
          contentItemId: item.id,
          createdAt: { gte: brokenReportSince() },
        },
      });
      if (recent)
        return ctx.reply(
          '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0628\u0644\u0627\u063a\u0643 \u0645\u0633\u0628\u0642\u0627\u064b\u060c \u0634\u0643\u0631\u0627\u064b \u0644\u0643.',
        );
      await prisma.brokenFileReport.create({
        data: {
          studentId: student.id,
          contentItemId: item.id,
          attachmentId: item.attachments[0]?.id,
          reasonCategory: 'BROKEN_FILE',
        },
      });
      return ctx.reply(
        '\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0628\u0644\u0627\u063a \u0628\u0646\u062c\u0627\u062d. \u0634\u0643\u0631\u0627\u064b \u0644\u0645\u0633\u0627\u0639\u062f\u062a\u0646\u0627.',
      );
    }
    return ctx.reply(
      '\u0647\u0630\u0627 \u0627\u0644\u062e\u064a\u0627\u0631 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0642\u062f\u064a\u0645.',
    );
  });
  bot.catch((error) =>
    console.error({
      updateId: error.ctx.update.update_id,
      message: error.error instanceof Error ? error.error.message : 'Telegram update failed',
    }),
  );
  return bot;
}
