import { describe, expect, it, vi } from 'vitest';
import { AdminsService } from '../src/admins/admins.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

describe('secondary administrator creation', () => {
  it('creates a pending admin and returns a raw setup credential exactly in that response', async () => {
    const created = {
      id: 'new-admin',
      email: 'new@example.com',
      displayNameAr: 'مشرف',
      displayNameEn: 'Admin',
      status: 'PENDING',
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [{ role: { id: 'role', key: 'viewer', nameAr: 'مشاهد', nameEn: 'Viewer' } }],
      scopes: [],
    };
    const tx = {
      adminUser: { create: vi.fn().mockResolvedValue(created) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      adminSetupToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      role: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'role', key: 'viewer', isActive: true, isProtected: false, permissions: [] },
          ]),
      },
      adminUser: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const actor = { id: 'root' } as AuthenticatedAdmin;
    const result = await new AdminsService(prisma).create(
      {
        email: 'NEW@example.com',
        displayNameAr: 'مشرف',
        displayNameEn: 'Admin',
        roleIds: ['role'],
      },
      actor,
      {},
    );
    expect(result.admin).toMatchObject({ email: 'new@example.com', status: 'PENDING' });
    expect(result.setupCredential.token).toHaveLength(43);
    expect(JSON.stringify(result.admin)).not.toContain('tokenHash');
    const stored = tx.adminSetupToken.create.mock.calls[0]?.[0] as unknown as {
      data: { tokenHash: string };
    };
    expect(stored.data.tokenHash).not.toBe(result.setupCredential.token);
  });
});
