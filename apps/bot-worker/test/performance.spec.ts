import { describe, expect, it, vi } from 'vitest';
import { createMedicalBot } from '../src/bot/create-bot.js';

function setup(level: string) {
  const membership = {
    id: 'membership',
    navigationLevel: level,
    navigationStage: 1,
    navigationYearId: 'year',
    navigationSemesterId: 'semester',
    navigationCourseId: 'course',
    navigationSectionId: 'section',
    navigationContentCategoryId: 'category',
  };
  const prisma = {
    student: { upsert: vi.fn().mockResolvedValue({ id: 'student' }) },
    bot: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'bot' }) },
    studentBotMembership: { upsert: vi.fn().mockResolvedValue(membership) },
    academicYear: { findMany: vi.fn().mockResolvedValue([{ id: 'year', nameAr: 'Year' }]) },
    semester: { findMany: vi.fn().mockResolvedValue([{ id: 'semester', nameAr: 'Semester' }]) },
    course: { findMany: vi.fn().mockResolvedValue([{ id: 'course', nameAr: 'Course' }]) },
    section: { findMany: vi.fn().mockResolvedValue([{ id: 'section', nameAr: 'Section' }]) },
    contentCategory: {
      findMany: vi.fn().mockResolvedValue([{ id: 'category', nameAr: 'Category' }]),
    },
    contentItem: { findMany: vi.fn().mockResolvedValue([{ id: 'content', titleAr: 'Content' }]) },
  };
  const bot = createMedicalBot({
    token: '123:test',
    prisma: prisma as never,
    uploadDirectory: '.',
  });
  bot.botInfo = {
    id: 123,
    is_bot: true,
    first_name: 'Bot',
    username: 'test_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  const replies: unknown[] = [];
  bot.api.config.use((_previous, method, payload) => {
    replies.push({ method, payload });
    return Promise.resolve({
      ok: true,
      result: { message_id: 1, date: 0, chat: { id: 42, type: 'private' }, text: 'reply' },
    } as never);
  });
  const update = {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: 'private' as const, first_name: 'Student' },
      from: { id: 42, is_bot: false, first_name: 'Student' },
      text: 'not-an-option',
    },
  };
  return { bot, prisma, update, replies };
}

describe('lightweight bot menu queries', () => {
  it.each([
    ['YEAR', 'academicYear', 'nameAr'],
    ['SEMESTER', 'semester', 'nameAr'],
    ['COURSE', 'course', 'nameAr'],
    ['SECTION', 'section', 'nameAr'],
    ['CONTENT_CATEGORY', 'contentCategory', 'nameAr'],
    ['CONTENT', 'contentItem', 'titleAr'],
  ] as const)(
    'selects only labels and IDs at %s without changing navigation',
    async (level, model, label) => {
      const { bot, prisma, update, replies } = setup(level);
      await bot.handleUpdate(update);
      expect(prisma[model].findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, [label]: true },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(prisma.student.upsert).toHaveBeenCalledOnce();
      expect(prisma.studentBotMembership.upsert).toHaveBeenCalledOnce();
      expect(replies).toHaveLength(1);
      expect(replies[0]).toMatchObject({
        method: 'sendMessage',
        payload: { reply_markup: { resize_keyboard: true } },
      });
    },
  );

  it('starts independent identity reads together without caching student state', async () => {
    const { bot, prisma, update } = setup('YEAR');
    let complete!: (student: { id: string }) => void;
    prisma.student.upsert.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const pending = bot.handleUpdate(update);
    await vi.waitFor(() => expect(prisma.bot.findUniqueOrThrow).toHaveBeenCalledOnce());
    expect(prisma.studentBotMembership.upsert).not.toHaveBeenCalled();
    complete({ id: 'student' });
    await pending;
    expect(prisma.studentBotMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { lastInteraction: expect.any(Date) as unknown },
      }),
    );
  });
});
