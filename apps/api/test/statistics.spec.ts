import { describe, expect, it, vi } from 'vitest';
import { StatisticsService } from '../src/statistics/statistics.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('student statistics', () => {
  it('returns real aggregate results and no student personal data', async () => {
    const studentCount = vi
      .fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7);
    const prisma = {
      student: { count: studentCount },
      bot: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'b1',
            key: 'preclinical',
            displayName: 'Preclinical',
            _count: { memberships: 8 },
          },
        ]),
      },
      academicYear: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'y1',
            number: 1,
            nameAr: 'السنة الأولى',
            nameEn: 'Year 1',
            _count: { students: 4 },
          },
        ]),
      },
    } as unknown as PrismaService;
    const result = await new StatisticsService(prisma).students();
    expect(result.totalUniqueStudents).toBe(12);
    expect(result.newStudents).toBe(3);
    expect(result.recentlyActiveStudents).toBe(7);
    expect(result.studentsPerBot[0]?.count).toBe(8);
    expect(JSON.stringify(result)).not.toContain('telegramUserId');
  });

  it('handles an empty database', async () => {
    const prisma = {
      student: { count: vi.fn().mockResolvedValue(0) },
      bot: { findMany: vi.fn().mockResolvedValue([]) },
      academicYear: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    await expect(new StatisticsService(prisma).students()).resolves.toMatchObject({
      totalUniqueStudents: 0,
      studentsPerBot: [],
      studentsPerAcademicYear: [],
    });
  });
});
