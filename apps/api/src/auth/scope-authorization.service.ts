import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type ScopeTarget =
  | { botId: string; academicYearId?: never; courseId?: never }
  | { academicYearId: string; botId?: never; courseId?: never }
  | { courseId: string; botId?: never; academicYearId?: never };

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
}
