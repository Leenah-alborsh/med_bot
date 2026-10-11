import { PrismaClient } from '@medical/database';

async function diagnose() {
  const prisma = new PrismaClient();
  try {
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('ContentItem', 'Course', 'AuditLog')
    `;
    const missing = [
      'sectionId',
      'contentCategoryId',
      'telegramLinkCode',
      'state',
      'displayOrder',
      'createdById',
      'updatedById',
    ].filter(
      (name) =>
        !columns.some(
          (column) => column.table_name === 'ContentItem' && column.column_name === name,
        ),
    );
    const states = await prisma.contentItem.groupBy({ by: ['state'], _count: true });
    console.log(
      JSON.stringify({
        databaseReachable: true,
        missingContentColumns: missing,
        courseSectionsFlagPresent: columns.some(
          (column) => column.table_name === 'Course' && column.column_name === 'hasSections',
        ),
        auditTablePresent: columns.some((column) => column.table_name === 'AuditLog'),
        contentCounts: states.map((entry) => ({ state: entry.state, count: entry._count })),
      }),
    );
    const categories = await prisma.contentCategory.findMany({
      select: {
        nameAr: true,
        displayOrder: true,
        isActive: true,
        section: {
          select: { isActive: true, course: { select: { nameAr: true, hasSections: true } } },
        },
      },
      orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    console.log(
      JSON.stringify({
        totalContentTypes: categories.length,
        affectedContentTypes: categories.flatMap((category, index) =>
          /كيم|تواصل/.test(category.section.course.nameAr)
            ? [
                {
                  course: category.section.course.nameAr,
                  name: category.nameAr,
                  displayOrder: category.displayOrder,
                  active: category.isActive,
                  sectionActive: category.section.isActive,
                  hasSections: category.section.course.hasSections,
                  listPosition: index + 1,
                  onFirstPage: index < 100,
                },
              ]
            : [],
        ),
      }),
    );
  } catch {
    console.log('Database check failed; check connectivity and deployed migrations.');
  } finally {
    await prisma.$disconnect();
  }
}

void diagnose().catch(() => {
  console.error('Content diagnostics could not complete. No secrets were printed.');
  process.exitCode = 1;
});
