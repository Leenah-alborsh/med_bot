import { z } from 'zod';
import { emailSchema, passwordSchema } from '@medical/shared';

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const setupPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
