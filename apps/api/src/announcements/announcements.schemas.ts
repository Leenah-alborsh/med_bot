import { z } from 'zod';

export const welcomeSchema = z.object({
  message: z.string().trim().min(1).max(1024),
  removePhoto: z
    .preprocess((value) => value === true || value === 'true', z.boolean())
    .default(false),
});
export const announcementSchema = z.object({
  message: z.string().trim().min(1).max(1024),
  yearIds: z.array(z.string().uuid()).max(6).default([]),
  useWelcomePhoto: z.boolean().default(false),
});
export type WelcomeInput = z.infer<typeof welcomeSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
