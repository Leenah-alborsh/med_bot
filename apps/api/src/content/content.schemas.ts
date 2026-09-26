import { z } from 'zod';

const id = z.string().uuid();
const optionalText = z.string().trim().max(4000).optional();
export const listContentSchema = z.object({
  search: z.string().trim().max(100).optional(),
  yearId: id.optional(),
  semesterId: id.optional(),
  courseId: id.optional(),
  sectionId: id.optional(),
  contentCategoryId: id.optional(),
  state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  type: z.enum(['TEXT', 'LINK', 'FILE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const contentBaseSchema = z.object({
  sectionId: id,
  contentCategoryId: id.optional(),
  titleAr: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional(),
  descriptionAr: optionalText,
  descriptionEn: optionalText,
  bodyText: z.string().trim().max(4000).optional(),
  contentType: z.enum(['TEXT', 'LINK', 'FILE']),
  displayOrder: z.coerce.number().int().min(0).max(10000),
});
export const contentInputSchema = contentBaseSchema.superRefine((value, context) => {
  if (value.contentType === 'TEXT' && !value.bodyText)
    context.addIssue({
      code: 'custom',
      path: ['bodyText'],
      message: 'Text content requires bodyText',
    });
});
export const contentUpdateSchema = contentBaseSchema.partial();
export const attachmentInputSchema = z
  .object({
    storageProvider: z.enum(['TELEGRAM', 'EXTERNAL_URL']),
    originalFilename: z.string().trim().min(1).max(255),
    externalUrl: z.string().trim().max(2048).optional(),
    telegramFileId: z
      .string()
      .trim()
      .min(20)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    mimeType: z.string().trim().min(1).max(120),
    fileSize: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  })
  .superRefine((value, context) => {
    if (value.storageProvider === 'EXTERNAL_URL' && !value.externalUrl)
      context.addIssue({
        code: 'custom',
        path: ['externalUrl'],
        message: 'External URL is required',
      });
    if (value.storageProvider === 'TELEGRAM' && !value.telegramFileId)
      context.addIssue({
        code: 'custom',
        path: ['telegramFileId'],
        message: 'Telegram file ID is required',
      });
  });
export const stateInputSchema = z.object({ state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) });
export type ListContentInput = z.infer<typeof listContentSchema>;
export type ContentInput = z.infer<typeof contentInputSchema>;
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;
