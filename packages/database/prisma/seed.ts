import { PrismaClient } from '@prisma/client';
import {
  permissionKeys,
  reservedPermissionKeys,
  SUPER_ADMIN_ROLE_KEY,
  type PermissionKey,
} from '@medical/shared';

const prisma = new PrismaClient();
const reserved = new Set<PermissionKey>(reservedPermissionKeys);

const rolePermissions: Record<string, PermissionKey[]> = {
  [SUPER_ADMIN_ROLE_KEY]: [...permissionKeys],
  'bot-admin': ['bots.read', 'bots.manage'],
  'content-admin': [
    'content.read',
    'content.create',
    'content.update',
    'content.delete',
    'content.publish',
  ],
  reviewer: ['content.read', 'content.update'],
  'announcement-admin': ['bots.read', 'announcements.send'],
  viewer: ['bots.read', 'content.read'],
};

const roleDetails = [
  {
    key: SUPER_ADMIN_ROLE_KEY,
    name: 'Super Admin',
    nameAr: 'المشرف العام',
    nameEn: 'Super Admin',
    description: 'Protected highest operational role.',
    isSystem: true,
    isProtected: true,
  },
  {
    key: 'bot-admin',
    name: 'Bot Admin',
    nameAr: 'مشرف البوت',
    nameEn: 'Bot Admin',
    description: 'Manage bot configuration.',
    isSystem: true,
    isProtected: false,
  },
  {
    key: 'content-admin',
    name: 'Content Admin',
    nameAr: 'مشرف المحتوى',
    nameEn: 'Content Admin',
    description: 'Create and publish content.',
    isSystem: true,
    isProtected: false,
  },
  {
    key: 'reviewer',
    name: 'Reviewer',
    nameAr: 'مراجع',
    nameEn: 'Reviewer',
    description: 'Review and update content.',
    isSystem: true,
    isProtected: false,
  },
  {
    key: 'announcement-admin',
    name: 'Announcement Admin',
    nameAr: 'مشرف الإعلانات',
    nameEn: 'Announcement Admin',
    description: 'Send announcements.',
    isSystem: true,
    isProtected: false,
  },
  {
    key: 'viewer',
    name: 'Viewer',
    nameAr: 'مشاهد',
    nameEn: 'Viewer',
    description: 'Read-only access.',
    isSystem: true,
    isProtected: false,
  },
] as const;

async function upsertBots() {
  const preclinical = await prisma.bot.upsert({
    where: { key: 'preclinical' },
    update: { displayName: 'Preclinical Bot', groupType: 'PRECLINICAL', status: 'DRAFT' },
    create: {
      key: 'preclinical',
      displayName: 'Preclinical Bot',
      groupType: 'PRECLINICAL',
      status: 'DRAFT',
    },
  });
  const clinical = await prisma.bot.upsert({
    where: { key: 'clinical' },
    update: { displayName: 'Clinical Bot', groupType: 'CLINICAL', status: 'DRAFT' },
    create: {
      key: 'clinical',
      displayName: 'Clinical Bot',
      groupType: 'CLINICAL',
      status: 'DRAFT',
    },
  });
  return { preclinical, clinical };
}

async function upsertAcademicYears(botIds: { preclinical: string; clinical: string }) {
  const names = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
  for (const [index, ordinal] of names.entries()) {
    const number = index + 1;
    const academicYear = await prisma.academicYear.upsert({
      where: { number },
      update: {
        nameAr: `السنة ${ordinal}`,
        nameEn: `Year ${number}`,
        isActive: true,
        displayOrder: number,
      },
      create: {
        number,
        nameAr: `السنة ${ordinal}`,
        nameEn: `Year ${number}`,
        displayOrder: number,
      },
    });
    const botId = number <= 3 ? botIds.preclinical : botIds.clinical;
    await prisma.academicYearBot.upsert({
      where: { academicYearId_botId: { academicYearId: academicYear.id, botId } },
      update: {},
      create: { academicYearId: academicYear.id, botId },
    });
    for (const semesterOrder of [1, 2]) {
      await prisma.semester.upsert({
        where: {
          academicYearId_displayOrder: {
            academicYearId: academicYear.id,
            displayOrder: semesterOrder,
          },
        },
        update: {
          nameAr: `الفصل ${semesterOrder}`,
          nameEn: `Semester ${semesterOrder}`,
          isActive: true,
        },
        create: {
          academicYearId: academicYear.id,
          nameAr: `الفصل ${semesterOrder}`,
          nameEn: `Semester ${semesterOrder}`,
          displayOrder: semesterOrder,
        },
      });
    }
  }
}

async function upsertPermissions() {
  const records = new Map<string, { id: string }>();
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {
        description: `Allows ${key}.`,
        labelAr: key,
        labelEn: key,
        isReserved: reserved.has(key),
        isActive: true,
      },
      create: {
        key,
        description: `Allows ${key}.`,
        labelAr: key,
        labelEn: key,
        isReserved: reserved.has(key),
      },
      select: { id: true, key: true },
    });
    records.set(permission.key, permission);
  }
  return records;
}

async function upsertRoles(permissionRecords: Map<string, { id: string }>) {
  for (const details of roleDetails) {
    const role = await prisma.role.upsert({
      where: { key: details.key },
      update: { ...details, isActive: true },
      create: details,
    });
    const desired = rolePermissions[details.key] ?? [];
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { key: { notIn: desired } } },
    });
    for (const permissionKey of desired) {
      const permission = permissionRecords.get(permissionKey);
      if (!permission) throw new Error(`Missing permission ${permissionKey}`);
      if (details.key !== SUPER_ADMIN_ROLE_KEY && reserved.has(permissionKey)) {
        throw new Error(`Reserved permission ${permissionKey} cannot be seeded to ${details.key}`);
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function retireOwnerRole() {
  const owner = await prisma.role.findUnique({
    where: { key: 'owner' },
    include: { _count: { select: { admins: true } } },
  });
  if (!owner) return;
  if (owner._count.admins === 0) await prisma.role.delete({ where: { id: owner.id } });
  else
    await prisma.role.update({
      where: { id: owner.id },
      data: { isActive: false, isProtected: true },
    });
}

async function main() {
  const bots = await upsertBots();
  await upsertAcademicYears({ preclinical: bots.preclinical.id, clinical: bots.clinical.id });
  const permissions = await upsertPermissions();
  await upsertRoles(permissions);
  await retireOwnerRole();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unknown seed failure');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
