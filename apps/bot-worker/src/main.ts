import { loadConfig } from './config.js';
import { createManagedBot, type ManagedBotConfig } from './bot/create-bot.js';

function getConfiguredBots(): ManagedBotConfig[] {
  const config = loadConfig();

  if (!config.BOT_WORKER_ENABLED) {
    console.log('Bot worker disabled. Set BOT_WORKER_ENABLED=true to start polling.');
    return [];
  }

  const candidates: Array<ManagedBotConfig | null> = [
    config.PRECLINICAL_BOT_TOKEN
      ? {
          key: 'preclinical',
          displayName: 'Preclinical Bot',
          token: config.PRECLINICAL_BOT_TOKEN,
        }
      : null,
    config.CLINICAL_BOT_TOKEN
      ? {
          key: 'clinical',
          displayName: 'Clinical Bot',
          token: config.CLINICAL_BOT_TOKEN,
        }
      : null,
  ];

  const bots = candidates.filter((bot): bot is ManagedBotConfig => bot !== null);

  if (bots.length === 0) {
    console.warn('Bot worker enabled, but no bot tokens were provided.');
  }

  return bots;
}

function main() {
  const bots = getConfiguredBots().map((config) => ({
    key: config.key,
    bot: createManagedBot(config),
  }));

  const stop = async (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}; stopping bot worker.`);
    await Promise.all(bots.map(({ bot }) => bot.stop().catch(() => undefined)));
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    void stop('SIGTERM');
  });

  for (const { key, bot } of bots) {
    void bot
      .start({
        onStart: ({ username }) => {
          console.log({ botKey: key, username, status: 'started' });
        },
      })
      .catch((error: unknown) => {
        console.error({
          botKey: key,
          message: error instanceof Error ? error.message : 'Failed to start bot',
        });
      });
  }
}

void main();
