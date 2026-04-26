# Fan Engage — Launch Checklist

Living document. Update this whenever a launch-blocking item is resolved or a new one is discovered. Grouped by category so blockers are easy to scan.

Last updated: April 26, 2026 — Fan Home now surfaces the next 3 upcoming events from any followed artist (no RSVP required) + Recent Activity renders kind chip + body fallback so all post types display, not just titled ones; admin events list gained a per-row ✏️ Edit affordance with a full inline form (title, dates, location, capacity, URL, sort order, active flag); useFormSave hook earlier rolled out to most write surfaces (artist edit/create, rewards CRUD, redemption fulfill/refund, event create, community composer, community moderation, fan suspend); hero image crop fixed (object-position center 30%)

---

## 🗄️ Supabase migrations to apply

| # | File | Adds | Status |
|---|---|---|---|
| 0001 | `0001_init.sql` | Fans, points, tiers, badges, referrals, offers, purchases | ✅ applied |
| 0002 | `0002_community.sql` | community_posts, reactions, comments | ✅ applied |
| 0003 | `0003_community_phase2.sql` | Polls, challenge entries | ✅ applied |
| 0004 | `0004_badges_and_storage.sql` | 13 starter badges, avatars, buckets, triggers | ✅ applied |
| 0005 | `0005_campaigns_and_moderation.sql` | Campaigns, CTAs, fan suspend | ✅ applied |
| 0006 | `0006_artists_and_following.sql` | DB-backed artists, events, per-artist following | ✅ applied |
| 0007 | `0007_events_rsvp.sql` | Event capacity, RSVPs, point trigger | ✅ applied |
| 0008 | `0008_event_reminders.sql` | event_reminders for cron de-dupe | ✅ applied |
| 0009 | `0009_legal_infrastructure.sql` | policy_pages, consent, unsub tokens | ✅ applied |
| 0010 | `0010_notifications.sql` | notifications table, award_badge fan-out, RSVP + referral triggers | ✅ applied |
| 0011 | `0011_multi_tenant.sql` | communities, fan_community_memberships, admin_users, community_id on every scoped table, Street Team auto-enrollment trigger | ✅ applied |
| 0012 | `0012_activate_artists.sql` | Activate Danger Twins / Dan Marshall / Hunter Hawkins communities + seed matching artists rows with brand accents | ✅ applied |
| 0013 | `0013_paid_subscriptions.sql` | Stripe subscription state on fan_community_memberships, stripe_customer_id on fans, 4 price_ids + founder_cap on communities, badges.tier column, stripe_events idempotency log, credit_grants audit trail, Founding Fan badge seed | ✅ applied |
| 0014 | `0014_founder_slot.sql` | claim_founder_slot() Postgres function — race-safe founder number assignment via per-community advisory lock | ✅ applied |
| 0015 | `0015_premium_gating.sql` | community_posts.visibility + artist_events.tier columns, is_premium() + points_multiplier() helper functions | ✅ applied |
| 0016 | `0016_points_multiplier_wireup.sql` | 4 community triggers × 1.5 multiplier for premium fans | ✅ applied |
| 0017 | `0017_points_multiplier_wireup_pt2.sql` | RSVP + fan-action triggers × 1.5 | ✅ applied |
| 0018 | `0018_award_community_badge.sql` | Cascade badge insert + points + notification | ✅ applied |
| 0019 | `0019_founder_only_tier.sql` | Widens visibility/tier checks + is_founder() helper | ✅ applied |
| 0020 | `0020_cancellation_refund_policy.sql` | Seed cancellation policy | ✅ applied |
| 0021 | `0021_rewards_redemption.sql` | rewards_catalog + reward_redemptions tables + redeem_reward() RPC + 4 seeded rewards | ✅ applied |
| 0022 | `0022_community_videos.sql` | video_url + video_poster_url columns + community-videos bucket | ✅ applied |

**How to apply:** Supabase dashboard → SQL Editor → paste raw file contents from <https://github.com/KevinJonasSr/Superfan-platform/tree/main/supabase/migrations> → Run. Confirm the "destructive operations" dialog when it appears (it's always just `drop policy if exists` / `drop trigger if exists` being safely idempotent).

---

## 🔐 Vercel env vars to set

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase connection | ✅ set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ set |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-scoped Supabase operations | ✅ set |
| `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID` | Email subscribe + broadcast | ✅ set |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | SMS outbound | ✅ set |
| `ADMIN_EMAILS` | Allowlist for `/admin/*` access | ✅ set |
| `CRON_SECRET` | Protects `/api/cron/send-event-reminders` from public hits | ✅ set |
| `ADMIN_BASIC_USER` + `ADMIN_BASIC_PASS` | Optional extra HTTP Basic Auth on `/admin/*` | ✅ set |
| `STRIPE_SECRET_KEY` | Stripe server-side API key (test mode until launch) | ✅ set |
| `STRIPE_SEED_SECRET` | Bearer token for `/api/admin/stripe-seed` bootstrap endpoint | ✅ set |
| `STRIPE_WEBHOOK_SECRET` | Verifies signatures on `/api/stripe/webhook` — copy from Stripe dashboard → Developers → Webhooks → endpoint → Signing secret | ✅ set |
| **`NEXT_PUBLIC_APP_URL`** | Used in email unsubscribe links (defaults to `fan-engage-pearl.vercel.app` if unset) | **⏳ set before custom domain** |

Vercel env vars: <https://vercel.com/jonas-group/fan-engage/settings/environment-variables>

---

## 📋 Legal + compliance content

Policy pages and SMS webhook are already live — text is placeholder until counsel returns the real copy.

- [ ] **Terms of Service** — paste final copy into `/admin/policies/terms`, set `effective_date`, uncheck DRAFT
- [ ] **Privacy Policy** — paste final copy into `/admin/policies/privacy`, set `effective_date`, uncheck DRAFT
- [ ] **Cookie Policy** — paste final copy into `/admin/policies/cookie_policy`, set `effective_date`, uncheck DRAFT
- [ ] **Terms audit** — confirm references to Fan Engage, Anthropic, Supabase, Twilio, Mailchimp all match what we actually do
- [ ] **Privacy — data retention + deletion** — lawyer to confirm retention periods (account deletion, post retention, referral log retention)
- [ ] **DMCA / content takedown policy** — if user-uploaded images become a real volume
- [ ] **SMS 10DLC brand + campaign registration** (US carrier requirement) — submit via Twilio Console
- [ ] **Twilio inbound webhook** — point Messaging Service inbound URL to `https://fan-engage-pearl.vercel.app/api/twilio/inbound` so STOP/HELP compliance actually fires. Verify a real STOP message flips the opt-in flag.
- [ ] **COPPA** — if we expect under-13 users, need parental consent flow. Current ToS draft says 13+; confirm with counsel.
- [ ] **Mailchimp welcome automation** — we now tag every new fan with `welcome` at signup (Phase 3e). Configure a Mailchimp Automation in the dashboard to fire a welcome email when the `welcome` tag is applied. Suggested copy: "Welcome to Fan Engage — here's how to earn your first 100 points" with a CTA back to `/artists`.

---

## 🛡️ Save reliability — useFormSave hook rollout

Vercel cold starts intermittently return 503 on Server Action POSTs, which React silently swallows — the form looks like it saved but the data wasn't persisted. The `useFormSave` hook (`frontend/lib/use-form-save.tsx`) wraps Server Actions in retry-on-503 + visible status feedback, surfacing real errors instead of fake successes. Reusable `ModerationButton` (`frontend/app/admin/community/moderation-button.tsx`) covers click-action buttons.

**Already protected (Apr 26, 2026):**

- [x] Artist edit (`/admin/artists/[slug]` ArtistEditForm)
- [x] Artist create (`/admin/artists` CreateArtistForm)
- [x] Reward create (`/admin/rewards/new` NewRewardForm)
- [x] Reward edit (`/admin/rewards/[id]` EditRewardForm)
- [x] Redemption fulfill / refund (`/admin/redemptions` RedemptionAction)
- [x] Event create (`/admin/artists/[slug]` CreateEventForm)
- [x] Community composer (`/artists/[slug]/community` NewPostForm — post / announcement / poll / challenge)
- [x] Admin community moderation (`/admin/community` — pin/unpin, delete post, delete comment, delete entry)
- [x] Fan suspend / unsuspend (`/admin/fans/[id]` ModerationButton)

**Remaining unprotected — recommended before public launch:**

- [ ] **Event delete + send-reminder** — `/admin/artists/[slug]/page.tsx` still has two `<form action={X}>` buttons inside the events list. Replace with `<ModerationButton>`.
- [ ] **Founders admin** — `/admin/founders/*` whatever click actions exist there (claim/revoke/comp).
- [ ] **Challenges admin** — `/admin/challenges/*` create/edit/delete forms.
- [ ] **Offers admin** — `/admin/offers/*` create/edit/delete forms.
- [ ] **Policies admin** — `/admin/policies/*` save/publish/draft toggles.
- [ ] **Campaigns admin** — `/admin/campaigns/*` create/send/archive flows.
- [ ] **Authentication forms** — login, signup, magic-link request. Lower priority because failures here are usually clearly visible (no auth = redirect loop), but worth doing for consistency.
- [ ] **Onboarding profile form** — `/onboarding/*` whatever form sets first_name + city + DOB. Same silent-503 risk on profile creation.
- [ ] **Marketplace purchase / Stripe Checkout buttons** — these go through Stripe so are mostly Stripe's responsibility, but the "create checkout session" server action is ours and could 503.

**Pattern (for any future contributor):**

For form submits with FormData:

```tsx
import { useFormSave, SaveStatusIndicator } from "@/lib/use-form-save";

const { status, submit, submitting } = useFormSave({
  onSuccess: () => router.refresh(),
});

async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const result = await submit(myServerAction, fd);
  if (result?.success) router.push("/somewhere");
  else if (result?.error) setBusinessError(result.error);
}

return (
  <form onSubmit={handleSubmit}>
    ...
    <SaveStatusIndicator status={status} />
    <button disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
  </form>
);
```

For typed-arg click buttons (toggle, delete, suspend):

```tsx
import ModerationButton from "@/app/admin/community/moderation-button";

<ModerationButton
  action={someAction}
  fields={{ id: someId }}
  label="Delete"
  variant="delete"
  confirmMessage="Sure?"
/>
```

**Server-action contract:** when refactoring, change actions that previously called `redirect()` on success to instead `return { success: true, ...payload }`. The hook treats `redirect()` as a thrown error and would mistakenly retry. Actions that just `revalidatePath()` and return void are fine as-is.

**Lesson learned:** ship coupled refactors as a single multi-file commit. Splitting actions.ts into one commit and the caller into another causes the intermediate deploy to fail TypeScript compile (the action's new return type mismatches the form's old contract). Production recovers when the second commit lands, but the deploy history shows red rows.

---

## 🌐 Domain + production polish

- [ ] **Custom domain** — point a real domain (e.g. `fanengage.app`) at the Vercel project; add DNS records; set as primary
- [ ] **Update Supabase Site URL + redirect URLs** to the custom domain so auth magic links point to the right place
- [ ] **Update Mailchimp campaign from-domain** to match
- [ ] **Set `NEXT_PUBLIC_APP_URL`** to the custom domain so unsubscribe links use it
- [ ] **Favicon + OG image** — polish the social preview when someone shares a Fan Engage link

---

## 🎨 Content to finalize

- [x] **RaeLynn bio** — replaced placeholder with full copy + Luke Bryan select-date opener line
- [x] **RaeLynn hero image** — leopard-coat-at-barn photo uploaded; rendered in artist page hero section
- [x] **RaeLynn accent colors** — retuned from pink/yellow to honey gold → deep espresso brown to match leopard palette
- [x] **Hero image crop fix** — `objectPosition: center 30%` on the wide hero so faces stay visible; `object-top` on 3:4 portrait strip + directory cards
- [ ] **Other artist bios** — replace "Placeholder bio — awaiting final copy" in `/admin/artists/[slug]` for Danger Twins, Dan Marshall, Hunter Hawkins
- [ ] **Other artist hero images** — Danger Twins still uses gradient fallback (Dan and Hunter already have heroes)
- [ ] **Tour dates** — replace "TBD" / "Dates to come" events with real tour dates once announced
- [ ] **Social links** — fill in TikTok, Spotify, Apple Music, Instagram per artist
- [ ] **Merchandise** — Phase 3 stashed this as "offers-per-artist" follow-up
- [ ] **Marketing landing / `/` copy** — the root route may need a sharper pitch for new visitors

---

## 🔒 Admin + security

- [x] **`ADMIN_BASIC_USER` + `ADMIN_BASIC_PASS`** in Vercel (optional second password layer)
- [x] **Jonas Group team admin access** — kevinjonassr@gmail.com, carla@jonasgroup.com, raymond@jonasgroup.com, paul@jonasgroup.com, george@jonasgroup.com all in `ADMIN_EMAILS` allowlist
- [ ] **SSO / team accounts** — if other team members need admin access beyond the email allowlist
- [ ] **Audit log** — who did what in the admin UI (moderation actions, campaign sends, policy edits)
- [ ] **Rate limiting** on public API routes (`/api/upload`, `/api/fan-engage/*`) — upstash/ratelimit is cheap to add
- [ ] **Image upload limit enforcement** — `image-uploader.tsx` resizes to <4 MB client-side, but the `/api/upload` route also has an 8 MB cap that's currently moot because Vercel rejects bodies >4.5 MB before the function runs. Either bump the cap to match Vercel's reality or document the truth.

---

## 📊 Observability

- [ ] **Error tracking** — Sentry or Vercel's built-in logs; decide + wire up
- [ ] **Uptime monitoring** — especially for the cron (Vercel Crons logs are minimal)
- [ ] **Email + SMS deliverability dashboard** — surface bounce/complaint rates inside `/admin/analytics`
- [ ] **503 root-cause investigation** — the cold-start 503s that drove the useFormSave rollout are still happening in the background; the hook just papers over them. Worth diagnosing properly: confirm Vercel deployment region matches Supabase region, audit `getAdminUser()` for extra DB round-trips, consider Supabase pooler URL.

---

## 📈 Nice-to-have before scale

- [ ] **Per-artist Mailchimp segmentation** — email blasts still go to whole audience; SMS is already per-artist/event
- [ ] **Offers-per-artist + marketplace integration** — connect campaign-created offers to artist pages
- [x] **Fan Home personalization** — live feed of followed artists' activity (Phase 5 work; photo-forward artist cards shipped Apr 26)
- [ ] **Weekly digest cron** — another scheduled blast ("your artists this week")
- [ ] **In-app notifications inbox** — badge earns, RSVP confirmations, challenge wins, new campaigns
- [ ] **PWA manifest** — add-to-home-screen, offline shell
- [ ] **Leaderboards** — per-artist top fans by points / referrals
- [ ] **Onboarding welcome email + SMS** — fire a welcome message right after signup
- [ ] **Data export + delete-account** (CCPA/GDPR self-serve)
- [ ] **Per-artist hero focal-point control** — currently every wide hero uses `objectPosition: center 30%` as a global default, which works for most portrait artist photos but not all (subjects framed lower than typical, group shots, landscape-oriented portraits, etc.). Add a `hero_focal_y` smallint column (0–100, default 30) to the `artists` table, surface it in the `/admin/artists/[slug]` edit form (a slider or a numeric input next to the hero uploader, ideally with a live preview rendering of the chosen crop), and read it in `frontend/app/artists/[slug]/page.tsx` as `style={{ objectPosition: \`center ${artist.heroFocalY ?? 30}%\` }}`. Optional: add `hero_focal_x` too if landscape photos ever need horizontal repositioning. Estimated work: ~1 hour (one small migration + one form field + one render-line change).
- [ ] **Fan Home Recent Activity expansion** — the data layer (`frontend/lib/data/fan-home.ts`) already pulls the 5 most recent community posts from followed artists, but the dashboard (`frontend/components/fan-home-dashboard.tsx` `<RecentActivityFeed>`) only renders the top 3. Two related upgrades worth picking up post-launch: (1) bump the visible count to 5 — trivial change to `posts.slice(0, 3)` — and/or raise the data layer's `.limit(8)` if we want a deeper feed; (2) add a "View all activity →" link at the bottom of the card that routes to a new per-fan activity index page (e.g. `/activity` or `/feed`) showing every recent post across followed artists, paginated, with body bodies and reactions. The index page would basically be a cross-artist version of `/artists/[slug]/community`. Estimated work: ~2 hours for the link + index page; ~5 minutes for the count bump on its own.

---

## ✅ Done

Recorded for the paper trail:

- Phase 1 — Core platform (fan home, rewards, marketplace, referrals, community, invite/QR)
- Phase 2a — Community Hub (polls, challenges, announcements, reactions, comments)
- Phase 2b — Auto-awarded badges + Supabase Storage image uploads
- Phase 2c — Admin dashboard + campaigns + CTAs + moderation + 3-layer security
- Phase 3a — DB-backed artists + editor + per-artist following
- Phase 3b — Event RSVPs + capacity + .ics + per-event campaign audiences
- Phase 3c — Automated 24h + 1h reminders via Vercel Cron
- Phase 3d — Policy pages (DRAFT) + cookie banner + footer + onboarding consent + unsubscribe + Twilio STOP webhook
- Phase 5a — Premium tier gating (community posts visibility, event tier)
- Phase 5b — Stripe subscriptions + founder slots + paid memberships
- Phase 5c — Points multipliers + cancellation policy
- Phase 5d — Premium paywall + body-gate on premium posts
- Phase 5e — Founder-only tier + monthly credits + admin founder roster + analytics
- Phase 6 — Rewards redemption (catalog + RPC + admin queue + fan UI) + Hero image upload + Public Founder Wall
- Phase 7 — Save reliability (useFormSave + retry-on-503 + visible status across primary admin write surfaces)
- Phase 8 — Fan Home discovery polish (top-3 upcoming events from any followed artist regardless of RSVP, Recent Activity kind chips + body fallback so non-titled posts surface, admin events list gained per-row ✏️ Edit with full inline form including active toggle)
