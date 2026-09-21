import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import type { PermissionKey } from '@medical/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedAdmin, RequestMetadata } from './auth.types.js';
import type { ChangePasswordInput, LoginInput, SetupPasswordInput } from './auth.schemas.js';
import { hashToken, randomToken, safeTokenHashEqual } from './token.util.js';

export const SESSION_COOKIE = 'med_admin_session';
export const CSRF_COOKIE = 'med_admin_csrf';
const INVALID_CREDENTIALS = 'Invalid email or password';

const adminInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private serializeAdmin(
    admin: Awaited<ReturnType<AuthService['findAdmin']>>,
    sessionId: string,
  ): AuthenticatedAdmin {
    if (!admin) throw new UnauthorizedException();
    const permissions = new Set<PermissionKey>();
    const roleKeys: string[] = [];
    for (const membership of admin.roles) {
      if (!membership.role.isActive) continue;
      roleKeys.push(membership.role.key);
      for (const link of membership.role.permissions) {
        if (link.permission.isActive) permissions.add(link.permission.key as PermissionKey);
      }
    }
    return {
      id: admin.id,
      email: admin.email,
      displayNameAr: admin.displayNameAr,
      displayNameEn: admin.displayNameEn,
      status: 'ACTIVE',
      mustChangePassword: admin.mustChangePassword,
      permissions: [...permissions],
      roleKeys,
      sessionId,
    };
  }

  private findAdmin(email: string) {
    return this.prisma.adminUser.findUnique({
      where: { email: this.normalizeEmail(email) },
      include: adminInclude,
    });
  }

  async login(input: LoginInput, metadata: RequestMetadata) {
    const now = new Date();
    const admin = await this.findAdmin(input.email);
    const valid = admin?.passwordHash
      ? await argon2.verify(admin.passwordHash, input.password).catch(() => false)
      : false;
    if (
      !admin ||
      !valid ||
      admin.status !== 'ACTIVE' ||
      (admin.lockedUntil && admin.lockedUntil > now)
    ) {
      if (admin && admin.status === 'ACTIVE') {
        const failures = admin.failedLoginCount + 1;
        await this.prisma.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLoginCount: failures,
            lockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : undefined,
          },
        });
      }
      await this.audit.record({
        actionKey: 'auth.login.failed',
        entityType: 'AdminUser',
        entityId: admin?.id,
        metadata,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const rawToken = randomToken();
    const csrfToken = randomToken();
    const ttlSeconds = this.config.get('ADMIN_SESSION_TTL_SECONDS', { infer: true });
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminSession.create({
        data: {
          adminUserId: admin.id,
          tokenHash: hashToken(rawToken),
          csrfHash: hashToken(csrfToken),
          expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      await tx.adminUser.update({
        where: { id: admin.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actionKey: 'auth.login.succeeded',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      return created;
    });
    return {
      admin: this.serializeAdmin(admin, session.id),
      rawToken,
      csrfToken,
      expiresAt: session.expiresAt,
    };
  }

  async authenticate(rawToken?: string): Promise<AuthenticatedAdmin> {
    if (!rawToken) throw new UnauthorizedException('Authentication required');
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { adminUser: { include: adminInclude } },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.adminUser.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Authentication required');
    }
    await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    return this.serializeAdmin(session.adminUser, session.id);
  }

  async assertCsrf(sessionId: string, token?: string) {
    if (!token) throw new BadRequestException('CSRF token required');
    const session = await this.prisma.adminSession.findUnique({
      where: { id: sessionId },
      select: { csrfHash: true },
    });
    if (!session || !safeTokenHashEqual(token, session.csrfHash))
      throw new BadRequestException('Invalid CSRF token');
  }

  setCookies(response: Response, rawToken: string, csrfToken: string, expiresAt: Date) {
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';
    response.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
    response.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
  }

  clearCookies(response: Response) {
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    response.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
  }

  async logout(admin: AuthenticatedAdmin, metadata: RequestMetadata) {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminSession.updateMany({
        where: { id: admin.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actionKey: 'auth.logout',
          entityType: 'AdminSession',
          entityId: admin.sessionId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
  }

  async changePassword(
    admin: AuthenticatedAdmin,
    input: ChangePasswordInput,
    metadata: RequestMetadata,
  ) {
    const record = await this.prisma.adminUser.findUnique({ where: { id: admin.id } });
    if (
      !record?.passwordHash ||
      !(await argon2.verify(record.passwordHash, input.currentPassword).catch(() => false))
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const passwordHash = await this.hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      });
      await tx.adminSession.updateMany({
        where: { adminUserId: admin.id, id: { not: admin.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actionKey: 'auth.password.changed',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
  }

  async setupPassword(input: SetupPasswordInput, metadata: RequestMetadata) {
    const tokenHash = hashToken(input.token);
    const token = await this.prisma.adminSetupToken.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });
    if (!token || token.usedAt || token.revokedAt || token.expiresAt <= new Date())
      throw new BadRequestException('Setup credential is invalid or expired');
    const passwordHash = await this.hashPassword(input.password);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.adminSetupToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new BadRequestException('Setup credential was already used');
      await tx.adminUser.update({
        where: { id: token.adminUserId },
        data: {
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.adminSession.updateMany({
        where: { adminUserId: token.adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: token.adminUserId,
          actionKey: 'auth.setup.completed',
          entityType: 'AdminUser',
          entityId: token.adminUserId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    });
  }
}
