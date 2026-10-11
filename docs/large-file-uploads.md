# Large dashboard uploads

Dashboard files go directly from the browser to the NestJS API, using a signed upload ticket. The API streams each file to temporary disk, checks its hash, sends it to the private Telegram storage channel, stores Telegram identifiers in PostgreSQL and deletes the temporary file. Students receive the channel message or file ID through the bot. No manual channel upload is needed.

The cloud Bot API supports new documents up to 50,000,000 bytes. A self-hosted Bot API server running with `--local` supports up to 2,000,000,000 bytes. Both the webhook bot and the polling worker must use the same Bot API server.

## Setup

1. Sign in at https://my.telegram.org and open **API development tools**. Create an application to obtain `api_id` and `api_hash`. These are application credentials, separate from the BotFather token and channel ID. Keep them in `.env`; do not send them in chat or commit them.
2. Add these values to the root `.env`:

   ```dotenv
   TELEGRAM_API_ID=your_application_id
   TELEGRAM_API_HASH=your_application_hash
   TELEGRAM_LOCAL_API_ENABLED=true
   TELEGRAM_API_ROOT=http://127.0.0.1:8081
   MAX_UPLOAD_BYTES=2000000000
   TELEGRAM_UPLOAD_TIMEOUT_SECONDS=3600
   ```

3. Start Docker Desktop, then run from the repository root:

   ```powershell
   docker compose --profile telegram-local up -d --build telegram-bot-api
   ```

   The first build compiles Telegram's official source and may take several minutes. Its state is kept in a named volume. The host port is bound to localhost.

4. Stop the API and polling worker. Run the one-time migration from the repository root:

   ```powershell
   pnpm --filter @medical/api telegram:migrate-local
   ```

   This calls Telegram's cloud `logOut` method and checks `getMe` on the local server. Logging out affects the running bot, so perform this during the switch. Returning to the cloud may require waiting 10 minutes. If migration fails after logout, check local server connectivity before restarting.

5. Restart the API and admin dashboard, and the worker if polling is used. Keep only one update mode active. The dashboard reads the upload limit from the API at runtime; no public Telegram credentials or frontend environment changes are needed. Test a small PDF, then a file over 50 MB, and check that the student bot delivers both.

## Production hosting

The existing Render Blueprint remains in cloud mode (50 MB) until explicitly configured. Run the local Bot API on a persistent server, and set `TELEGRAM_API_ROOT`, `TELEGRAM_LOCAL_API_ENABLED=true`, `MAX_UPLOAD_BYTES` and the upload timeout in the API environment. Set the same API root on a polling worker if used. Never use localhost as the root when the API and Bot API run on different machines. For containers on one Docker network use `http://telegram-bot-api:8081`.

Large uploads require sufficient temporary disk in both services and an API host/proxy that accepts a 2 GB request and long connections. Allow at least the configured upload timeout and account for concurrent files and Telegram's local cache. The Telegram service accepts HTTP; use a private network or a TLS proxy for access from another machine. Keep its endpoint private because it exposes bot methods. Do not route large file bodies through the admin Next.js proxy.

Files are sent as streams, so the API and Bot API do not need a shared upload mount. Temporary application files are removed after success or failure. Telegram's own cache lives in the service volume and should be monitored separately. Interrupted uploads must be retried from the beginning; resumable uploads and a persistent background job queue are not part of this change.

References: https://core.telegram.org/bots/api#using-a-local-bot-api-server and https://github.com/tdlib/telegram-bot-api#usage.
