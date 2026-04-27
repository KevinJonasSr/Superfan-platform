# Fan Engage — Collaborator Guide

Welcome. This is the working manual for engineers contributing to the Fan Engage / Superfan Platform. It covers what the project is, how to get access, how to run the code locally, and the conventions we follow. Treat this as a living doc — update it whenever a setup step or convention changes.

---

## What this is

Fan Engage is the multi-tenant fan-club platform powering Jonas Group artist communities. Today it serves:

- **RaeLynn** (live community, real fans, real Stripe subscriptions in test mode)
- **Danger Twins**, **Dan Marshall**, **Hunter Hawkins** (activated, content + heroes still being filled in)

It's pre-public-launch. The single source of truth for what's done and what's left is `LAUNCH_CHECKLIST.md` at the repo root — read that before anything else.

**Live URLs**

- Public app: <https://fan-engage-pearl.vercel.app/>
- Admin: <https://fan-engage-pearl.vercel.app/admin> (HTTP Basic Auth + email allowlist)
- GitHub repo: <https://github.com/KevinJonasSr/Superfan-platform>
- Vercel project: <https://vercel.com/jonas-group/fan-engage>
- Supabase project: <https://supabase.com/dashboard/project/uhovonrljcauaoctypbg>

---

## Access checklist

Walk through these before writing any code. Kevin (kevinjonassr@gmail.com) grants access on each platform.

| # | Platform | What you need | How |
|---|---|---|---|
| 1 | **GitHub** | Push access to `KevinJonasSr/Superfan-platform` (full collaborator) | Kevin → Repo → Settings → Collaborators → Add collaborator → your GitHub username → Write role |
| 2 | **Vercel** | Member of the `jonas-group` team with access to the `fan-engage` project | Kevin → Vercel Dashboard → jonas-group → Settings → Members → Invite Member → your email |
| 3 | **Supabase** | Member of `KevinJonasSr's Org` with access to the `Fan Engage` project | Kevin → Supabase Dashboard → Organization → Team → Invite member → your email → Developer role |
| 4 | **Stripe (test)** | Optional — only if you'll work on subscriptions / webhooks | Kevin → Stripe Dashboard → Settings → Team → Invite member |
| 5 | **Mailchimp** | Optional — only if you'll work on email campaigns | Kevin → Mailchimp → Account → Users → Invite user |
| 6 | **Twilio** | Optional — only if you'll work on SMS / reminders | Kevin → Twilio Console → Admin → Manage users |

Once you accept the GitHub, Vercel, and Supabase invites, you can do most day-to-day work. Stripe, Mailchimp, and Twilio are read-only for most contributors.

---

## Tech stack

| Layer | What | Notes |
|---|---|---|
| App framework | **Next.js 16 (App Router)** | Server Components by default; `"use client"` only for interactivity |
| Language | **TypeScript** | Strict mode |
| Styling | **Tailwind CSS** | Utility classes only — no CSS modules |
| DB / Auth / Storage | **Supabase** (Postgres + Auth + Storage) | Service-role admin client for server-side writes |
| Payments | **Stripe** (test mode until launch) | Subscriptions, webhooks, founder slots |
| Email | **Mailchimp** | Audience tagging, automation triggers |
| SMS | **Twilio** | Per-event reminders, STOP/HELP compliance |
| Hosting | **Vercel** | Auto-deploy on push to `main`, Vercel Crons for the reminder cron |

---

## Repo layout

```
Superfan-platform/
├── frontend/                    Next.js app (the only app right now)
│   ├── app/                     Routes (App Router)
│   │   ├── admin/               Admin surfaces (gated by ADMIN_EMAILS + Basic Auth)
│   │   ├── artists/[slug]/      Public artist pages, community, events, rewards, founders
│   │   ├── api/                 Route handlers (cron, twilio webhook, stripe webhook, upload)
│   │   ├── onboarding/          Profile creation flow
│   │   └── page.tsx             Fan Home (the / route)
│   ├── components/              Shared components (FanHomeDashboard, PremiumPaywall, etc.)
│   ├── lib/                     Server-side data layer + helpers
│   │   ├── data/                One file per domain: artists, fan, fan-home, events, etc.
│   │   ├── supabase/            Server + admin client factories
│   │   ├── use-form-save.tsx    Retry-on-503 hook (read this!)
│   │   ├── reminders.ts         Event reminder send logic
│   │   ├── stripe.ts            Stripe helpers
│   │   └── ...
│   └── package.json
├── supabase/
│   └── migrations/              Numbered SQL files (0001..0022 today)
├── LAUNCH_CHECKLIST.md          Read this first
├── CLAUDE.md                    Notes for the AI agent (optional reading)
└── COLLABORATING.md             You are here
```

---

## Local dev setup

You can do most work via the GitHub web editor + Vercel preview deploys (zero local setup), but a local environment is faster.

### Prerequisites

- **Node 20+** (recommended via [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- **npm** (ships with Node) or **pnpm** if you prefer
- **Git**

### Steps

```bash
# 1. Clone
git clone https://github.com/KevinJonasSr/Superfan-platform.git
cd Superfan-platform/frontend

# 2. Install
npm install

# 3. Create .env.local — copy values from Vercel
#    Dashboard → fan-engage → Settings → Environment Variables → reveal each
cp .env.example .env.local   # if there's a template; otherwise create it
# Fill in the values listed in the next section

# 4. Run
npm run dev
# Open http://localhost:3000
```

### Required env vars (copy from Vercel)

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API | Browser-safe DB URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API | Server-only admin key (do not expose) |
| `MAILCHIMP_API_KEY` | Mailchimp → Account → Extras → API keys | Email subscribe + broadcast |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp dashboard URL prefix (`us21`, etc.) | Server region |
| `MAILCHIMP_AUDIENCE_ID` | Mailchimp → Audience → Settings | Default audience |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account info | SMS auth |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account info | SMS auth |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio Console → Messaging → Services | Outbound sender pool |
| `ADMIN_EMAILS` | Comma-separated list (yours should be in it) | Allowlist for `/admin/*` |
| `CRON_SECRET` | Random string in Vercel | Protects `/api/cron/*` |
| `ADMIN_BASIC_USER` / `ADMIN_BASIC_PASS` | Set by Kevin | Extra HTTP auth on `/admin/*` |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (test) | Stripe server-side |
| `STRIPE_SEED_SECRET` | Random string | Bootstrap endpoint guard |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → endpoint | Verifies webhook signatures |
| `NEXT_PUBLIC_APP_URL` | Optional; defaults to the Vercel URL | Used in unsubscribe links |

To grab them quickly: Vercel project → Settings → Environment Variables → click the eye icon on each → copy. Or use the Vercel CLI: `vercel env pull .env.local`.

---

## Deployment workflow

1. **Push to `main` → Vercel auto-deploys** in ~60–90 seconds. There's no PR review gate (full-trust collaboration model). Use clear commit messages.
2. **Migrations run via Supabase SQL Editor**, not via the app: open the project → SQL Editor → New query → paste the contents of the next `supabase/migrations/00XX_*.sql` file → Run. Migrations are idempotent (`drop policy if exists` / `create table if not exists` patterns).
3. **No staging environment** today. Vercel preview deploys exist for every branch but they share the production Supabase. Be careful with destructive changes.

### Commit message convention

We use conventional commits where they help:

```
feat(fan-home): broaden upcoming-events query
fix(admin/events): EditEventForm now refreshes after save
docs: bump checklist for Phase 8 work
```

Not strictly enforced, but it makes the commit log scannable.

---

## Code conventions

### Server Components by default

Files in `app/` and `components/` are server-rendered unless you add `"use client"` at the top. Reach for client components only when you need:

- Interactivity (state, event handlers, refs)
- Browser APIs
- React hooks like `useState`, `useEffect`, `useFormSave`

### Server Actions: return `{success}` / `{error}`, not `redirect()`

Cold-start 503s on Vercel intermittently kill Server Action POSTs, and React silently swallows the failure. We added a `useFormSave` hook (`frontend/lib/use-form-save.tsx`) that retries with a fetch probe and surfaces real errors. **Server actions called from `useFormSave` must NOT call `redirect()`** — that throws `NEXT_REDIRECT`, which the hook treats as a failure and retries. Instead, return `{ success: true, ...payload }` and let the client handle navigation.

```ts
// ✅ DO
export async function updateThingAction(formData: FormData) {
  await requireAdmin();
  const { error } = await supa.from("things").update(...);
  if (error) return { error: error.message };
  revalidatePath("/admin/things");
  return { success: true as const };
}

// ❌ DON'T
export async function updateThingAction(formData: FormData) {
  await supa.from("things").update(...);
  redirect("/admin/things"); // breaks retry loops in useFormSave
}
```

Action that just `revalidatePath()` and return `void` are fine for fire-and-forget click buttons (use `<ModerationButton>` for those).

### Form pattern

Use `<form onSubmit={handler}>` not `<form action={handler}>` — the `action` prop has hydration quirks in Next.js 16 that can produce a `javascript:throw` sentinel. The `onSubmit` pattern works reliably with `useFormSave`:

```tsx
"use client";
import { useFormSave, SaveStatusIndicator } from "@/lib/use-form-save";

export default function MyForm() {
  const router = useRouter();
  const { status, submit, submitting } = useFormSave({
    onSuccess: () => router.refresh(),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await submit(myServerAction, fd);
    if (result?.success) router.push("/somewhere");
    else if (result?.error) /* show inline error */;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* fields */}
      <button disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
      <SaveStatusIndicator status={status} />
    </form>
  );
}
```

### Click-action buttons (delete, suspend, pin)

Use the `<ModerationButton>` wrapper at `frontend/app/admin/community/moderation-button.tsx` — it covers typed-arg actions with the same retry + status pattern:

```tsx
<ModerationButton
  action={someAction}
  fields={{ id: someId }}
  label="Delete"
  variant="delete"
  confirmMessage="Are you sure?"
/>
```

### Multi-tenancy

Every fan-scoped table has a `community_id text not null default 'raelynn'` column (added in `0011_multi_tenant.sql`). When inserting new rows, include `community_id`. When querying, filter by it. Right now `community_id` always equals `artist_slug` for tenant rows, but they're separate columns by design.

### Image uploads

`/api/upload` accepts files up to 4 MB (Vercel body limit). The `image-uploader.tsx` component compresses client-side. Don't bypass either — the server caps and the client compress are belt-and-braces.

### Datetime handling

`<input type="datetime-local">` does NOT carry a timezone. The browser displays whatever time string is supplied as if it's local. We currently store `starts_at` as a `timestamptz` and the form round-trips ISO strings. If you change a show time in the UI, double-check the saved value matches expectations.

---

## Key files / patterns to know

| File | Why it matters |
|---|---|
| `LAUNCH_CHECKLIST.md` | Source of truth for launch state. Update when you ship. |
| `frontend/lib/use-form-save.tsx` | Retry-on-503 hook for Server Action POSTs. |
| `frontend/app/admin/community/moderation-button.tsx` | Reusable typed-arg click action. |
| `frontend/lib/data/fan-home.ts` | The whole `/` data layer in one file. |
| `frontend/lib/data/artists.ts` | Artist + events queries used across public + admin. |
| `frontend/lib/reminders.ts` | Reminder send logic invoked by the cron. |
| `frontend/app/admin/artists/[slug]/page.tsx` | Reference example of admin CRUD with EditableEventRow + CreateEventForm. |
| `supabase/migrations/0011_multi_tenant.sql` | The community_id model — read before touching schema. |
| `supabase/migrations/0015_premium_gating.sql` | `community_posts.visibility` + `artist_events.tier`. |

---

## Known issues / gotchas

- **Cold-start 503s on Server Action POSTs** — mitigated by `useFormSave`, but root cause still open (see Observability in `LAUNCH_CHECKLIST.md`). Symptom: form looks like it saved but the data wasn't persisted.
- **Image upload limit is really 4 MB**, not 8 MB — Vercel rejects bodies >4.5 MB before the function runs. The `/api/upload` cap of 8 MB is moot.
- **Datetime-local inputs don't carry timezone** — see code conventions above.
- **`active=false` events still show in admin** — set the flag to hide from the public artist page without deleting (the public query filters; the admin query doesn't).
- **Migrations are run by hand** in the Supabase SQL Editor. There's no migration runner. If you add a migration file, ship the file in a commit AND apply it manually before any code that depends on it goes live.
- **Bandsintown affiliate links get stripped** by the security filter in our test environment. Real ticket URLs work in production fetches.

---

## Quick wins to onboard

Pick something small to get the workflow muscle memory:

1. Read `LAUNCH_CHECKLIST.md` end to end. ~10 min.
2. Run the app locally and sign in with your jonasgroup.com email (you should land in `/admin` thanks to the allowlist).
3. Pick an item from the **Save reliability — useFormSave hook rollout** section's "Remaining unprotected" list and apply the pattern. Each is ~30 minutes once you've seen one example. Reference: any of the `useFormSave`-using forms (e.g. `frontend/app/admin/artists/[slug]/edit-form.tsx`).
4. Or pick a **Nice-to-have** item — they're all scoped and have rough estimates.

---

## How we collaborate

- **Push directly to `main`** — full-trust model, no PR gate. Read your diff before pushing.
- **Update `LAUNCH_CHECKLIST.md`** when you ship something user-visible or change the launch readiness.
- **Coordinate before schema changes** — migrations are sensitive. Ping Kevin/the team before adding `00XX_*.sql` files.
- **Coordinate before deleting data** — DELETEs in production go through Supabase SQL Editor with `RETURNING *` so we can see what came out.
- **Pair on tricky areas** — the multi-tenant model, premium gating, and the Stripe webhook are the three places where a wrong move can corrupt state. Loop someone in.

---

## Communication channels

_Kevin to fill in:_

- Slack / iMessage thread:
- Standup cadence:
- Async update channel:
- Emergency / on-call:

---

## Resources

- Next.js App Router docs: <https://nextjs.org/docs/app>
- Supabase docs: <https://supabase.com/docs>
- Tailwind docs: <https://tailwindcss.com/docs>
- Stripe docs (subscriptions): <https://stripe.com/docs/billing/subscriptions/overview>
- Twilio Programmable Messaging: <https://www.twilio.com/docs/messaging>
- Mailchimp Marketing API: <https://mailchimp.com/developer/marketing/api/>

Welcome to the team — let's ship.
