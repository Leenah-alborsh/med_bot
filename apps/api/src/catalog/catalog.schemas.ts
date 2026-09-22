import { z } from 'zod';

const id = z.string().uuid();
const text = z.string().trim().min(1).max(160);
const order = z.coerce.number().int().min(0).max(10000);

export const listCatalogSchema = z.object({
  search: z.string().trim().max(100).optional(),
  yearId: id.optional(),
  semesterId: id.optional(),
  courseId: id.optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const yearInputSchema = z.object({
  number: z.coerce.number().int().min(1).max(20),
  nameAr: text,
  nameEn: text,
  displayOrder: order,
  isActive: z.boolean().default(true),
});
export const semesterInputSchema = z.object({
  academicYearId: id,
  nameAr: text,
  nameEn: text,
  displayOrder: order,
  isActive: z.boolean().default(true),
});
export const courseInputSchema = z.object({
  semesterId: id,
  nameAr: text,
  nameEn: text,
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  displayOrder: order,
  isActive: z.boolean().default(true),
});
export const sectionInputSchema = z.object({
  courseId: id,
  parentId: id.nullable().optional(),
  nameAr: text,
  nameEn: text,
  displayOrder: order,
  isActive: z.boolean().default(true),
});
export const catalogUpdateSchema = z.object({
  nameAr: text.optional(),
  nameEn: text.optional(),
  descriptionAr: z.string().trim().max(2000).nullable().optional(),
  descriptionEn: z.string().trim().max(2000).nullable().optional(),
  displayOrder: order.optional(),
  isActive: z.boolean().optional(),
});

export type ListCatalogInput = z.infer<typeof listCatalogSchema>;
