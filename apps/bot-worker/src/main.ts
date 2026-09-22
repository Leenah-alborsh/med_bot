import { PrismaClient } from '@medical/database';
import { loadConfig } from './config.js';
import { createMedicalBot } from './bot/create-bot.js';

const LOCK_ID = 7_314_159;
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const config = loadConfig();
  if (!config.BOT_WORKER_ENABLED) {
    console.log('Bot worker disabled.');
    return;
  }
  if (!config.MEDICAL_BOT_TOKEN) throw new Error('BOT_WORKER_ENABLED requires MEDICAL_BOT_TOKEN');

  const prisma = new PrismaClient();
  const lock = await prisma.$queryRaw<
    Array<{ acquired: boolean }>
  >`SELECT pg_try_advisory_lock(${LOCK_ID}) AS acquired`;
  if (!lock[0]?.acquired) {
    console.warn('Another medical bot polling instance is active; exiting safely.');
    await prisma.$disconnect();
    return;
  }

  const bot = createMedicalBot({
    token: config.MEDICAL_BOT_TOKEN,
    prisma,
    uploadDirectory: config.UPLOAD_DIRECTORY,
  });
  await bot.init();
  const webhook = await bot.api.getWebhookInfo();
  if (webhook.url) {
    throw new Error('Telegram webhook is configured; polling cannot run at the same time.');
  }
  await prisma.bot.update({
    where: { key: 'medical-main' },
    data: { telegramUsername: bot.botInfo.username, status: 'ACTIVE' },
  });
  console.log({ botId: bot.botInfo.id, username: bot.botInfo.username, status: 'validated' });

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}; stopping bot worker.`);
    await bot.stop().catch(() => undefined);
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`.catch(() => undefined);
    await prisma.$disconnect();
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));

  while (!stopping) {
    try {
      await bot.start({
        drop_pending_updates: false,
        onStart: ({ id, username }) => console.log({ botId: id, username, status: 'polling' }),
      });
    } catch (error) {
      if (stopping) break;
      console.error({
        message: error instanceof Error ? error.message : 'Telegram polling failed',
        retrySeconds: 5,
      });
      await sleep(5000);
    }
  }
}

void main().catch((error: unknown) => {
  console.error({ message: error instanceof Error ? error.message : 'Bot worker failed to start' });
  process.exitCode = 1;
});
