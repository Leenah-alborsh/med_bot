import { describe, expect, it, vi } from 'vitest';
import { ActionHistoryService } from '../src/audit/action-history.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

const actor = {
  id: 'actor',
  email: 'root@example.com',
  displayNameAr: 'Root',
  displayNameEn: 'Root',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissions: ['catalog.update'],
  roleKeys: ['super-admin'],
  sessionId: 'session',
} satisfies AuthenticatedAdmin;

const action = {
  id: 'audit-1',
  actionKey: 'catalog.update',
  entityType: 'course',
  entityId: 'course-1',
  before: { nameAr: 'قديم', nameEn: 'Old', displayOrder: 1, isActive: true, archivedAt: null },
  after: { nameAr: 'جديد', nameEn: 'New', displayOrder: 1, isActive: true, archivedAt: null },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('administrator action history', () => {
  it('exposes undo then redo after an undo marker', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([action])
      .mockResolvedValueOnce([
        {
          ...action,
          actionKey: 'action.undo',
          id: 'marker',
          after: { targetAuditId: action.id },
          createdAt: new Date('2026-01-01T00:01:00Z'),
        },
        action,
      ]);
    const service = new ActionHistoryService(
      { auditLog: { findMany } } as unknown as PrismaService,
      {} as AuditService,
    );
    await expect(service.status(actor.id)).resolves.toMatchObject({
      canUndo: true,
      canRedo: false,
    });
    await expect(service.status(actor.id)).resolves.toMatchObject({
      canUndo: false,
      canRedo: true,
    });
  });

  it('restores the previous snapshot atomically', async () => {
    const tx = { course: { update: vi.fn().mockResolvedValue({}) } };
    const prisma = {
      auditLog: { findMany: vi.fn().mockResolvedValue([action]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const record = vi.fn().mockResolvedValue({});
    const audit = { record } as unknown as AuditService;
    const service = new ActionHistoryService(prisma, audit);
    await service.undo(actor, {});
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { nameAr: 'قديم', nameEn: 'Old', displayOrder: 1, isActive: true, archivedAt: null },
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actionKey: 'action.undo' }));
  });
});
