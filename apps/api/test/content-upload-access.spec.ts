import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_METADATA_KEY } from '../src/auth/permissions.decorator.js';
import type { ScopeAuthorizationService } from '../src/auth/scope-authorization.service.js';
import { ContentController } from '../src/content/content.controller.js';
import { ContentService } from '../src/content/content.service.js';
import type { TelegramFileStorageService } from '../src/content/telegram-file-storage.service.js';
import type { UploadTicketService } from '../src/content/upload-ticket.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const admin = {
  id: 'admin',
  permissions: [],
  roleKeys: ['viewer'],
} as never;

function createService(overrides: {
  prisma?: unknown;
  scopes?: unknown;
  tickets?: unknown;
}) {
  return new ContentService(
    overrides.prisma as PrismaService,
    overrides.scopes as ScopeAuthorizationService,
    {} as AuditService,
    {} as TelegramFileStorageService,
    overrides.tickets as UploadTicketService,
  );
}

describe('admin file upload access', () => {
  it('does not require a content permission to issue an upload ticket', () => {
    // The function is inspected for decorator metadata and is never invoked unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const uploadTicket = ContentController.prototype.uploadTicket;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA_KEY, uploadTicket)).toBeUndefined();
  });

  it('lists scoped file targets for an admin without content permissions', async () => {
    const row = {
      id: 'content',
      titleAr: 'ملف',
      section: {
        nameAr: 'قسم',
        course: {
          id: 'course',
          nameAr: 'مادة',
          semester: {
            academicYearId: 'year',
            academicYear: { nameAr: 'السنة الأولى' },
          },
        },
      },
    };
    const assertResourceAccess = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      prisma: {
        contentItem: { findMany: vi.fn().mockResolvedValue([row]) },
        bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
      },
      scopes: { assertResourceAccess },
      tickets: {},
    });

    await expect(service.uploadTargets(admin)).resolves.toEqual({ items: [row] });
    expect(assertResourceAccess).toHaveBeenCalledWith(admin, {
      botId: 'bot',
      academicYearId: 'year',
      courseId: 'course',
    });
  });

  it('issues tickets only for file content', async () => {
    const issue = vi.fn().mockReturnValue({ ticket: 'signed', expiresInSeconds: 300 });
    const service = createService({
      prisma: {},
      scopes: {},
      tickets: { issue },
    });
    Object.assign(service, {
      contentTarget: vi
        .fn()
        .mockResolvedValueOnce({
          contentType: 'FILE',
          courseId: 'course',
          academicYearId: 'year',
        })
        .mockResolvedValueOnce({
          contentType: 'TEXT',
          courseId: 'course',
          academicYearId: 'year',
        }),
      assertScope: vi.fn().mockResolvedValue(undefined),
    });

    await expect(service.issueUploadTicket('file-content', admin)).resolves.toEqual({
      ticket: 'signed',
      expiresInSeconds: 300,
    });
    await expect(service.issueUploadTicket('text-content', admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
