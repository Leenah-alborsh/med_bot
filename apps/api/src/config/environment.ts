import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 50_000_000;
export const LOCAL_MAX_UPLOAD_BYTES = 2_000_000_000;

export const uploadEnvironmentSchema = z
  .object({
    TELEGRAM_LOCAL_API_ENABLED: z.enum(['true', 'false']).default('false'),
    TELEGRAM_API_ROOT: z.preprocess(
      (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
      z.string().trim().url().optional(),
    ),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
    TELEGRAM_UPLOAD_TIMEOUT_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  })
  .transform((value, context) => {
    const local = value.TELEGRAM_LOCAL_API_ENABLED === 'true';
    const limit = local ? LOCAL_MAX_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
    if (
      local &&
      (!value.TELEGRAM_API_ROOT || new URL(value.TELEGRAM_API_ROOT).hostname === 'api.telegram.org')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_API_ROOT'],
        message: 'A self-hosted Bot API URL is required for local mode',
      });
    }
    if (
      value.TELEGRAM_API_ROOT &&
      !['http:', 'https:'].includes(new URL(value.TELEGRAM_API_ROOT).protocol)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_API_ROOT'],
        message: 'Use an HTTP or HTTPS Bot API URL',
      });
    }
    if ((value.MAX_UPLOAD_BYTES ?? limit) > limit) {
      context.addIssue({
        code: 'custom',
        path: ['MAX_UPLOAD_BYTES'],
        message: `Upload limit cannot exceed ${limit} bytes in this mode`,
      });
    }
    return {
      ...value,
      TELEGRAM_LOCAL_API_ENABLED: local,
      MAX_UPLOAD_BYTES: value.MAX_UPLOAD_BYTES ?? limit,
    };
  });

export function resolveUploadEnvironment(config: Record<string, unknown>) {
  return uploadEnvironmentSchema.parse(config);
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
    TELEGRAM_API_ROOT: z.string().optional(),
    TELEGRAM_LOCAL_API_ENABLED: z.string().optional(),
    TELEGRAM_UPLOAD_TIMEOUT_SECONDS: z.coerce.number().optional(),
    TELEGRAM_FILE_CHANNEL_ID: z
      .string()
      .trim()
      .regex(/^-100[0-9]+$/)
      .optional(),
    ADMIN_UPLOAD_TOKEN_SECRET: z.string().min(32).max(256).optional(),
    MAX_UPLOAD_BYTES: z.coerce.number().optional(),
    UPLOAD_DIRECTORY: z.string().trim().min(1).default('./var/uploads'),
  })
  .transform((environment, context) => {
    const upload = uploadEnvironmentSchema.safeParse(environment);
    if (!upload.success) {
      for (const issue of upload.error.issues) context.addIssue(issue);
      return z.NEVER;
    }
    return { ...environment, ...upload.data };
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
    if (!environment.TELEGRAM_FILE_CHANNEL_ID)
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_FILE_CHANNEL_ID'],
        message: 'Required for Telegram Channel Inbox',
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
