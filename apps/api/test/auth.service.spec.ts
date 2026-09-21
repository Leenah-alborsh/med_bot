import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import type { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/auth/auth.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { Environment } from '../src/config/environment.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

let passwordHash = '';
beforeAll(async () => {
  passwordHash = await argon2.hash('ValidPassword!2', { memoryCost: 8192, timeCost: 1 });
});

const activeAdmin = () => ({
  id: 'admin-id',
  email: 'admin@example.com',
  passwordHash,
  displayNameAr: 'مشرف',
  displayNameEn: 'Admin',
  status: 'ACTIVE',
  mustChangePassword: false,
  lockedUntil: null,
  failedLoginCount: 0,
  roles: [
    {
      role: {
        key: 'viewer',
        isActive: true,
        permissions: [{ permission: { key: 'content.read', isActive: true } }],
      },
    },
  ],
});

const config = {
  get: vi.fn((key: string) => (key === 'ADMIN_SESSION_TTL_SECONDS' ? 43200 : 'test')),
} as unknown as ConfigService<Environment, true>;
const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;

describe('authentication service', () => {
  it('logs in with a generic public response and stores token hashes only', async () => {
    const tx = {
      adminSession: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'session-id', expiresAt: new Date(Date.now() + 10000) }),
      },
      adminUser: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      adminUser: { findUnique: vi.fn().mockResolvedValue(activeAdmin()) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const result = await new AuthService(prisma, audit, config).login(
      { email: 'ADMIN@example.com', password: 'ValidPassword!2' },
      {},
    );
    expect(result.admin.email).toBe('admin@example.com');
    expect(result.rawToken).toBeTruthy();
    const createInput = tx.adminSession.create.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createInput.data).not.toHaveProperty('rawToken');
    expect(createInput.data.tokenHash).not.toBe(result.rawToken);
  });

  it('uses the same invalid-credentials error for wrong and disabled accounts', async () => {
    const wrongPrisma = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue(activeAdmin()),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    await expect(
      new AuthService(wrongPrisma, audit, config).login(
        { email: 'admin@example.com', password: 'wrong' },
        {},
      ),
    ).rejects.toThrow('Invalid email or password');

    const disabled = { ...activeAdmin(), status: 'DISABLED' };
    const disabledPrisma = {
      adminUser: { findUnique: vi.fn().mockResolvedValue(disabled) },
    } as unknown as PrismaService;
    await expect(
      new AuthService(disabledPrisma, audit, config).login(
        { email: 'admin@example.com', password: 'ValidPassword!2' },
        {},
      ),
    ).rejects.toThrow('Invalid email or password');
  });

  it('authenticates an active database session and rejects a revoked session', async () => {
    const session = {
      id: 'session-id',
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 10000),
      adminUser: activeAdmin(),
    };
    const prisma = {
      adminSession: {
        findUnique: vi.fn().mockResolvedValue(session),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, audit, config);
    await expect(service.authenticate('raw-session')).resolves.toMatchObject({
      id: 'admin-id',
      sessionId: 'session-id',
    });
    session.revokedAt = new Date();
    await expect(service.authenticate('raw-session')).rejects.toThrow('Authentication required');
  });

  it('revokes the current session on logout', async () => {
    const tx = {
      adminSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const admin = { id: 'admin-id', sessionId: 'session-id' } as AuthenticatedAdmin;
    await new AuthService(prisma, audit, config).logout(admin, {});
    const logoutCall: unknown = tx.adminSession.updateMany.mock.calls[0]?.[0];
    expect(logoutCall).toMatchObject({ where: { id: 'session-id' } });
  });

  it('rejects reuse of a consumed one-time setup credential', async () => {
    const prisma = {
      adminSetupToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'token',
          usedAt: new Date(),
          revokedAt: null as Date | null,
          expiresAt: new Date(Date.now() + 10000),
          adminUserId: 'admin',
        }),
      },
    } as unknown as PrismaService;
    await expect(
      new AuthService(prisma, audit, config).setupPassword(
        { token: 'x'.repeat(32), password: 'NewValidPassword!2' },
        {},
      ),
    ).rejects.toThrow('invalid or expired');
  });

  it('password changes revoke every other session', async () => {
    const tx = {
      adminUser: { update: vi.fn().mockResolvedValue({}) },
      adminSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      adminUser: { findUnique: vi.fn().mockResolvedValue({ passwordHash }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const admin = { id: 'admin-id', sessionId: 'current-session' } as AuthenticatedAdmin;
    await new AuthService(prisma, audit, config).changePassword(
      admin,
      { currentPassword: 'ValidPassword!2', newPassword: 'NewValidPassword!2' },
      {},
    );
    const revokeCall: unknown = tx.adminSession.updateMany.mock.calls[0]?.[0];
    expect(revokeCall).toMatchObject({ where: { id: { not: 'current-session' } } });
  });
});
