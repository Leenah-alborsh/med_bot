# Ardu uploads and bounded upload lists

The frontend stays on its existing deployment, accessible through
`ardugaza.education` and `www.ardugaza.education`. No DNS or hosting migration is
required for this change.

## Direct uploads

Both exact Ardu HTTPS origins are trusted by API CORS, along with the configured
`API_CORS_ORIGIN` (which also accepts comma-separated exact origins). Arbitrary
origins and wildcards are not enabled. Uploads still require signed, content-bound
upload tickets and resource scope authorization. They do not send session cookies
to a different origin. File bytes go directly to the API, avoiding the frontend
hosting platform's multipart/function payload limits.

Server-rendered pages pass the API base URL to the upload client at runtime:
`API_PUBLIC_BASE_URL`, then a valid `API_INTERNAL_BASE_URL`, then
`NEXT_PUBLIC_API_BASE_URL`. Set `API_PUBLIC_BASE_URL` explicitly when the internal
API address is private. The base includes `/api`, without `/v1`. Production
configuration must use HTTPS; localhost/mixed-content upload destinations receive
an actionable error. No credential values are embedded in upload URLs.

Deploy both API and frontend. The Ardu CORS fix needs the new API to become Live.
Frontend catalog and upload metadata reads remain compatible with the previous
API during rollout. Failed API requests are not replaced with fake empty results.

## Confirmed performance issues addressed

Previously `/uploads` requested every eligible content item and all attachments,
and rendered a file input/form for every row, even rows hidden by local filters.
Now the API applies scope, filters, search, count, offset and a 25-item page before
fetching attachment lists. Dropdowns use separate location-only metadata, distinct
per category, rather than reading files for every possible option. Browser search
and filter application use a GET form; pagination preserves the applied filters.

The content page previously requested 100 catalog options at a time until all
options loaded; the catalog API re-read the full resource for every such page.
`catalog/options` loads each resource once, preserves its existing authorization,
and returns only option metadata instead of full descriptions and other fields.
No global cache of private data or permissions is introduced.

These are verified excessive-work patterns, not proof that they explain all
production latency. Database latency, slow queries and CPU/RAM saturation still
need production measurements before choosing larger hosting.

## Validation

- HTTP integration: preflight + signed multipart upload from both Ardu origins;
  unknown origins do not get CORS access and invalid tickets remain rejected.
- Query tests: database-level page bounds, filters and scope on item/options reads.
- Frontend tests: 25 rendered cards, full filter metadata, pagination and old-API
  rollout compatibility; API failures remain visible.
- Mobile Chromium smoke test using a local mock API with 1,000 total items:
  25 cards, next-page navigation, direct multipart upload and success state.
- Admin production build, API build and type checking. Local Prisma declarations
  were generated from the schema with Prisma's npm WASM/type generator tools to
  validate types without native engine downloads. Database-backed execution and
  real Telegram delivery were not verified in this environment.

## Upload-only admin accounts

The upload configuration endpoint accepts either `content.read` or
`content.update`, behind the existing authenticated session guard. Previously it
required `content.read`, even though upload targets and tickets require
`content.update`. This caused HTTP 403 while loading `/uploads` for upload-only
accounts. Actual HTTP guard tests cover readers, upload-only accounts and denied
unrelated roles.

The uploads page reports known API/network failures inside the dashboard instead
of throwing a generic server-render error. It identifies the failed dependency
and HTTP status without logging private response bodies, preserves authentication
redirects, and never presents failed loads as empty file lists.
