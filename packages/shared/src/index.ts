import { z } from 'zod';

export const botGroupTypes = ['PRECLINICAL', 'CLINICAL'] as const;
export const botStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const adminStatuses = ['PENDING', 'ACTIVE', 'DISABLED'] as const;
export const preferredLanguages = ['ar', 'en'] as const;

export const permissionKeys = [
  'bots.read',
  'bots.manage',
  'catalog.read',
  'catalog.create',
  'catalog.update',
  'catalog.archive',
  'content.read',
  'content.create',
  'content.update',
  'content.archive',
  'content.publish',
  'announcements.send',
  'students.stats.read',
  'content.usage-analytics.read',
  'broken-file-reports.read',
  'broken-file-reports.manage',
  'admins.read',
  'admins.create',
  'admins.update',
  'admins.disable',
  'admins.roles.assign',
  'roles.read',
  'roles.manage',
  'audit.read',
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export const reservedPermissionKeys = [
  'students.stats.read',
  'content.usage-analytics.read',
  'broken-file-reports.read',
  'broken-file-reports.manage',
  'admins.read',
  'admins.create',
  'admins.update',
  'admins.disable',
  'admins.roles.assign',
  'roles.read',
  'roles.manage',
  'audit.read',
] as const satisfies readonly PermissionKey[];

export const SUPER_ADMIN_ROLE_KEY = 'super-admin';

export type BotGroupType = (typeof botGroupTypes)[number];
export type BotStatus = (typeof botStatuses)[number];
export type AdminStatus = (typeof adminStatuses)[number];
export type PreferredLanguage = (typeof preferredLanguages)[number];

export const telegramTokenSchema = z.string().min(20).max(256);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'Password requires a lowercase letter')
  .regex(/[A-Z]/, 'Password requires an uppercase letter')
  .regex(/[0-9]/, 'Password requires a number')
  .regex(/[^A-Za-z0-9]/, 'Password requires a symbol');

export const apiHealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  app: z.object({ uptimeSeconds: z.number(), timestamp: z.string() }),
  database: z.object({ status: z.enum(['ok', 'error']) }),
});

export const adminSummarySchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  displayNameAr: z.string(),
  displayNameEn: z.string(),
  status: z.enum(adminStatuses),
  mustChangePassword: z.boolean(),
  permissions: z.array(z.enum(permissionKeys)),
});

export type ApiHealth = z.infer<typeof apiHealthSchema>;
export type AdminSummary = z.infer<typeof adminSummarySchema>;
