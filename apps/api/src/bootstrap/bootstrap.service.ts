import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { SUPER_ADMIN_ROLE_KEY, emailSchema, passwordSchema } from '@medical/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Injectable()
export class BootstrapService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async createFirstSuperAdmin(input: {
    email: string;
    password: string;
    displayNameAr: string;
    displayNameEn: string;
  }) {
    const email = emailSchema.parse(input.email);
    const password = passwordSchema.parse(input.password);
    const passwordHash = await this.auth.hashPassword(password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUnique({ where: { key: SUPER_ADMIN_ROLE_KEY } });
        if (!role?.isProtected || !role.isActive)
          throw new Error('Protected Super Admin role is missing; run the seed first');
        const existingAssignment = await tx.adminRole.findFirst({
          where: { roleId: role.id },
          include: { adminUser: true },
        });
        if (existingAssignment) {
          if (existingAssignment.adminUser.email === email)
            return { created: false, adminId: existingAssignment.adminUser.id };
          throw new ConflictException(
            'A Super Admin already exists. Deliberate recovery requires a reviewed database operation.',
          );
        }
        const existingEmail = await tx.adminUser.findUnique({ where: { email } });
        if (existingEmail) throw new ConflictException('Email is already in use');
        const admin = await tx.adminUser.create({
          data: {
            email,
            passwordHash,
            displayNameAr: input.displayNameAr.trim(),
            displayNameEn: input.displayNameEn.trim(),
            status: 'ACTIVE',
            mustChangePassword: false,
            passwordChangedAt: new Date(),
          },
        });
        await tx.adminRole.create({
          data: { adminUserId: admin.id, roleId: role.id },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            actionKey: 'admin.super-admin.bootstrapped',
            entityType: 'AdminUser',
            entityId: admin.id,
            after: { email, roleKey: SUPER_ADMIN_ROLE_KEY },
          },
        });
        return { created: true, adminId: admin.id };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Error &&
        error.message.startsWith('Protected Super Admin role is missing')
      )
        throw error;
      throw new Error(
        'Super Admin bootstrap failed; the transaction was rolled back and no account was created.',
        { cause: error },
      );
    }
  }
}
