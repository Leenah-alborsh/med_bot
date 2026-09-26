import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 2_000_000_000;

function telegramApiRoot(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const root = value.trim();
  return root.includes('://') ? root : 'http://' + root;
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().optional(),
    API_PORT: z.coerce.number().int().positive().default(3001),
    API_PREFIX: z.string().min(1).default('api'),
    API_CORS_ORIGIN: z.string().default('http://localhost:3000'),
    ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(2_592_000).default(43_200),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    TELEGRAM_WEBHOOK_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(32).max(256).optional(),
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
    RENDER_EXTERNAL_URL: z.string().url().optional(),
    MEDICAL_BOT_TOKEN: z.string().trim().min(1).optional(),
    TELEGRAM_API_ROOT: z.preprocess(telegramApiRoot, z.string().url().optional()),
    TELEGRAM_FILE_CHANNEL_ID: z
      .string()
      .trim()
      .regex(/^-100[0-9]+$/)
      .optional(),
    ADMIN_UPLOAD_TOKEN_SECRET: z.string().min(32).max(256).optional(),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_UPLOAD_BYTES)
      .default(MAX_UPLOAD_BYTES),
    UPLOAD_DIRECTORY: z.string().trim().min(1).default('./var/uploads'),
  })
  .superRefine((environment, context) => {
    if (!environment.TELEGRAM_WEBHOOK_ENABLED) return;
    if (!environment.MEDICAL_BOT_TOKEN)
      context.addIssue({
        code: 'custom',
        path: ['MEDICAL_BOT_TOKEN'],
        message: 'Required for webhook mode',
      });
    if (!environment.TELEGRAM_WEBHOOK_SECRET)
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'Required for webhook mode',
      });
    if (!environment.TELEGRAM_WEBHOOK_URL && !environment.RENDER_EXTERNAL_URL)
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_WEBHOOK_URL'],
        message: 'Webhook URL is required',
      });
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(config);
  if (!parsed.success) throw new Error(`Invalid API environment: ${parsed.error.message}`);
  return parsed.data;
}
