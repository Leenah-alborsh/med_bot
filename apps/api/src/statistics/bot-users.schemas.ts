import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid date');

export const botUsersQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    from: date.optional(),
    to: date.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Start date must precede end date',
    path: ['to'],
  });

export type BotUsersQuery = z.infer<typeof botUsersQuerySchema>;

export function usageDateRange(query: BotUsersQuery) {
  return {
    ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
    ...(query.to
      ? { lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86_400_000) }
      : {}),
  };
}
