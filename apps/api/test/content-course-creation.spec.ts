import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ContentService } from '../src/content/content.service.js';
import { contentInputSchema } from '../src/content/content.schemas.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const input = { courseId, titleAr: 'Course file', contentType: 'FILE' as const, displayOrder: 0 };
const actor = { id: 'admin', roleKeys: ['content-admin'] };

function setup(hasSections = false, existingSection: { id: string } | null = null) {
  const tx = {
    section: {
      findFirst: vi.fn().mockResolvedValue(existingSection),
      create: vi.fn().mockResolvedValue({ id: 'internal-section' }),
    },
    contentCategory: {
      findFirst: vi.fn().mockResolvedValue({ id: 'category', isActive: true }),
      findUnique: vi.fn().mockResolvedValue({ sectionId: 'other-section', isActive: true }),
    },
    contentItem: { create: vi.fn().mockResolvedValue({ id: 'content' }) },
  };
  const prisma = {
    course: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: courseId,
          nameAr: 'Course',
          hasSections,
          isActive: true,
          archivedAt: null,
          semester: { academicYearId: 'year' },
        }),
    },
    bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const scopes = { assertResourceAccess: vi.fn().mockResolvedValue(undefined) };
  const service = new ContentService(
    prisma as never,
    scopes as never,
    { record: vi.fn() } as never,
    {} as never,
    {} as never,
  );
  return { service, tx, prisma, scopes };
}

describe('Content creation for courses without sections', () => {
  it('accepts a course instead of a section, while requiring a valid target', () => {
    expect(contentInputSchema.parse(input).courseId).toBe(courseId);
    expect(
      contentInputSchema.safeParse({ titleAr: 'No target', contentType: 'FILE', displayOrder: 0 })
        .success,
    ).toBe(false);
  });

  it('creates an internal section within the content transaction when needed', async () => {
    const { service, tx, scopes } = setup();
    await service.create(input, actor, {});
    expect(scopes.assertResourceAccess).toHaveBeenCalledWith(actor, {
      botId: 'bot',
      academicYearId: 'year',
      courseId,
    });
    expect(tx.section.create).toHaveBeenCalledWith({
      data: { courseId, nameAr: 'Course', nameEn: '__course__', displayOrder: 0 },
      select: { id: true },
    });
    const create = tx.contentItem.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(create.data).toMatchObject({
      sectionId: 'internal-section',
      contentCategoryId: 'category',
      titleAr: 'Course file',
    });
    expect(create.data).not.toHaveProperty('courseId');
  });

  it('reuses an existing internal section without creating duplicates', async () => {
    const { service, tx } = setup(false, { id: 'existing-section' });
    await service.create(input, actor, {});
    expect(tx.section.create).not.toHaveBeenCalled();
    const create = tx.contentItem.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(create.data.sectionId).toBe('existing-section');
  });

  it('still requires a selected section for courses configured with sections', async () => {
    const { service, prisma } = setup(true);
    await expect(service.create(input, actor, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks scope before creating any internal records', async () => {
    const { service, prisma, scopes } = setup();
    scopes.assertResourceAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.create(input, actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a category belonging to another course section', async () => {
    const { service, tx } = setup();
    await expect(
      service.create({ ...input, contentCategoryId: 'foreign-category' }, actor, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.contentItem.create).not.toHaveBeenCalled();
  });
});
