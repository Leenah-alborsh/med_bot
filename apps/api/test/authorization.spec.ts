import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../src/auth/permission.guard.js';
import { ScopeAuthorizationService } from '../src/auth/scope-authorization.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('authorization', () => {
  it('allows every required permission and rejects a secondary admin missing one', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admins.read']),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => ({ admin: { permissions: ['content.read'] } }) }),
    };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
    context.switchToHttp = () => ({
      getRequest: () => ({ admin: { permissions: ['admins.read'] } }),
    });
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('enforces scopes and treats no scopes as global', async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const service = new ScopeAuthorizationService({
      adminScope: { count },
    } as unknown as PrismaService);
    await expect(service.canAccess('admin', { botId: 'bot' })).resolves.toBe(true);
    await expect(service.canAccess('admin', { botId: 'bot' })).resolves.toBe(false);
    await expect(service.assertAccess('admin', { botId: 'other' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('treats no resource scopes as global for secondary admins', async () => {
    const service = new ScopeAuthorizationService({
      adminScope: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);
    await expect(
      service.assertResourceAccess(
        { id: 'secondary', roleKeys: ['content-admin'] },
        { botId: 'bot', academicYearId: 'year', courseId: 'course' },
      ),
    ).resolves.toBeUndefined();
  });

  it('allows Super Admin globally and requires matching nested scope for secondary admins', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ botId: 'bot', academicYearId: 'year', courseId: 'course' }]);
    const service = new ScopeAuthorizationService({
      adminScope: { findMany },
    } as unknown as PrismaService);
    await expect(
      service.assertResourceAccess({ id: 'root', roleKeys: ['super-admin'] }, { botId: 'other' }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertResourceAccess(
        { id: 'secondary', roleKeys: ['content-admin'] },
        { botId: 'bot', academicYearId: 'year', courseId: 'course' },
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertResourceAccess(
        { id: 'secondary', roleKeys: ['content-admin'] },
        { botId: 'bot', academicYearId: 'year', courseId: 'outside' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
