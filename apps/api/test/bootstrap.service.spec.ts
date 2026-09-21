import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { BootstrapService } from '../src/bootstrap/bootstrap.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const input = {
  email: 'bootstrap@example.com',
  password: 'ValidPassword!2',
  displayNameAr: 'مدير',
  displayNameEn: 'Administrator',
};

function transactionClient() {
  return {
    role: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'super-role',
        isProtected: true,
        isActive: true,
      }),
    },
    adminRole: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    adminUser: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'admin-id' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('BootstrapService', () => {
  it('resolves explicit dependencies under the tsx test transform and creates atomically', async () => {
    const tx = transactionClient();
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const auth = { hashPassword: vi.fn().mockResolvedValue('password-hash') };
    const module = await Test.createTestingModule({
      providers: [
        BootstrapService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    const result = await module.get(BootstrapService).createFirstSuperAdmin(input);

    expect(result).toEqual({ created: true, adminId: 'admin-id' });
    expect(tx.adminUser.create).toHaveBeenCalledOnce();
    expect(tx.adminRole.create).toHaveBeenCalledWith({
      data: { adminUserId: 'admin-id', roleId: 'super-role' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('reports transaction rollback clearly when role assignment fails', async () => {
    const tx = transactionClient();
    tx.adminRole.create.mockRejectedValue(new Error('role assignment failed'));
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const module = await Test.createTestingModule({
      providers: [
        BootstrapService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: { hashPassword: vi.fn().mockResolvedValue('hash') } },
      ],
    }).compile();

    await expect(module.get(BootstrapService).createFirstSuperAdmin(input)).rejects.toThrow(
      'Super Admin bootstrap failed; the transaction was rolled back and no account was created.',
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
