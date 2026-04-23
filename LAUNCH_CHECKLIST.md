# Fan Engage — Launch Checklist

Living document. Update this whenever a launch-blocking item is resolved or a
new one is discovered. Grouped by category so blockers are easy to scan.

Last updated: Phase 4c — admin refactor + activate Danger Twins, Dan Marshall, Hunter Hawkins

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
| **0013** | **`0013_paid_subscriptions.sql`** | **Stripe subscription state on fan_community_memberships, stripe_customer_id on fans, 4 price_ids + founder_cap on communities, badges.tier column, stripe_events idempotency log, credit_grants audit trail, Founding Fan badge seed** | **⏳ apply next** |

**How to apply:** Supabase dashboard → SQL Editor → paste raw file contents from
<https://github.com/KevinJonasSr/Superfan-platform/tree/main/supabase/migrations>
→ Run. Confirm the "destructive operations" dialog when it appears (it's always
just `drop policy if exists` / `drop trigger if exists` being safely idempotent).

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
| **`CRON_SECRET`** | Protects `/api/cron/send-event-reminders` from public hits | **⏳ set next** |
| **`ADMIN_BASIC_USER`** + **`ADMIN_BASIC_PASS`** | Optional extra HTTP Basic Auth on `/admin/*` | **⏳ optional** |
| **`NEXT_PUBLIC_APP_URL`** | Used in email unsubscribe links (defaults to `fan-engage-pearl.vercel.app` if unset) | **⏳ set before custom domain** |

Vercel env vars: <https://vercel.com/jonas-group/fan-engage/settings/environment-variables>

---

## 📋 Legal + compliance content

Policy pages and SMS webhook are already live — text is placeholder until
counsel returns the real copy.

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

## 🌐 Domain + production polish

- [ ] **Custom domain** — point a real domain (e.g. `fanengage.app`) at the Vercel project; add DNS records; set as primary
- [ ] **Update Supabase Site URL + redirect URLs** to the custom domain so auth magic links point to the right place
- [ ] **Update Mailchimp campaign from-domain** to match
- [ ] **Set `NEXT_PUBLIC_APP_URL`** to the custom domain so unsubscribe links use it
- [ ] **Favicon + OG image** — polish the social preview when someone shares a Fan Engage link

---

## 🎨 Content to finalize

- [ ] **Artist bios** — replace "Placeholder bio — awaiting final copy" in `/admin/artists/[slug]` for all 5 artists
- [ ] **Artist hero images** — upload real hero art via the admin editor
- [ ] **Tour dates** — replace "TBD" / "Dates to come" events with real tour dates once announced
- [ ] **Social links** — fill in TikTok, Spotify, Apple Music, Instagram per artist
- [ ] **Merchandise** — Phase 3 stashed this as "offers-per-artist" follow-up
- [ ] **Marketing landing / `/` copy** — the root route may need a sharper pitch for new visitors

---

## 🔒 Admin + security

- [ ] **`ADMIN_BASIC_USER` + `ADMIN_BASIC_PASS`** in Vercel (optional second password layer)
- [ ] **SSO / team accounts** — if other team members need admin access beyond the email allowlist
- [ ] **Audit log** — who did what in the admin UI (moderation actions, campaign sends, policy edits)
- [ ] **Rate limiting** on public API routes (`/api/upload`, `/api/fan-engage/*`) — upstash/ratelimit is cheap to add

---

## 📊 Observability

- [ ] **Error tracking** — Sentry or Vercel's built-in logs; decide + wire up
- [ ] **Uptime monitoring** — especially for the cron (Vercel Crons logs are minimal)
- [ ] **Email + SMS deliverability dashboard** — surface bounce/complaint rates inside `/admin/analytics`

---

## 📈 Nice-to-have before scale

- [ ] **Per-artist Mailchimp segmentation** — email blasts still go to whole audience; SMS is already per-artist/event
- [ ] **Offers-per-artist + marketplace integration** — connect campaign-created offers to artist pages
- [ ] **Fan Home personalization** — live feed of followed artists' activity
- [ ] **Weekly digest cron** — another scheduled blast ("your artists this week")
- [ ] **In-app notifications inbox** — badge earns, RSVP confirmations, challenge wins, new campaigns
- [ ] **PWA manifest** — add-to-home-screen, offline shell
- [ ] **Leaderboards** — per-artist top fans by points / referrals
- [ ] **Onboarding welcome email + SMS** — fire a welcome message right after signup
- [ ] **Data export + delete-account** (CCPA/GDPR self-serve)

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
