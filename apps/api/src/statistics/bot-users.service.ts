import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';
import type { Prisma } from '@medical/database';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { usageDateRange, type BotUsersQuery } from './bot-users.schemas.js';

@Injectable()
export class BotUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private authorize(actor: AuthenticatedAdmin) {
    if (!actor.roleKeys.includes(SUPER_ADMIN_ROLE_KEY))
      throw new ForbiddenException('Super admin required');
  }

  async list(actor: AuthenticatedAdmin, query: BotUsersQuery) {
    this.authorize(actor);
    const createdAt = usageDateRange(query);
    const where: Prisma.StudentWhereInput = {
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { username: { contains: query.search.replace(/^@/, ''), mode: 'insensitive' } },
              ...(/^\d{1,18}$/.test(query.search)
                ? [{ telegramUserId: BigInt(query.search) }]
                : []),
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            AND: [
              {
                OR: [
                  { memberships: { some: { usageEvents: { some: { createdAt } } } } },
                  { accessEvents: { some: { createdAt } } },
                ],
              },
            ],
          }
        : {}),
    };
    const usageWhere = { createdAt, botMembership: { student: where } };
    const [total, students, interactions, sessions, contentUses, activeToday, activeWeek] =
      await Promise.all([
        this.prisma.student.count({ where }),
        this.prisma.student.findMany({
          where,
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            firstSeenAt: true,
            lastSeenAt: true,
            selectedAcademicYear: { select: { nameAr: true } },
          },
        }),
        this.prisma.botUsageEvent.count({ where: usageWhere }),
        this.prisma.botUsageEvent.count({ where: { ...usageWhere, isSessionStart: true } }),
        this.prisma.contentAccessEvent.count({ where: { createdAt, student: where } }),
        this.prisma.student.count({
          where: { lastSeenAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),
        this.prisma.student.count({
          where: { lastSeenAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
        }),
      ]);
    const ids = students.map((student) => student.id);
    const [usage, content] = ids.length
      ? await Promise.all([
          this.prisma.botUsageEvent.groupBy({
            by: ['botMembershipId', 'action', 'isSessionStart'],
            where: { createdAt, botMembership: { studentId: { in: ids } } },
            _count: { _all: true },
          }),
          this.prisma.contentAccessEvent.groupBy({
            by: ['studentId', 'eventType'],
            where: { createdAt, studentId: { in: ids } },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const memberships = ids.length
      ? await this.prisma.studentBotMembership.findMany({
          where: { studentId: { in: ids } },
          select: { id: true, studentId: true },
        })
      : [];
    const owners = new Map(memberships.map((row) => [row.id, row.studentId]));
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: { interactions, sessions, contentUses, activeToday, activeWeek },
      items: students.map((student) => {
        const rows = usage.filter((row) => owners.get(row.botMembershipId) === student.id);
        return {
          ...student,
          telegramUserId: student.telegramUserId.toString(),
          interactions: rows.reduce((sum, row) => sum + row._count._all, 0),
          sessions: rows
            .filter((row) => row.isSessionStart)
            .reduce((sum, row) => sum + row._count._all, 0),
          starts: rows
            .filter((row) => row.action === 'START')
            .reduce((sum, row) => sum + row._count._all, 0),
          contentUses: content
            .filter((row) => row.studentId === student.id)
            .map((row) => ({ type: row.eventType, count: row._count._all })),
        };
      }),
    };
  }

  async detail(actor: AuthenticatedAdmin, id: string, query: BotUsersQuery) {
    this.authorize(actor);
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        telegramUserId: true,
        firstName: true,
        lastName: true,
        username: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const createdAt = usageDateRange(query);
    const where = { studentId: id, createdAt };
    const [total, content, actions, recentInteractions] = await Promise.all([
      this.prisma.contentAccessEvent.count({ where }),
      this.prisma.contentAccessEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          eventType: true,
          createdAt: true,
          contentItem: {
            select: {
              titleAr: true,
              contentType: true,
              section: { select: { nameAr: true, course: { select: { nameAr: true } } } },
            },
          },
        },
      }),
      this.prisma.botUsageEvent.groupBy({
        by: ['action'],
        where: { createdAt, botMembership: { studentId: id } },
        _count: { _all: true },
      }),
      this.prisma.botUsageEvent.findMany({
        where: { createdAt, botMembership: { studentId: id } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
        select: { id: true, action: true, isSessionStart: true, createdAt: true },
      }),
    ]);
    return {
      student: { ...student, telegramUserId: student.telegramUserId.toString() },
      total,
      content,
      page: query.page,
      pageSize: query.pageSize,
      actions: actions.map((row) => ({ action: row.action, count: row._count._all })),
      recentInteractions,
    };
  }
}
