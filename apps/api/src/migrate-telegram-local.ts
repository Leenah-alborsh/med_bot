import { Api } from 'grammy';
import { resolveUploadEnvironment } from './config/environment.js';

async function migrate() {
  const config = resolveUploadEnvironment(process.env);
  const token = process.env.MEDICAL_BOT_TOKEN?.trim();
  if (!token || !config.TELEGRAM_LOCAL_API_ENABLED || !config.TELEGRAM_API_ROOT) {
    throw new Error(
      'Set MEDICAL_BOT_TOKEN, TELEGRAM_LOCAL_API_ENABLED=true and TELEGRAM_API_ROOT first',
    );
  }
  const reachable = await fetch(config.TELEGRAM_API_ROOT, { signal: AbortSignal.timeout(5000) });
  if (![200, 404].includes(reachable.status))
    throw new Error('Local Bot API server is unavailable');
  // Run once with the webhook API and polling worker stopped.
  const cloud = new Api(token);
  await cloud.logOut();
  const local = new Api(token, { apiRoot: config.TELEGRAM_API_ROOT });
  const me = await local.getMe();
  console.log(
    `Bot @${me.username} is ready on the local Bot API server. Restart the API or worker.`,
  );
}

void migrate().catch(() => {
  console.error(
    'Migration failed. Check local server connectivity and configuration. The bot may already be logged out of the cloud API; retry the local getMe check before restarting.',
  );
  process.exitCode = 1;
});
