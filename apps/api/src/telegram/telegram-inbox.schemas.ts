import { z } from 'zod';

const id = z.string().uuid();
const name = z.string().trim().min(1).max(160);
const order = z.coerce.number().int().min(0).max(10000);

export const listTelegramInboxSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const newCourseSchema = z.object({
  semesterId: id,
  nameAr: name,
  nameEn: z.string().trim().max(160).optional(),
  displayOrder: order,
  hasSections: z.boolean().default(true),
});

const newSectionSchema = z.object({
  nameAr: name,
  nameEn: z.string().trim().max(160).optional(),
  displayOrder: order,
});

export const classifyTelegramInboxSchema = z
  .object({
    courseId: id.optional(),
    sectionId: id.optional(),
    newCourse: newCourseSchema.optional(),
    newSection: newSectionSchema.optional(),
    titleAr: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().max(200).optional(),
    descriptionAr: z.string().trim().max(4000).optional(),
    displayOrder: order,
    publish: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (Boolean(value.courseId) === Boolean(value.newCourse)) {
      context.addIssue({
        code: 'custom',
        path: ['courseId'],
        message: 'اختر مادة موجودة أو أنشئ مادة جديدة.',
      });
    }
    if (value.sectionId && value.newSection) {
      context.addIssue({
        code: 'custom',
        path: ['sectionId'],
        message: 'اختر قسمًا موجودًا أو أنشئ قسمًا جديدًا.',
      });
    }
  });

export type ListTelegramInboxInput = z.infer<typeof listTelegramInboxSchema>;
export type ClassifyTelegramInboxInput = z.infer<typeof classifyTelegramInboxSchema>;
