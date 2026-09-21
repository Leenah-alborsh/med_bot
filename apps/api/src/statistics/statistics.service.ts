import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async students() {
    const now = new Date();
    const newSince = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const activeSince = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
    const [total, newStudents, recentlyActive, bots, years] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { firstSeenAt: { gte: newSince } } }),
      this.prisma.student.count({ where: { lastSeenAt: { gte: activeSince } } }),
      this.prisma.bot.findMany({
        select: {
          id: true,
          key: true,
          displayName: true,
          _count: { select: { memberships: true } },
        },
        orderBy: { key: 'asc' },
      }),
      this.prisma.academicYear.findMany({
        select: {
          id: true,
          number: true,
          nameAr: true,
          nameEn: true,
          _count: { select: { students: true } },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    return {
      definitions: { newStudentsDays: 30, recentlyActiveDays: 7 },
      totalUniqueStudents: total,
      newStudents,
      recentlyActiveStudents: recentlyActive,
      studentsPerBot: bots.map((bot) => ({
        botId: bot.id,
        key: bot.key,
        displayName: bot.displayName,
        count: bot._count.memberships,
      })),
      studentsPerAcademicYear: years.map((year) => ({
        academicYearId: year.id,
        number: year.number,
        nameAr: year.nameAr,
        nameEn: year.nameEn,
        count: year._count.students,
      })),
    };
  }
}
