import { z } from 'zod';

const tokenSchema = z.string().trim().min(1).optional();

function telegramApiRoot(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const root = value.trim();
  return root.includes('://') ? root : 'http://' + root;
}

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MEDICAL_BOT_TOKEN: tokenSchema,
  TELEGRAM_API_ROOT: z.preprocess(telegramApiRoot, z.string().url().optional()),
  UPLOAD_DIRECTORY: z.string().trim().min(1).default('./var/uploads'),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid bot worker environment: ${parsed.error.message}`);
  }

  return parsed.data;
}
