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
});
