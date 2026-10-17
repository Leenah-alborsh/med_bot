# Bot user analytics

The dashboard's **مستخدمو البوت** (`/bot-users`) section and both
`GET /api/v1/statistics/bot-users` and `GET /api/v1/statistics/bot-users/:id`
are restricted to the `super-admin` role. Statistics permissions alone do not
grant access to user identities or personal activity histories.

The list supports name, username, Telegram ID, date range, and pagination.
User details show requested content, its course/section, action counts, and the
latest 25 interactions. Content history is paginated independently.

## Counting rules

- A session starts with the first recorded interaction and after at least 30
  minutes without a recorded interaction. Repeating `/start` within that interval
  increments the start count without creating a new session.
- Merely opening a Telegram conversation cannot be measured by this bot.
- Interaction events contain action codes, membership IDs, timestamps, and
  Telegram update IDs. They do not contain message text.
- A per-membership row lock serializes event creation, and a unique membership /
  update ID constraint prevents duplicate counts on Telegram redelivery.
- Existing content access records remain visible. Session and interaction totals
  start when this change is deployed; historical sessions are not inferred.
- Link and file events describe content requests/delivery, not confirmed browser
  clicks or downloads to the user's device.
- Date filters use UTC calendar days, including the complete end date. Displayed
  timestamps use `Asia/Hebron`. The 24-hour and 7-day active-user cards are global
  rolling counts, independent of filters, as labeled in the UI.

## Deployment

Apply `20261017120000_bot_usage_events` before running the updated API or worker:

```sh
pnpm --filter @medical/database db:migrate:deploy
pnpm --filter @medical/database db:generate
```

Rebuild/redeploy the API, bot worker, and admin. The repository's Render build
command already deploys migrations before building the API/worker. The admin
must also be deployed to expose the new navigation and pages.

Verification: sign in as a super admin and open `/bot-users`; interact with the
bot, then refresh the page and inspect the user history. A secondary admin
should be redirected from either page and receive HTTP 403 from either API.
