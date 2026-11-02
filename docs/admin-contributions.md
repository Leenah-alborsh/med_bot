# Monthly admin contributions and attachment access

Super Admins can open **مساهمات المشرفين** (`/contributions`) and choose a month.
The API requires both an authenticated session and `audit.read`; the report service
also explicitly requires the `super-admin` role. Ordinary admins cannot query the
report by changing a URL.

Months follow `Asia/Hebron`, with inclusive start and exclusive next-month start.
A contribution percentage is an admin's Telegram attachment count divided by the
team's attributed Telegram attachment count in that month. Channel inbox
classification/attachment counts as a contribution by the admin who classifies it.
External links are excluded. Counts include drafts and published/archived content;
permanently deleted attachments cannot be counted from current attachment rows.
Historical attachments with no uploader are reported separately, never guessed.
This is a volume metric, not a quality score, time tracker, or reward payout.

Successful content/catalog/inbox/report audit operations are counted separately.
Authentication events are excluded. Per-admin details contain 20 files per page
and the latest 50 matching audit events in the selected month. No schema migration
is required. New manually attached files now also record `uploadedById`.

The content and upload pages expose authenticated attachment links, including
published content. Downloads check the content scope and attachment membership.
Readers can open scoped content; upload-only admins can open only their own scoped
uploads. File bytes stream through the API and admin proxy; Telegram bot tokens
and token-bearing download URLs never go to the browser. Safe media may display
inline; other types download as attachments, with private/no-store and nosniff
headers. External URLs redirect only after existing URL validation; the admin proxy
does not follow redirects with session cookies.

Telegram cloud Bot API download limits still apply. On a failed Telegram download,
a known original channel message provides a fallback; admins must already have
channel access. Absolute Local Bot API filesystem paths are not read from the
application host. Files without retrievable bytes or channel metadata return an
availability error. No copies are retained on the application disk.

Validation: run the API contribution/attachment/Telegram streaming test suites,
the admin tests, admin type checking, and the admin production build. Full API
checking requires the generated Prisma client. In the onboarding machine,
`binaries.prisma.sh` is blocked; generation and database-backed verification remain
unavailable until its saved network requirement is applied.
