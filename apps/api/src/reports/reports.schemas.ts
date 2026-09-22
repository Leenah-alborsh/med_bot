import { z } from 'zod';
export const reportListSchema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const reportUpdateSchema = z.object({
  status: z.enum(['REVIEWED', 'RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(2000).optional(),
});
export const usageSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'Invalid date range');
