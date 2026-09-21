# Medical Telegram Platform

Production-oriented monorepo for two Telegram bots, a NestJS API, a PostgreSQL database, and an Arabic-first Next.js administration application. Phase 2 adds secure administrator authentication, authorization, administrator management, audit logging, and aggregate student statistics.

## Architecture

- `apps/api`: versioned NestJS API. It owns authentication, opaque sessions, CSRF validation, RBAC, scopes, audit events, and statistics.
- `apps/admin`: Next.js App Router dashboard. A same-origin route handler proxies browser requests to the API; no authentication value is stored in localStorage.
- `apps/bot-worker`: shared grammY worker for the preclinical and clinical bots.
- `packages/database`: Prisma schema, migrations, generated client exports, and idempotent seed.
- `packages/shared`: permission constants, password/email validation, and public response schemas.

## Prerequisites and setup

Use Node.js 22 LTS or newer, pnpm 9.x, and PostgreSQL 16. Copy `.env.example` to `.env`, then run:

```bash
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Start all applications with `pnpm dev`, or run `@medical/api`, `@medical/admin`, and `@medical/bot-worker` individually with pnpm filters.

## Authentication architecture

The NestJS API owns email/password authentication. Passwords use Argon2id with a 64 MiB memory cost, three iterations, and one lane. Email is trimmed and lower-cased before lookup and storage; the migration also adds a case-insensitive unique database index.

A successful login creates a cryptographically random opaque session token. Only its SHA-256 hash is stored in `AdminSession`. The raw token is sent in the `med_admin_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Sessions expire after `ADMIN_SESSION_TTL_SECONDS` (12 hours by default), are checked against the database on every protected request, and track last use.

Logout revokes the current server-side session. Disabling an administrator revokes all their sessions. Changing a password revokes every other session. After five failed attempts, a known active account is locked for 15 minutes; callers always receive the same invalid-credentials response.

### CSRF strategy

Each session has a second random CSRF value. Only its hash is stored in the database. The readable `med_admin_csrf` cookie must match the `X-CSRF-Token` header and the server-side hash for authenticated mutations. The Next.js proxy also rejects non-read requests whose `Origin` does not match the admin application. Direct API CORS accepts only `API_CORS_ORIGIN` with credentials.

Login and one-time account setup are unauthenticated JSON endpoints protected by the configured CORS boundary and same-origin proxy check. Setup credentials are submitted in the request body, never in a URL.

## First Super Admin

Seed roles and permissions first, then run this from the workspace root in an interactive terminal:

```bash
pnpm admin:bootstrap
```

The command prompts for email, display names, password, and confirmation. Password input is hidden and never printed or placed in shell history. It creates at most one initial Super Admin and safely reports the same-email existing account.

No password is seeded. Creating or recovering an additional Super Admin is intentionally not available through the dashboard. It requires a deliberate, reviewed database recovery procedure that preserves at least one active Super Admin and records an audit event.

## Super Admin and reserved permissions

`Super Admin` is the only highest operational role. The old `Owner` seed role is removed when unassigned; an assigned legacy row is retired as inactive and protected. The Super Admin role is a protected system role and cannot be assigned, edited, renamed, reduced, or deleted through the API.

These system-reserved permissions are seeded only into Super Admin:

- `students.stats.read`
- `content.usage-analytics.read`
- `broken-file-reports.read`
- `broken-file-reports.manage`
- `admins.read`
- `admins.create`
- `admins.update`
- `admins.disable`
- `admins.roles.assign`
- `roles.read`
- `roles.manage`
- `audit.read`

Role assignment rejects protected roles, inactive roles, and every role containing a reserved permission. Full custom-role editing is deliberately deferred; Phase 2 lists and safely assigns seeded secondary roles only.

## Administrators, roles, and scopes

A Super Admin can list/search administrators, create pending secondary accounts, update names/email, disable/reactivate accounts, assign allowed roles and bot/year/course scopes, revoke sessions, regenerate setup credentials, and inspect relevant audit history. Administrators are disabled rather than deleted. Self-disable and disabling the final active Super Admin are rejected.

Permissions answer what an administrator may do. Scopes answer where they may do it. An administrator with no scope rows has global scope for their permitted actions; otherwise `ScopeAuthorizationService` requires a matching bot, academic year, or course row. Controllers reuse authentication, permission, CSRF, and scope services instead of duplicating policy logic.

Creating or regenerating an account credential returns the raw random value exactly once. The database stores only its hash. It expires after 24 hours, is single-use, and older unused credentials are revoked. Because email delivery is not configured, the Super Admin must transfer it securely. It is never included in list/detail responses, audit JSON, logs, or URLs.

## Student statistics

`GET /api/v1/statistics/students` requires `students.stats.read` and returns aggregates only:

- Total unique students.
- Membership count per bot.
- Student count per selected academic year.
- New students: `firstSeenAt` within the last 30 days.
- Recently active students: `lastSeenAt` within the last 7 days.

The endpoint uses database count queries and relation counts, handles an empty database, and returns no individual student or Telegram data. Content popularity and broken-file metrics remain placeholders until their source events and workflows exist.

## Audit events

Phase 2 records successful and failed login, logout, password change, Super Admin bootstrap, administrator creation/update/disable/reactivation, role changes, scope changes, session revocation, setup completion, and setup-credential issue/regeneration. Management mutations and their audit rows share transactions where practical. Recursive redaction removes fields whose names indicate passwords, tokens, secrets, cookies, or authorization values.

Only callers with the reserved `audit.read` permission can access administrator audit history.

## Environment variables

Required or configurable values are documented in `.env.example`:

- `DATABASE_URL`
- `API_PORT`, `API_PREFIX`, `API_CORS_ORIGIN`
- `ADMIN_SESSION_TTL_SECONDS`
- `NEXT_PUBLIC_API_BASE_URL` for public API configuration
- `API_INTERNAL_BASE_URL` for server-side Next.js requests
- `SWAGGER_ENABLED`, `LOG_LEVEL`
- Bot worker enablement and token values

Use a deployment secret manager for real database credentials and Telegram tokens. Never commit `.env`.

## Database and checks

Phase 2 migration: `20260920220000_phase_2_admin_auth`.

```bash
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm format:check
```

## Intentionally deferred

Content CRUD, uploads, announcements, quizzes, production Telegram menus, popularity tracking, most-used course/file analytics, broken-file report workflows, custom-role editing, outbound setup email, deployment, and database-backed end-to-end tests remain outside Phase 2.
