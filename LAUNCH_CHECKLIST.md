# Launch checklist — deferred items

Items that are **not blocking** day-to-day use but need to be done before a
full public launch. Keep this file in git so nothing gets lost across sessions.

## 🔒 Admin Basic Auth (extra password layer on `/admin/*`)

The admin surface already has three protection layers:

1. Next.js middleware redirects unauthenticated users to `/login?next=/admin`
2. Supabase auth (magic-link email sign-in)
3. `ADMIN_EMAILS` allowlist check in `lib/admin.ts#getAdminUser()`

There is also a **fourth optional layer** — HTTP Basic Auth at the edge via
`middleware.ts` — that is not yet enabled. When turned on, the browser prompts
for a username + password **before** any admin page loads, even before
Supabase auth gets a chance to run.

**To enable:**

1. Go to <https://vercel.com/jonas-group/fan-engage/settings/environment-variables>
2. Add two env vars to the Production environment:
   - `ADMIN_BASIC_USER` — pick a username
   - `ADMIN_BASIC_PASS` — pick a strong password
3. Trigger a redeploy (push any commit, or click "Redeploy" on the latest deploy)
4. Verify: incognito window → `https://fan-engage-pearl.vercel.app/admin` →
   browser should pop a native "Sign in to Fan Engage Admin" dialog

If either env var is missing, the Basic Auth layer is bypassed and the other
three layers still enforce protection.

## 🤖 Cron secret for automated event reminders

Phase 3c adds a Vercel Cron that runs every 15 minutes to fire 24h + 1h
event reminders via SMS + email. The cron endpoint is protected by an
optional bearer token — set `CRON_SECRET` in Vercel and Vercel Cron
automatically attaches it to every invocation.

**To enable:**

1. Go to <https://vercel.com/jonas-group/fan-engage/settings/environment-variables>
2. Add `CRON_SECRET` (pick a long random string)
3. Redeploy so the cron route picks up the value
4. Confirm the cron is scheduled: <https://vercel.com/jonas-group/fan-engage/crons>
   — should list `/api/cron/send-event-reminders` with `*/15 * * * *`

If the secret isn't set the route runs without auth, which is fine for
dev/preview but a security hole in production.

## Other launch-time TODOs
_(Add items here as they come up.)_
