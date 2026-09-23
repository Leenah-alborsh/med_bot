import { Prisma } from '@medical/database';
import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { ContentService } from '../src/content/content.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { ScopeAuthorizationService } from '../src/auth/scope-authorization.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { TelegramFileStorageService } from '../src/content/telegram-file-storage.service.js';
import type { UploadTicketService } from '../src/content/upload-ticket.service.js';

const actor = { id: 'actor', roleKeys: ['super-admin'] };

describe('catalog and content conflict errors', () => {
  it('explains why an archived content type with content cannot be deleted', async () => {
    const tx = {
      contentItem: { count: vi.fn().mockResolvedValue(2) },
      contentCategory: { delete: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const scopes = {
      assertResourceAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as ScopeAuthorizationService;
    const service = new CatalogService(prisma, scopes, {} as AuditService);
    Object.assign(service, {
      scopeForExisting: vi.fn().mockResolvedValue({}),
      findExisting: vi.fn().mockResolvedValue({ id: 'category', isActive: false }),
    });

    await expect(service.delete('content-type', 'category', actor, {})).rejects.toThrow(
      'مرتبط بـ 2 عنصر محتوى',
    );
    expect(tx.contentCategory.delete).not.toHaveBeenCalled();
  });

  it('returns a useful conflict when a content display order is duplicated', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    const tx = { contentItem: { create: vi.fn().mockRejectedValue(duplicate) } };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ContentService(
      prisma,
      {} as ScopeAuthorizationService,
      {} as AuditService,
      {} as TelegramFileStorageService,
      {} as UploadTicketService,
    );
    Object.assign(service, {
      sectionTarget: vi.fn().mockResolvedValue({ courseId: 'course', academicYearId: 'year' }),
      categoryTarget: vi.fn().mockResolvedValue({ sectionId: 'section' }),
      assertScope: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.create(
        {
          sectionId: 'section',
          contentCategoryId: 'category',
          titleAr: 'محتوى',
          contentType: 'FILE',
          displayOrder: 1,
        },
        actor,
        {},
      ),
    ).rejects.toThrow('ترتيب العرض مستخدم مسبقًا');
  });
});
