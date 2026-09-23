import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAdmin } from './auth.types.js';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';

export type ScopeTarget =
  | { botId: string; academicYearId?: never; courseId?: never }
  | { academicYearId: string; botId?: never; courseId?: never }
  | { courseId: string; botId?: never; academicYearId?: never };

export interface ResourceScope {
  botId?: string;
  academicYearId?: string;
  courseId?: string;
}

@Injectable()
export class ScopeAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccess(adminId: string, target: ScopeTarget): Promise<boolean> {
    const scoped = await this.prisma.adminScope.count({ where: { adminUserId: adminId } });
    if (scoped === 0) return true;
    return (
      (await this.prisma.adminScope.count({
        where: { adminUserId: adminId, ...target },
      })) > 0
    );
  }

  async assertAccess(adminId: string, target: ScopeTarget): Promise<void> {
    if (!(await this.canAccess(adminId, target)))
      throw new ForbiddenException('Scope does not allow this resource');
  }

  async assertResourceAccess(
    admin: Pick<AuthenticatedAdmin, 'id' | 'roleKeys'>,
    resource: ResourceScope,
  ): Promise<void> {
    if (admin.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) return;
    const scopes = await this.prisma.adminScope.findMany({
      where: { adminUserId: admin.id },
      select: { botId: true, academicYearId: true, courseId: true },
    });
    if (scopes.length === 0) return;
    const allowed = scopes.some(
      (scope) =>
        (scope.botId === null || scope.botId === resource.botId) &&
        (scope.academicYearId === null || scope.academicYearId === resource.academicYearId) &&
        (scope.courseId === null || scope.courseId === resource.courseId),
    );
    if (!allowed) throw new ForbiddenException('Scope does not allow this resource');
  }
}
