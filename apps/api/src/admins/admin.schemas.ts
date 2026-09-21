import { z } from 'zod';
import { emailSchema } from '@medical/shared';

const name = z.string().trim().min(2).max(100);
export const listAdminsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});
export const createAdminSchema = z.object({
  email: emailSchema,
  displayNameAr: name,
  displayNameEn: name,
  roleIds: z.array(z.string().uuid()).default([]),
});
export const updateAdminSchema = z
  .object({
    email: emailSchema.optional(),
    displayNameAr: name.optional(),
    displayNameEn: name.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const statusSchema = z.object({ active: z.boolean() });
export const rolesSchema = z.object({ roleIds: z.array(z.string().uuid()).max(20) });
export const scopesSchema = z.object({
  botIds: z.array(z.string().uuid()).max(20).default([]),
  academicYearIds: z.array(z.string().uuid()).max(20).default([]),
  courseIds: z.array(z.string().uuid()).max(100).default([]),
});
export type ListAdminsInput = z.infer<typeof listAdminsSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
export type RolesInput = z.infer<typeof rolesSchema>;
export type ScopesInput = z.infer<typeof scopesSchema>;
