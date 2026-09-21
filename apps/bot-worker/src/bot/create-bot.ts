import { Bot } from 'grammy';

export type ManagedBotConfig = {
  key: 'preclinical' | 'clinical';
  displayName: string;
  token: string;
};

export function createManagedBot(config: ManagedBotConfig) {
  const bot = new Bot(config.token);

  bot.command('start', async (context) => {
    await context.reply(
      `Welcome to ${config.displayName}. Dynamic database menus will be available in a later phase.`,
    );
  });

  bot.command('health', async (context) => {
    await context.reply(`${config.displayName} worker is running.`);
  });

  bot.catch((error) => {
    console.error({
      botKey: config.key,
      message: error.error instanceof Error ? error.error.message : 'Unknown bot error',
    });
  });

  return bot;
}
