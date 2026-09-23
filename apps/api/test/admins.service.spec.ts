import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminsService } from '../src/admins/admins.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

const actor: AuthenticatedAdmin = {
  id: 'actor',
  email: 'root@example.com',
  displayNameAr: 'Root',
  displayNameEn: 'Root',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissions: ['admins.disable'],
  roleKeys: ['super-admin'],
  sessionId: 'session',
};

describe('administrator protections', () => {
  it('rejects roles containing reserved permissions', async () => {
    const prisma = {
      role: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'role',
            key: 'custom',
            isActive: true,
            isProtected: false,
            permissions: [{ permission: { isReserved: true } }],
          },
        ]),
      },
    } as unknown as PrismaService;
    await expect(
      new AdminsService(prisma).create(
        {
          email: 'new@example.com',
          displayNameAr: 'Admin',
          displayNameEn: 'Admin',
          roleIds: ['role'],
        },
        actor,
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not modify a protected Super Admin role assignment', async () => {
    const prisma = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'target',
          roles: [{ roleId: 'super', role: { isProtected: true } }],
        }),
      },
    } as unknown as PrismaService;
    await expect(
      new AdminsService(prisma).assignRoles('target', { roleIds: [] }, actor, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not allow an admin to disable themselves', async () => {
    await expect(
      new AdminsService({} as PrismaService).setStatus('actor', false, actor, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('atomically prevents disabling the final active Super Admin', async () => {
    const tx = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'target',
          status: 'ACTIVE',
          roles: [{ role: { key: 'super-admin' } }],
        }),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const transaction = vi.fn((callback: (client: typeof tx) => unknown) => callback(tx));
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    await expect(new AdminsService(prisma).setStatus('target', false, actor, {})).rejects.toThrow(
      'final active Super Admin',
    );
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('allows only a Super Admin to remove administrators', async () => {
    const regularActor = { ...actor, roleKeys: ['content-admin'] };
    await expect(
      new AdminsService({} as PrismaService).remove('target', regularActor, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses to remove an administrator with a protected role', async () => {
    const tx = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'target',
          roles: [{ role: { isProtected: true } }],
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await expect(new AdminsService(prisma).remove('target', actor, {})).rejects.toThrow(
      'لا يمكن حذف حساب مشرف محمي',
    );
  });

  it('transfers content ownership before deleting an ordinary administrator', async () => {
    const target = {
      id: 'target',
      email: 'ordinary@example.com',
      displayNameAr: 'Ordinary',
      displayNameEn: 'Ordinary',
      status: 'ACTIVE',
      mustChangePassword: false,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [
        {
          role: {
            id: 'role',
            key: 'content-admin',
            nameAr: 'مشرف',
            nameEn: 'Admin',
            isProtected: false,
          },
        },
      ],
      scopes: [],
    };
    const tx = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue(target),
        delete: vi.fn().mockResolvedValue(target),
      },
      contentItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await expect(new AdminsService(prisma).remove('target', actor, {})).resolves.toEqual({
      deleted: true,
    });
    expect(tx.contentItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: { createdById: 'target' },
      data: { createdById: 'actor' },
    });
    expect(tx.contentItem.updateMany).toHaveBeenNthCalledWith(2, {
      where: { updatedById: 'target' },
      data: { updatedById: 'actor' },
    });
    expect(tx.adminUser.delete).toHaveBeenCalledWith({ where: { id: 'target' } });
  });
});
