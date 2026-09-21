import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';
import type { Prisma } from '@medical/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { hashToken, randomToken } from '../auth/token.util.js';
import type {
  CreateAdminInput,
  ListAdminsInput,
  RolesInput,
  ScopesInput,
  UpdateAdminInput,
} from './admin.schemas.js';

const publicInclude = {
  roles: { include: { role: { select: { id: true, key: true, nameAr: true, nameEn: true } } } },
  scopes: true,
} as const;

type AdminWithPublic = Prisma.AdminUserGetPayload<{ include: typeof publicInclude }>;

const serialize = (admin: AdminWithPublic) => ({
  id: admin.id,
  email: admin.email,
  displayNameAr: admin.displayNameAr,
  displayNameEn: admin.displayNameEn,
  status: admin.status,
  mustChangePassword: admin.mustChangePassword,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
  roles: admin.roles.map((item) => item.role),
  scopes: admin.scopes.map((scope) => ({
    id: scope.id,
    botId: scope.botId,
    academicYearId: scope.academicYearId,
    courseId: scope.courseId,
  })),
});

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListAdminsInput) {
    const where = input.search
      ? {
          OR: [
            { email: { contains: input.search.toLowerCase(), mode: 'insensitive' as const } },
            { displayNameAr: { contains: input.search, mode: 'insensitive' as const } },
            { displayNameEn: { contains: input.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, admins] = await this.prisma.$transaction([
      this.prisma.adminUser.count({ where }),
      this.prisma.adminUser.findMany({
        where,
        include: publicInclude,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: admins.map(serialize), page: input.page, pageSize: input.pageSize, total };
  }

  async get(id: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id }, include: publicInclude });
    if (!admin) throw new NotFoundException('Administrator not found');
    return serialize(admin);
  }

  private async validateAssignableRoles(roleIds: string[]) {
    const unique = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: unique }, isActive: true },
      include: { permissions: { include: { permission: true } } },
    });
    if (
      roles.length !== unique.length ||
      roles.some(
        (role) =>
          role.isProtected ||
          role.key === SUPER_ADMIN_ROLE_KEY ||
          role.permissions.some((link) => link.permission.isReserved),
      )
    ) {
      throw new BadRequestException('One or more roles cannot be assigned');
    }
    return unique;
  }

  private async issueSetupToken(
    adminUserId: string,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
    actionKey: string,
  ) {
    const rawToken = randomToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminSetupToken.updateMany({
        where: { adminUserId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.adminSetupToken.create({
        data: { adminUserId, tokenHash: hashToken(rawToken), expiresAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actionKey,
          entityType: 'AdminUser',
          entityId: adminUserId,
          after: { setupCredentialIssued: true, expiresAt: expiresAt.toISOString() },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
    return { token: rawToken, expiresAt };
  }

  async create(input: CreateAdminInput, actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    const roleIds = await this.validateAssignableRoles(input.roleIds);
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email } }))
      throw new ConflictException('Email is already in use');
    const admin = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: {
          email,
          displayNameAr: input.displayNameAr,
          displayNameEn: input.displayNameEn,
          status: 'PENDING',
          mustChangePassword: true,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: publicInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actionKey: 'admin.created',
          entityType: 'AdminUser',
          entityId: created.id,
          after: {
            email,
            displayNameAr: input.displayNameAr,
            displayNameEn: input.displayNameEn,
            roleIds,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      return created;
    });
    const setup = await this.issueSetupToken(
      admin.id,
      actor,
      metadata,
      'admin.setup-credential.issued',
    );
    return { admin: serialize(admin), setupCredential: setup };
  }

  async update(
    id: string,
    input: UpdateAdminInput,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    const before = await this.get(id);
    const data = { ...input, email: input.email?.trim().toLowerCase() };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.adminUser.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actionKey: 'admin.updated',
            entityType: 'AdminUser',
            entityId: id,
            before,
            after: data,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Email is already in use');
      throw error;
    }
    return this.get(id);
  }

  async setStatus(
    id: string,
    active: boolean,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    if (!active && id === actor.id) {
      throw new BadRequestException('You cannot disable your own account');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const target = await tx.adminUser.findUnique({
          where: { id },
          include: { roles: { include: { role: true } } },
        });
        if (!target) throw new NotFoundException('Administrator not found');

        const isSuperAdmin = target.roles.some(
          (membership) => membership.role.key === SUPER_ADMIN_ROLE_KEY,
        );
        if (!active && isSuperAdmin) {
          const activeSuperAdmins = await tx.adminUser.count({
            where: {
              status: 'ACTIVE',
              roles: { some: { role: { key: SUPER_ADMIN_ROLE_KEY } } },
            },
          });
          if (activeSuperAdmins <= 1) {
            throw new BadRequestException('The final active Super Admin cannot be disabled');
          }
        }

        const status = active ? 'ACTIVE' : 'DISABLED';
        await tx.adminUser.update({ where: { id }, data: { status } });
        if (!active) {
          await tx.adminSession.updateMany({
            where: { adminUserId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actionKey: active ? 'admin.reactivated' : 'admin.disabled',
            entityType: 'AdminUser',
            entityId: id,
            before: { status: target.status },
            after: { status },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.get(id);
  }

  async assignRoles(
    id: string,
    input: RolesInput,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    const target = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('Administrator not found');
    if (target.roles.some((membership) => membership.role.isProtected))
      throw new ForbiddenException('Protected role membership cannot be modified here');
    const roleIds = await this.validateAssignableRoles(input.roleIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminRole.deleteMany({ where: { adminUserId: id } });
      if (roleIds.length)
        await tx.adminRole.createMany({
          data: roleIds.map((roleId) => ({ adminUserId: id, roleId })),
        });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actionKey: 'admin.roles.changed',
          entityType: 'AdminUser',
          entityId: id,
          before: { roleIds: target.roles.map((item) => item.roleId) },
          after: { roleIds },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
    return this.get(id);
  }

  async assignScopes(
    id: string,
    input: ScopesInput,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    const target = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, scopes: true },
    });
    if (!target) throw new NotFoundException('Administrator not found');
    const [bots, years, courses] = await Promise.all([
      this.prisma.bot.count({ where: { id: { in: [...new Set(input.botIds)] } } }),
      this.prisma.academicYear.count({
        where: { id: { in: [...new Set(input.academicYearIds)] } },
      }),
      this.prisma.course.count({ where: { id: { in: [...new Set(input.courseIds)] } } }),
    ]);
    if (
      bots !== new Set(input.botIds).size ||
      years !== new Set(input.academicYearIds).size ||
      courses !== new Set(input.courseIds).size
    )
      throw new BadRequestException('One or more scopes do not exist');
    const rows = [
      ...[...new Set(input.botIds)].map((botId) => ({ adminUserId: id, botId })),
      ...[...new Set(input.academicYearIds)].map((academicYearId) => ({
        adminUserId: id,
        academicYearId,
      })),
      ...[...new Set(input.courseIds)].map((courseId) => ({ adminUserId: id, courseId })),
    ];
    await this.prisma.$transaction(async (tx) => {
      await tx.adminScope.deleteMany({ where: { adminUserId: id } });
      if (rows.length) await tx.adminScope.createMany({ data: rows });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actionKey: 'admin.scopes.changed',
          entityType: 'AdminUser',
          entityId: id,
          before: { scopes: target.scopes },
          after: {
            scopes: rows.map((scope) => ({
              botId: 'botId' in scope ? scope.botId : undefined,
              academicYearId: 'academicYearId' in scope ? scope.academicYearId : undefined,
              courseId: 'courseId' in scope ? scope.courseId : undefined,
            })),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
    return this.get(id);
  }

  async revokeSessions(id: string, actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    const result = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.adminSession.updateMany({
        where: { adminUserId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actionKey: 'admin.sessions.revoked',
          entityType: 'AdminUser',
          entityId: id,
          after: { revokedCount: revoked.count },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      return revoked;
    });
    return { revokedCount: result.count };
  }

  regenerateSetup(id: string, actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    return this.issueSetupToken(id, actor, metadata, 'admin.setup-credential.regenerated');
  }

  async roles() {
    const roles = await this.prisma.role.findMany({
      where: {
        isActive: true,
        isProtected: false,
        key: { not: SUPER_ADMIN_ROLE_KEY },
        permissions: { none: { permission: { isReserved: true } } },
      },
      select: {
        id: true,
        key: true,
        nameAr: true,
        nameEn: true,
        description: true,
        permissions: {
          select: { permission: { select: { id: true, key: true, labelAr: true, labelEn: true } } },
        },
      },
      orderBy: { nameEn: 'asc' },
    });
    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((item) => item.permission),
    }));
  }

  async audit(id: string) {
    await this.get(id);
    return this.prisma.auditLog.findMany({
      where: { entityType: 'AdminUser', entityId: id },
      select: {
        id: true,
        actorId: true,
        actionKey: true,
        before: true,
        after: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
