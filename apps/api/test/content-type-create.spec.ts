import { ConflictException } from '@nestjs/common';
import { Prisma } from '@medical/database';
import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../src/catalog/catalog.service.js';

const actor = { id: 'admin', roleKeys: ['super-admin'] };
const input = {
  courseId: 'course',
  nameAr: 'شرح',
  nameEn: 'Lectures',
  displayOrder: 2,
  isActive: true,
};

function setup() {
  const tx = {
    contentCategory: {
      create: vi.fn().mockResolvedValue({ id: 'category', sectionId: 'section', ...input }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'category', isActive: true }),
      update: vi.fn(),
    },
  };
  const prisma = {
    bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
    course: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: 'course',
          nameAr: 'Course',
          hasSections: false,
          semester: { academicYearId: 'year' },
        }),
    },
    section: { findFirst: vi.fn().mockResolvedValue({ id: 'section' }) },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const scopes = { assertResourceAccess: vi.fn().mockResolvedValue(undefined) };
  const service = new CatalogService(prisma as never, scopes as never, audit as never);
  return { service, tx, audit, scopes };
}

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target: ['sectionId', 'displayOrder'] },
  });

describe('content type creation and ordering conflicts', () => {
  it('saves a type in the internal section of a course without sections', async () => {
    const { service, tx, scopes, audit } = setup();
    await expect(service.create('content-type', input, actor, {})).resolves.toMatchObject({
      id: 'category',
      sectionId: 'section',
    });
    expect(tx.contentCategory.create).toHaveBeenCalledWith({
      data: {
        sectionId: 'section',
        nameAr: 'شرح',
        nameEn: 'Lectures',
        displayOrder: 2,
        isActive: true,
      },
    });
    expect(scopes.assertResourceAccess).toHaveBeenCalledWith(actor, {
      botId: 'bot',
      academicYearId: 'year',
      courseId: 'course',
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
  it('returns an actionable 409 when a new type reuses a display order', async () => {
    const { service, tx, audit } = setup();
    tx.contentCategory.create.mockRejectedValue(duplicate());
    const error = await service
      .create('content-type', input, actor, {})
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as Error).message).toContain('اختر رقمًا آخر');
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('handles order conflicts during editing without changing publication or archive state', async () => {
    const { service, tx } = setup();
    Object.assign(service, { scopeForExisting: vi.fn().mockResolvedValue({ courseId: 'course' }) });
    tx.contentCategory.update.mockRejectedValue(duplicate());
    await expect(
      service.update('content-type', 'category', { displayOrder: 0 }, actor, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.contentCategory.update).toHaveBeenCalledWith({
      where: { id: 'category' },
      data: { displayOrder: 0 },
    });
  });
  it('does not label unrelated database failures as ordering conflicts', async () => {
    const { service, tx } = setup();
    const failure = new Error('Connection failed');
    tx.contentCategory.create.mockRejectedValue(failure);
    await expect(service.create('content-type', input, actor, {})).rejects.toBe(failure);
  });
});
