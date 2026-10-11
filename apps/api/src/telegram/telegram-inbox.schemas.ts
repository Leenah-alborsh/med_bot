import { z } from 'zod';

const id = z.string().uuid();
const order = z.coerce.number().int().min(0).max(10000);

export const listTelegramInboxSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const classifyTelegramInboxSchema = z.union([
  z.object({ contentItemId: id }).strict(),
  z
    .object({
      courseId: id,
      sectionId: id.optional(),
      contentCategoryId: id,
      titleAr: z.string().trim().min(1).max(200),
      titleEn: z.string().trim().max(200).optional(),
      descriptionAr: z.string().trim().max(4000).optional(),
      displayOrder: order,
      publish: z.boolean().default(false),
    })
    .strict(),
]);

export type ListTelegramInboxInput = z.infer<typeof listTelegramInboxSchema>;
export type ClassifyTelegramInboxInput = z.infer<typeof classifyTelegramInboxSchema>;
