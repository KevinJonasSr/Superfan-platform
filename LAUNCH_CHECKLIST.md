# Fan Engage — Launch Checklist

Living document. Update this whenever a launch-blocking item is resolved or a new one is discovered. Grouped by category so blockers are easy to scan.

Last updated: April 26, 2026 — **Signup unblocked** (migration 0023 patches `award_badge` 42P10 — every fan signup since 0011 had been failing silently); Fan Home now surfaces the next 3 upcoming events from any followed artist (no RSVP required) + Recent Activity renders kind chip + body fallback so all post types display, not just titled ones; admin events list gained a per-row ✏️ Edit affordance with a full inline form; useFormSave hook earlier rolled out to most write surfaces; hero image crop fixed (object-position center 30%)

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
| 0023 | `0023_fix_award_badge_delegate.sql` | Patch award_badge(uuid, text) — delegates to award_community_badge to fix 42P10 ON CONFLICT mismatch that was rejecting every signup since 0011 | ✅ applied |

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
- [ ] **Platform-wide badges architecture** — migration 0023 (`0023_fix_award_badge_delegate.sql`) shipped a tactical fix for the signup 42P10 by having `award_badge(uuid, text)` delegate to `award_community_badge(uuid, text, text)` with a hard-coded `community_id = 'raelynn'`. This works because every historical `fan_badges` row is already scoped to `'raelynn'` (the table's column default), but it's architecturally wrong: badges like `welcome`, `tier-bronze`, `recruiter`, `first-post`, `first-comment`, etc. are platform-wide achievements, not RaeLynn-specific ones. Two clean ways to fix it post-launch: (a) add a `'platform'` (or `'*'`) row to the `communities` table and use that as the default for non-scoped badges — minimal schema change, ~30 minutes including a backfill `update fan_badges set community_id = 'platform' where badge_slug in (...)`; or (b) split into separate `platform_badges` (one row per fan per badge) + `community_badges` (one row per fan per badge per community) tables — more correct data model but requires a migration that re-shards existing rows + updates every read path. Either way, also worth adding a `badges.scope` column with values `'platform' | 'community'` so the data layer can route awards to the right table/community without hard-coded slug lists. Tracker for the delegation hack: see migration 0023 header comment.

## 📧 Mailchimp digest field length watch (Phase 4)

After the first few weekly digest sends, monitor whether the
`*|DIGESTHTML|*` merge field is being truncated by Mailchimp.
Symptoms: emails arrive with HTML cut off mid-element (e.g. an open
`<div>` with no closing tag, a link href that ends abruptly), or the
"reward suggestion" / later community blocks missing entirely from
fans who follow 3 active communities.

**Why this might happen:** Mailchimp Standard plans cap custom text
merge fields at 255 chars by default. The Phase 4 digest renders
HTML in the 800-3,500 char range per fan — fits for fans with one
sparse community, breaks for fans with 3 active communities + a
reward block.

**Watch query (run weekly):**

```sql
-- Distribution of HTML body lengths
select width_bucket(length(html_body), 0, 6000, 6) as bucket,
       count(*) as digests,
       round(avg(length(html_body))) as avg_chars
from public.digest_log
where status in ('sent', 'merge_fields_updated')
  and sent_at > now() - interval '14 days'
group by 1 order by 1;

-- Specific digests over Mailchimp's likely truncation point
select fan_id, length(html_body), array_length(payload_communities, 1) as communities,
       array_length(payload_post_ids, 1) as posts
from public.digest_log
where length(html_body) > 1500
order by length(html_body) desc limit 20;
```

**If truncation is happening, three options ranked by impact / effort:**

- [ ] **Option A — Upgrade Mailchimp plan** (lowest effort, fastest
      fix). Standard tier may cap merge fields at 255-1000 chars
      depending on grandfathered settings; Premium tier raises this.
      Verify the actual limit on the Jonas Group account by trying
      to bump the field length in the Mailchimp UI:
      https://us16.admin.mailchimp.com/audience/merge-fields/?id=554139
      → click `…` next to "Digest HTML Block" → Edit → look for a
      "Max length" or character-limit field. If it's editable, just
      raise it. If it's not editable, that's a plan-level cap and
      upgrading is the path. ~$0-50/mo additional cost.
- [ ] **Option B — Switch to Mandrill (Mailchimp Transactional)** —
      separate Mailchimp product, ~$10/mo for 5k transactional
      emails. Designed for per-recipient HTML; no merge-field length
      cap. Refactor `frontend/lib/digest/send.ts` to call the
      transactional API instead of the campaign API + merge-field
      pattern. ~30 minutes of work, plus signup + API key in env.
      The campaign template HTML in `send.ts` becomes the per-send
      HTML; no campaign-level Mailchimp template needed.
- [ ] **Option C — Split into multiple shorter merge fields** —
      stay on Marketing API, decompose `DIGESTHTML` into ~10
      smaller fields (`DG_VIBE_1`, `DG_POST_1A`, `DG_EVT_1A`, etc.)
      and a richer template in Mailchimp. More code work (~2 hours),
      no plan upgrade, but the template becomes rigid (every fan
      needs the same shape; one missing community = empty section).
      Save this for if A and B don't make sense.

**Recommendation:** start with A — try editing the merge field's
max length in the Mailchimp UI and see if Mailchimp lets you raise
it. If yes, problem solved at zero cost. If no, B is the cleanest
upgrade path.

---

## 🤖 AI roadmap pause gate

After Phase 4 (weekly digest emails), Fan Engage has four shipped AI
features in flight: embedding pipeline (#1), moderation classifier
(#2), drafter (#3), digest emails (#4). Before adding more AI surface
area (Phase 5+ — auto-tagging posts, semantic search, reward
recommendations, smart reminders, etc.), wait until the shipped
features have ~2 weeks of real engagement data and validate the
hypotheses on each:

- [ ] **Drafter (#3)** — does it actually lift comment volume on
      posts where the ✨ button is shown? Target from the recs doc:
      +30% comment volume. Run the queries in the "📈 AI feature
      metrics — drafter A/B (Phase 3)" section below. If lift is
      <10%, fix the drafter (better prompt, more prominent button,
      regen sub-buttons) before shipping more AI features.
- [ ] **Digest (#4)** — does it actually move retention? Track
      Mailchimp open rate (target: >25%), click-through (target:
      >5%), 7-day return-to-app rate among recipients (target:
      +15% vs. non-recipients). If the digest doesn't lift any of
      these, the rec doc's claim that "personalized weekly briefing
      is the highest-leverage email" was wrong for this audience —
      pause the cron and rethink before shipping #5+.
- [ ] **Moderation (#2)** — does the classifier under-flag (toxic
      content reaches the community) or over-flag (admins drown in
      false positives)? Audit `/admin/moderation` once a week:
      review every `flag_review` decision, override the wrong
      ones. The override rate IS the eval signal — bump
      `PROMPT_VERSION` in `frontend/lib/moderation/client.ts` if
      override rate >25%.
- [ ] **Embeddings (#1)** — passive infrastructure; nothing to
      validate until a downstream feature (search, recs) reads it.
      Just check `select count(*) from public.content_embeddings`
      keeps growing with new posts.

The AI recs doc has 16 more features queued (#5–#20). Don't ship
any of them until the data above looks healthy. The cost of
shipping more half-validated features is feature dilution +
moderation overhead + AI bill creep, none of which are worth it
without proof the pattern works.

Tracker file: `FAN_ENGAGE_AI_RECOMMENDATIONS.md` (full roadmap).
Operational docs: `docs/AI_INFRASTRUCTURE.md` (per-phase setup,
costs, failure modes).

---

## 🏷️ AI feature metrics — auto-tagging (Phase 5)

Use these queries after the tagging cron has had a few weeks of real
posts to validate the closed-vocabulary classifier is calibrated +
to surface re-classification opportunities.

### Backfill health (run anytime — should trend toward zero)

```sql
select
  count(*) filter (where tagged_at is not null) as tagged,
  count(*) filter (where tagged_at is null
                   and (moderation_status is null or moderation_status != 'auto_hide')
                   and length(coalesce(body,'')) > 0) as pending,
  count(*) filter (where tagged_at is null
                   and moderation_status = 'auto_hide') as skipped_auto_hide
from public.community_posts;
```

`pending` should be near zero — anything stuck means the cron is
failing. Check Vercel runtime logs for `/api/cron/tags-backfill`.

### Tag distribution per community

```sql
select p.artist_slug, t.tag, count(*) as n
from public.community_posts p, unnest(p.tags) as t(tag)
where p.tagged_at is not null
group by 1, 2
order by 1, n desc;
```

Watch for two failure modes:
  * **Over-concentrated** — one community has >40% of posts tagged
    `other`. Means the closed vocabulary doesn't cover what fans are
    actually posting about. Bump `TAG_PROMPT_VERSION` and add 1-3 new
    canonical tags.
  * **Mono-tag bias** — one tag (e.g. `live_show`) covers >60% of a
    community's posts. Either it's the right call (artist literally
    only posts about shows) or the classifier is reaching for a
    fallback. Sample 10 rows tagged with that value and confirm.

### Filter chip preview (what fans will see)

```sql
select * from public.list_top_tags_for_community('raelynn', 12);
```

Repeat per artist. The chip count + ordering on the live community
page should match exactly.

### Re-classification on prompt-version bump

When you bump `TAG_PROMPT_VERSION` in `frontend/lib/tagging/client.ts`
(e.g. after adding new vocabulary tags), mark stale rows for re-tagging:

```sql
update public.community_posts
set tagged_at = null
where tag_prompt_version is null
   or tag_prompt_version != 'v2';  -- the new version
```

The backfill cron picks them up within 15 min and re-tags. Cost: same
as the original backfill (~\$0.0001 per row).

### Drafter / tagging cross-check (post-launch insight)

Once both the drafter (Phase 3) and tagger (Phase 5) have data, you
can correlate them — drafted comments tend to land on which kind of
posts? Useful for validating the drafter's A/B lift hypothesis is
specifically about engaging content vs. just shorter posts:

```sql
-- Comment volume by post tag, split by drafter usage
select t.tag,
       count(*) as comments,
       count(*) filter (where c.draft_used) as drafted,
       round(100.0 * count(*) filter (where c.draft_used) / nullif(count(*), 0), 1) as drafted_pct
from public.community_comments c
join public.community_posts p on p.id = c.post_id, unnest(p.tags) as t(tag)
where c.created_at > now() - interval '14 days'
  and p.tagged_at is not null
group by 1
order by comments desc;
```

If `drafted_pct` is wildly different across tags (e.g. 50% on
`fan_question` posts but 5% on `tour_announcement`), that's a real
signal — the drafter helps members engage with question-style posts
more than announcement-style ones, which informs both the drafter
prompt and the surfacing logic.

---

## 📈 AI feature metrics — drafter A/B (Phase 3)

Use these queries after the comment drafter has been live for a few
weeks to validate the rec doc's +30% comment-volume hypothesis (see
`FAN_ENGAGE_AI_RECOMMENDATIONS.md` recommendation #3 and
`docs/AI_INFRASTRUCTURE.md` Phase 3).

### Most recent comments (sanity check that draft_used is being recorded)

```sql
select id, body, draft_used, created_at
from public.community_comments
order by created_at desc
limit 10;
```

### A/B comparison (works once you have ~50+ comments)

```sql
select draft_used,
       count(*)                  as comments,
       avg(length(body))::int    as avg_chars
from public.community_comments
where created_at > now() - interval '14 days'
group by 1;
```

### Drafter usage rate (proxy for whether members find the ✨ button)

```sql
select 100.0 * count(*) filter (where draft_used)
       / nullif(count(*), 0) as drafter_share_pct
from public.community_comments
where created_at > now() - interval '14 days';
```

Reading the result: < 10% drafter share = button isn't being seen
(consider making it more prominent on the post card). > 40% = members
love it (consider improving draft quality, adding regenerate-per-chip
sub-buttons, etc.). Anywhere in between is good enough to keep
shipping more AI features on top.

---

## 🔍 AI feature metrics — semantic search (Phase 6)

Search ships dark — there's no separate event log table; we lean on
Vercel Analytics + runtime logs to track usage. The queries below
help validate quality + cost without building a logging schema we
might not need.

### Smoke test (run from the Supabase SQL editor)

```sql
-- Confirm content_embeddings has rows from every source_table.
-- If any of these is 0, search will silently miss that surface.
select source_table, count(*) as embeddings
from public.content_embeddings
group by 1
order by 1;
```

Expect non-zero counts for `community_posts`, `community_comments`,
`communities`, `artist_events`, `rewards_catalog`. If a row is
missing, check the embedding cron + the inline-trigger paths in the
relevant server actions.

### Visibility filter sanity check

```sql
-- Search uses p_visibility = 'public' by default. Anything below
-- 'public' (premium / founder-only) must NOT come back.
select source_table, visibility, count(*)
from public.content_embeddings
group by 1, 2
order by 1, 2;
```

If you see meaningful `premium` / `founder-only` row counts, the
filter inside `search_embeddings()` is what keeps them out of /search
results — verify by spot-querying the RPC manually with a test
embedding.

### Query distance distribution (quality tuning)

After search has run for a couple of weeks, sample raw RPC distances
to validate `MAX_DISTANCE = 0.85` is the right threshold. Ad-hoc:

```sql
-- Pick a representative query, embed it client-side, paste the
-- pgvector literal here. Returns the top 30 with their distances —
-- look at where the relevance cliff actually is.
select source_table, source_id, distance
from public.search_embeddings(
  '[...paste 1536-dim vector...]'::vector,
  null,
  'public',
  null,
  30
)
order by distance asc;
```

Heuristic: if distances 5–15 already feel off-topic, tighten
`MAX_DISTANCE` in `lib/search/query.ts` (e.g. 0.7). If distances at
0.85 still feel relevant and the page shows few results, loosen it.

### Cost watch

OpenAI text-embedding-3-small is so cheap per query that the cost is
dominated by the indexing-side embedding (one per post / comment /
event / reward / community). Search-side cost target: < $1/month
even at 100k queries.

If the OpenAI bill spikes:
  1. Check the embeddings backfill cron — a stuck loop will reprocess
     the same rows.
  2. Check `/api/search` traffic in Vercel Analytics — a bot or
     someone scripting against the public endpoint can rack up calls.
     The endpoint is unauth'd by design; if abuse becomes real we'll
     add IP-based rate limits.

---

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
- Phase 9 — Signup unblock (migration 0023 — patched legacy `award_badge(uuid, text)` to delegate to `award_community_badge` so the ON CONFLICT target matches the post-0011 3-column PK on `fan_badges`; every signup since 0011 had been silently 500-ing with "Database error saving new user" and rolling back the auth.users insert). Also added a `COLLABORATING.md` onboarding guide for new engineers.
