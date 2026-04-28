# AI Infrastructure — Embedding Pipeline (Phase 1)

The embeddings pipeline is the foundation under most of the AI roadmap in
[`FAN_ENGAGE_AI_RECOMMENDATIONS.md`](./FAN_ENGAGE_AI_RECOMMENDATIONS.md).
Once it's running, half the items in that doc become 1-week builds instead
of 3-week builds.

This document covers what shipped, how it works, and how to turn it on.

---

## What's wired up

### Database

`supabase/migrations/0024_content_embeddings.sql` adds:

- The `vector` extension (pgvector).
- A `public.content_embeddings` table — one row per embedded source row,
  keyed by `(source_table, source_id)`. Stores a `vector(1536)` column for
  OpenAI's `text-embedding-3-small` output.
- An HNSW index for sub-millisecond nearest-neighbor search at scale.
- RLS policies that mirror the parent tables: anon reads public embeddings,
  authenticated members get premium/founder embeddings if their tier
  matches, admins see everything in their community.
- `search_embeddings(query_vec, community, visibility, source_table, limit)`
  — the helper UI code calls when running semantic search.
- `list_unembedded_rows(limit)` — used by the backfill cron to find work.

Five source tables are indexed: `community_posts`, `community_comments`,
`communities`, `artist_events`, `rewards_catalog`. The `offers` table is
currently global (no `community_id`) and is excluded for V1 — adding it
later is a small follow-up migration.

### Application

`frontend/lib/embeddings/` — a small module behind a single barrel
import (`@/lib/embeddings`):

- `client.ts` — `embedText()` and `embedBatch()` wrap the OpenAI
  `/v1/embeddings` endpoint. Pinned to `text-embedding-3-small` at 1536
  dims to match the `vector(1536)` column. Auto-chunks batches >100,
  normalizes whitespace, truncates at 8000 chars. Throws `EmbeddingError`
  on auth/rate/server failures.
- `sources.ts` — the registry. Each of the 5 indexed tables gets a
  `SourceDescriptor` with `columns` (what to fetch), `buildText` (how to
  assemble embeddable text from the row), and `extractMeta` (community
  scope + visibility + source_id). Adding a new embeddable table = adding
  one entry here.
- `index-row.ts` — `indexRow(table, rowId)` is the workhorse. Fetches the
  row, builds the text, checks `content_hash` for idempotency (skips
  re-embedding if nothing changed), calls OpenAI, upserts into
  `content_embeddings`. `indexRowAsync(table, rowId)` is the
  fire-and-forget variant for inline server-action use.
- `index.ts` — barrel export. Always import from `@/lib/embeddings`.

### Background work

`frontend/app/api/cron/embeddings-backfill/route.ts` — runs every 15
minutes via Vercel Cron (entry added to `frontend/vercel.json`). Calls
`list_unembedded_rows(50)`, iterates results through `indexRow`, returns a
JSON summary. Same `Bearer $CRON_SECRET` auth pattern as the other two
cron jobs.

### Inline indexing

`frontend/app/artists/[slug]/community/actions.ts` is patched at all 5
content-creation paths to call `indexRowAsync` fire-and-forget after
insert: `createPostAction`, `addCommentAction`, `createPollAction`,
`createChallengeAction`, `createAnnouncementAction`. New content is
embedded within seconds of being posted.

---

## Setup steps

There are three things you need to do before the pipeline activates.
None of them require a code change — just config + one SQL run + a
deploy.

### Step 1 — Run migration 0024 in the Fan Engage Supabase

Open https://supabase.com/dashboard/project/uhovonrljcauaoctypbg/sql/new

Copy-paste the entire contents of
`supabase/migrations/0024_content_embeddings.sql` and run it.

Expected: `Success. No rows returned.`

If you'd rather copy from your local clone:

```bash
cd ~/path/to/Superfan-platform
git pull origin main
cat supabase/migrations/0024_content_embeddings.sql | pbcopy
```

…then paste into the SQL editor.

Verify:

```sql
-- Should return 1 row.
select * from pg_extension where extname = 'vector';

-- Should show the table with all 5 source-table values allowed.
\d public.content_embeddings

-- Initial population — should return ~30 rows on a fresh DB
-- (5 communities + however many seeded events/posts/rewards exist).
select * from public.list_unembedded_rows(100);
```

### Step 2 — Add `OPENAI_API_KEY` to Vercel env vars

1. Open the Fan Engage Vercel project's env vars:
   https://vercel.com/jonas-group/fan-engage/settings/environment-variables
2. Click **Add New** → name it `OPENAI_API_KEY`, value = your OpenAI
   secret key (starts with `sk-…`).
3. Apply to all three environments: Production, Preview, Development.
4. Save.

### Step 3 — Redeploy

Vercel won't pick up the new env var until the next deploy. Either:

- Push any commit (the env var bakes in next build), OR
- Trigger a manual redeploy:
  https://vercel.com/jonas-group/fan-engage/deployments → top deployment →
  `…` → **Redeploy**.

After the deploy is "Ready", the next cron tick (within 15 minutes) will
backfill all the existing rows. Wait 15 minutes and verify via the steps
below.

---

## Verifying it works

### Check the cron summary

Hit the cron endpoint manually with your `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://fan-engage-pearl.vercel.app/api/cron/embeddings-backfill
```

Expected response (after first run):

```json
{
  "ok": true,
  "summary": {
    "totalCandidates": 30,
    "processed": 30,
    "byStatus": { "indexed": 30 },
    "byTable": {
      "communities": 5,
      "community_posts": 18,
      "rewards_catalog": 4,
      "artist_events": 3
    },
    "errors": [],
    "durationMs": 4218
  }
}
```

A second run within a few minutes should show `"skipped_unchanged"` for
all of them — that's the `content_hash` idempotency working.

### Spot-check the data

```sql
-- Count by source table
select source_table, count(*)
from public.content_embeddings
group by 1 order by 2 desc;

-- Sample a row to confirm the vector landed
select source_table, source_id, community_id, visibility,
       length(content_hash) as hash_len,
       array_length(embedding::float[], 1) as dim_count
from public.content_embeddings limit 3;
-- dim_count should be 1536 for every row.
```

### End-to-end smoke test

Create a post in any community feed (e.g.
`/artists/raelynn/community`). Within ~5 seconds — the time it takes
fire-and-forget indexing to complete an OpenAI roundtrip — the post
should have an embedding row:

```sql
select * from public.content_embeddings
where source_table = 'community_posts'
order by embedded_at desc limit 1;
```

---

## Operational notes

### Costs

OpenAI `text-embedding-3-small` is **\$0.02 per 1M tokens** (≈ \$0.00000002
per token). At Fan Engage's expected scale, embedding cost is a rounding
error:

| Workload | Tokens | Cost |
|----------|--------|------|
| Initial backfill (30 rows × 80 tokens avg) | 2,400 | \$0.0001 |
| 1,000 new posts/month | 80,000 | \$0.002 |
| Full re-embed if we change models (50,000 historical rows) | 4,000,000 | \$0.08 |

Even pessimistic projections (10× the volume) keep this under \$1/month.

### When embeddings might get stale

The pipeline does **not** re-embed on UPDATE today. If a post body is
edited or a community's bio changes, the existing embedding stays in place
until either:

- The next time `indexRow()` is called for that row (e.g. via a future
  UPDATE-aware trigger we haven't built), or
- We add a "force re-embed" admin button that calls `indexRow()` directly.

The `content_hash` column makes this safe — when re-embedding does
happen, a no-op-update will be skipped automatically.

### Rate limiting

OpenAI's `/v1/embeddings` endpoint allows 3,000 RPM for tier-1 accounts,
500,000 TPM. The backfill cron processes 50 rows/run × 4 runs/hour = 200
rows/hour, well below any limit. Inline indexing is one row at a time per
post create.

If we ever hit a rate limit, the cron-route 503s and Vercel retries on the
next tick — same pattern as the other crons.

### Failure modes to know about

- **`OPENAI_API_KEY` missing in env** — every embed call returns a 503.
  The cron route surfaces this clearly: `"OPENAI_API_KEY not configured.
  Skipping backfill until the env var is set in Vercel."`
- **OpenAI 429 (rate limit)** — `EmbeddingError` is raised. The cron
  catches it, marks that row as errored in the summary, continues with
  the rest. Next cron tick retries.
- **OpenAI 5xx** — same as 429.
- **pgvector extension not enabled** — INSERT into `content_embeddings`
  fails with `type "vector" does not exist`. Step 1 of setup handles
  this.

All of these are recoverable; nothing requires code changes to fix.

---

## What's next (Phase 2)

With the pipeline live, the following recs from
`FAN_ENGAGE_AI_RECOMMENDATIONS.md` become small builds:

- **#6 Semantic search** — UI surface + a single API route that calls
  `search_embeddings()`. Maybe a week.
- **#10 Reward recommendations** — single hero card on `/rewards`. A few
  days.
- **#8 Smart event match notifications** — score events against
  members' RSVP history using embeddings. ~1.5 weeks.

The next obvious foundational add (per the roadmap) is recommendation
\#2 — post moderation classifier — because the cost of *not* having it
scales with member volume and it doesn't share dependencies with #1.

---

*Last updated: April 2026 (Phase 1 of the AI roadmap)*

---

# Phase 2 — Moderation Classifier (recommendation #2)

The moderation classifier shipped in Phase 2 puts every new post and
comment through Anthropic Claude Haiku 4.5 to get a structured safety
classification (`safe` / `flag_review` / `auto_hide`) with severity,
categories, and reason. RLS hides `auto_hide` rows from public view;
flagged rows show up in `/admin/moderation` for human review.

## What's wired up

### Database

`supabase/migrations/0025_moderation.sql` adds:

- `moderation_status`, `moderation_severity`, `moderation_categories`,
  `moderation_reason`, `moderation_self_harm`, `moderation_classified_at`,
  `moderation_model`, `moderation_prompt_version` columns on both
  `community_posts` and `community_comments`.
- Updated RLS so `auto_hide` rows only show to author + community admins.
  `pending` rows stay visible during the brief window before
  classification — small risk window for not silently breaking new posts
  if the moderation pipeline is briefly down.
- `moderation_decisions` table — append-only audit log of every
  classification (AI + admin overrides), keyed by `(source_table,
  source_id)`.
- `list_pending_moderation(limit)` helper — used by the backfill cron.
- `apply_moderation_decision(...)` helper — atomically updates the source
  row's moderation columns AND appends to the audit log in one
  transaction. All moderation writes (AI + admin) route through this so
  the audit log can never drift from the source's actual status.

### Application

`frontend/lib/moderation/` — three modules behind a barrel index:

- `client.ts` — `classifyContent(text, context)` wraps Anthropic's
  `/v1/messages` endpoint with a versioned moderation prompt
  (`PROMPT_VERSION`). Pinned to `claude-haiku-4-5` for cost + speed.
  Self-harm is an independent flag — severity drives the routing
  decision but self-harm posts are NEVER auto-hidden.
- `moderate-row.ts` — `moderateRow(table, rowId)` is the workhorse.
  Fetches the row, classifies, applies the decision via
  `apply_moderation_decision()`. `moderateRowAsync` is the
  fire-and-forget variant. `applyAdminOverride()` is the admin path.
- `index.ts` — barrel export.

### Background work

`frontend/app/api/cron/moderation-backfill/route.ts` — runs every 15
minutes via Vercel Cron. Same `Bearer $CRON_SECRET` auth pattern as the
other cron jobs. `BATCH_SIZE=25` per tick to stay under the 60-second
function budget at 1-2 sec per Anthropic call.

### Inline trigger

`frontend/app/artists/[slug]/community/actions.ts` — same 5 server
actions where `indexRowAsync` is wired now also call `moderateRowAsync`
fire-and-forget. Both run in parallel.

### Admin UI

`frontend/app/admin/moderation/page.tsx` — server component that lists
flagged posts + comments with severity, category chips, AI reasoning,
and three action buttons (Approve / Hide / Re-queue). Self-harm content
is marked with a violet badge and an explicit don't-hide warning.
Linked from the admin nav (`/admin/layout.tsx`) as "Moderation".

## Setup steps for Phase 2

### Step 1 — Run migration 0025 in Supabase

Open https://supabase.com/dashboard/project/uhovonrljcauaoctypbg/sql/new
and paste the contents of `supabase/migrations/0025_moderation.sql`.

Verify:

```sql
\d public.community_posts        -- should show moderation_* columns
select count(*) from public.moderation_decisions;  -- 0 on first run
select count(*) from public.list_pending_moderation(5);
```

### Step 2 — Add `ANTHROPIC_API_KEY` to Vercel

https://vercel.com/jonas-group/fan-engage/settings/environment-variables
→ Add New → name `ANTHROPIC_API_KEY`, value = your `sk-ant-...` key,
applied to all three environments.

### Step 3 — Redeploy

Push any commit (the env var bakes in next build), or click Redeploy on
the latest deployment.

After the next cron tick (within 15 min of redeploy), all the existing
`pending` posts get classified. Watch `/admin/moderation` — most of the
seeded content should classify as `safe` and never appear there. Any
that surface are exactly the rows worth a human eye.

## Verifying it works

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://fan-engage-pearl.vercel.app/api/cron/moderation-backfill
```

Expected response after first run:

```json
{
  "ok": true,
  "summary": {
    "totalCandidates": 18,
    "processed": 18,
    "byStatus": { "classified": 18 },
    "byTable": { "community_posts": 12, "community_comments": 6 },
    "byClassification": { "safe": 17, "flag_review": 1 },
    "selfHarmFlagged": 0,
    "errors": [],
    "durationMs": 28341
  }
}
```

Then in SQL:

```sql
select moderation_status, count(*)
from public.community_posts group by 1;

-- Recent admin decisions
select decided_by, new_status, count(*)
from public.moderation_decisions
where created_at > now() - interval '1 day'
group by 1, 2;
```

## Operational notes

### Costs

Claude Haiku 4.5: $0.25/M input, $1.25/M output. Per classification:
~200 input + ~150 output tokens = ~$0.0001. Steady-state cost at 1k
posts/month = $0.10/month.

### Self-harm policy

The classifier flags self-harm independently from the routing decision.
Per `FAN_ENGAGE_AI_RECOMMENDATIONS.md`, self-harm posts:

- **Stay visible.** They're help-seeking. Hiding them is harmful.
- Get the violet `Self-harm signal` badge in the admin queue.
- **Should be checked on by an admin or community moderator** — surface
  crisis resources to the author rather than removing the post.

A future commit will wire a "Send crisis resources" button into the
admin queue card that DMs the author a vetted list of helplines (988
Suicide & Crisis Lifeline, NAMI HelpLine, etc.). For now: admins
manually outreach.

### When to re-classify

Bump `PROMPT_VERSION` in `frontend/lib/moderation/client.ts` whenever
the prompt changes meaningfully. Then run a one-off SQL update to mark
older rows as `pending` so the cron picks them back up:

```sql
update public.community_posts
set moderation_status = 'pending'
where moderation_prompt_version != 'v2';  -- new version
```

### Failure modes

- **`ANTHROPIC_API_KEY` missing** — every classify call returns 503;
  `pending` rows pile up. Admin queue stays empty.
- **Anthropic 429 / 5xx** — `ModerationError` raised; cron records the
  error in the per-row summary, marks the row as still `pending`, and
  next cron tick retries.
- **Classifier returns malformed JSON** — strict parser rejects it,
  raises `ModerationError`. We never silently default to "safe".

All recoverable; nothing requires code changes.

---

# Phase 3 — AI-drafted comment replies (recommendation #3)

The drafter shipped in Phase 3 adds a "✨ Draft a reply" button to every
comment composer. Clicking it returns 3 short reply options (each ≤ 25
words) tuned to the post, the user's prior comment style, and the
community's vibe. Picking one fills the textarea — still editable.
Posting persists `draft_used = true` so we can A/B test the engagement
lift.

## What's wired up

### Database

`supabase/migrations/0026_draft_used.sql` adds:

- `community_comments.draft_used boolean default false`
- A partial index on `(created_at desc) where draft_used = true` for
  cheap "how many drafted comments did we get last week" queries.

### Application

`frontend/lib/drafts/`:

- `client.ts` — `generateCommentDrafts(input)` wraps Claude Haiku 4.5
  with a strict, versioned prompt (`DRAFT_PROMPT_VERSION = 'v1'`).
  Returns exactly 3 distinct drafts, ≤ 25 words each. `temperature: 0.7`
  for variety. Defensive JSON parser strips fence wrapping and
  validates the shape.
- `draft-comment.ts` — `draftComment({postId, userId})` is the
  server-side workhorse. Loads the post + community + last 10 prior
  comments by the same user (for style transfer) and calls the
  classifier. Has a `draftCommentWithoutJoin` fallback for when the
  multi-table `.select(...)` shape doesn't match supabase-js's type
  inference.
- `index.ts` — barrel.

`frontend/app/api/ai/draft-comment/route.ts`:

- POST `{ postId }` → `{ drafts: [...3 strings] }`.
- Auth-gated (401 if not signed in). `userId` comes from the session,
  not the body.
- Returns 503 if `ANTHROPIC_API_KEY` is missing.
- No-cache headers — every click is fresh.

### Client UI

`frontend/app/artists/[slug]/community/comment-composer.tsx`:

- "use client" component that owns drafter state.
- ✨ button → POST → loading state → 3 clickable chips render in a
  panel above the textarea.
- Click a chip → textarea fills, `draft_used` flips to `'1'`. Still
  editable.
- Click ✨ again → regenerate (no caching).
- Submit button uses `useFormStatus()` to disable during the pending
  server action.
- After submit, all state resets.

`frontend/app/artists/[slug]/community/post-card.tsx`:

- The inline `<form action={addCommentAction}>` is replaced with
  `<CommentComposer postId artistSlug />`.

`frontend/app/artists/[slug]/community/actions.ts` (`addCommentAction`):

- Reads the new `draft_used` hidden input and persists it on the row.

## Setup steps for Phase 3

Only one new step (the API key + redeploy from Phase 2 already covered
the runtime needs):

### Run migration 0026 in Supabase

Open https://supabase.com/dashboard/project/uhovonrljcauaoctypbg/sql/new
and paste the contents of `supabase/migrations/0026_draft_used.sql`.

That's it. No new env var required (uses the existing
`ANTHROPIC_API_KEY` that Phase 2 needed). No redeploy strictly required
either — but a fresh deploy makes the new endpoint + composer visible
right away.

## Verifying it works

1. Sign in as a fan.
2. Visit any artist's community feed (`/artists/raelynn/community`).
3. Scroll to a post with comments visible. Click `✨` next to the
   textarea.
4. Within 1-2 seconds, 3 reply drafts appear in chip form.
5. Click one → textarea fills.
6. Edit if you like, click `Post`.
7. The new comment row in `community_comments` has `draft_used = true`.

Spot-check via SQL:

```sql
select id, body, draft_used, created_at
from public.community_comments
order by created_at desc
limit 5;
```

## A/B analysis (once you have data)

The success criterion in `FAN_ENGAGE_AI_RECOMMENDATIONS.md` is a +30%
comment volume lift on posts where the drafter is shown. Once a couple
weeks of usage have accumulated:

```sql
-- Comment volume by drafter usage
select draft_used, count(*) as comments,
       avg(length(body)) as avg_chars
from public.community_comments
where created_at > now() - interval '14 days'
group by 1;

-- Drafter conversion rate (proxy: % of comments that originated as drafts)
select 100.0 * count(*) filter (where draft_used) / nullif(count(*), 0) as drafter_share_pct
from public.community_comments
where created_at > now() - interval '14 days';
```

If `drafter_share_pct` is below ~10% the button isn't getting used
(consider making it more prominent). Above ~40% means people love it
(consider ranking drafts better, adding a "regenerate" sub-button per
chip, etc.).

## Operational notes

### Costs

Claude Haiku 4.5 at $0.25/M input + $1.25/M output. Per click:
~250 input + ~200 output tokens = ~$0.0003. 10k clicks/month = $3.
Trivial.

### Failure modes

- **`ANTHROPIC_API_KEY` missing** — endpoint returns 503; UI shows
  inline error in rose-300 text. User can still write organically.
- **Anthropic 429 / 5xx** — `DraftError` raised; same UI behavior. No
  retry today; if rate limits become a problem, add a 1s exponential
  backoff in the route.
- **Classifier returns malformed JSON** — strict parser rejects it,
  same inline error. We never serve bogus drafts.

### Why no rate limiting yet

V1 trusts Anthropic's tier-1 rate limit (50 RPM, plenty for our user
base). If we see abuse (one user spamming the ✨ button), add a small
Redis-backed limiter at the route. Until then it's premature
optimization.

---

# Phase 4 — Weekly digest emails (recommendation #4)

The digest cron shipped in Phase 4 sends every active opted-in fan a
personalized weekly email — top posts, upcoming events, a reward they
can afford, and an AI-generated "vibe of the week" line per
community. Sundays 09:00 UTC.

## What's wired up

### Database

`supabase/migrations/0027_digest.sql` adds:

- `fans.digest_subscribed boolean default true` — per-fan opt-out for
  the digest specifically (additional to `email_opted_in`).
- `fans.last_digest_sent_at timestamptz` — bookkeeping for the cron's
  6-day safety window so retries / partial sends never double-deliver.
- `digest_log` table — one row per `(fan_id, week_start)`. Captures
  rendered HTML, text fallback, Mailchimp campaign id, AI summary
  count, and `payload_post_ids[]` for impression analytics.
- `list_digest_recipients(limit)` helper — returns active opted-in
  fans whose last digest is >6 days old.

### Application

`frontend/lib/digest/`:

- `types.ts` — shared types (DigestRecipient, DigestPostHighlight,
  DigestEvent, DigestRewardSuggestion, DigestCommunityBlock,
  DigestPayload).
- `gather.ts` — `gatherDigestPayload(recipient)` walks the fan's
  followed artists (top 3 most-recently-followed), pulls top posts
  from the last 7 days ranked by reactions+comments, upcoming events
  they haven't RSVP'd to, and a reward suggestion (most aspirational
  affordable). Filters out `auto_hide` moderation rows so toxic
  content never features.
- `summarize.ts` — `summarizeAllCommunities(payload)` calls Claude
  Haiku 4.5 once per community block to generate a 12-22 word
  newsroom-dry vibe summary. Has a fallback path that ships the
  digest even if `ANTHROPIC_API_KEY` is missing.
- `render.ts` — `renderDigestPayload(payload)` returns
  `{ html, text }`. Email-safe HTML (inline styles, no fonts/images)
  meant for the Mailchimp `DIGESTHTML` merge field. Every link
  carries UTM params for click-through measurement.
- `send.ts` — `prepareDigestForFan(recipient)` runs the full
  gather→summarize→render pipeline + PUTs the merge fields into
  Mailchimp. `fireDigestCampaign(count)` creates + sends ONE
  campaign that templates `*|DIGESTHTML|*` — Mailchimp inlines
  each recipient's merge values. `recordDigestSent(...)` upserts the
  audit row.
- `index.ts` — barrel.

`frontend/app/api/cron/weekly-digest/route.ts` — the scheduled GET.

`frontend/vercel.json` — `0 9 * * 0` cron entry.

## Setup steps for Phase 4

There are three things you need to do before the weekly digest fires:

### Step 1 — Run migration 0027 in Supabase

Open https://supabase.com/dashboard/project/uhovonrljcauaoctypbg/sql/new
and paste the contents of `supabase/migrations/0027_digest.sql`.

Verify:

```sql
\d public.digest_log
select count(*) from public.list_digest_recipients(500);
```

### Step 2 — Add custom merge fields in Mailchimp

The digest pipeline writes per-fan rendered HTML into a Mailchimp
custom merge field called `DIGESTHTML`, plus a plain-text fallback
in `DIGESTTEXT`. These don't exist in the audience by default —
you have to create them once.

1. Open https://us21.admin.mailchimp.com/audience/settings/merge-fields/
   (replace `us21` with your actual server prefix; the same one in
   `MAILCHIMP_SERVER_PREFIX`).
2. Click **Add a field** → **Text** field.
   - **Field label**: `Digest HTML Block`
   - **Field tag**: `DIGESTHTML`
   - **Visible**: unchecked (don't show it in subscriber profiles)
   - **Required**: unchecked
   - **Default value**: leave empty
   - **Click "Save changes"**
3. Repeat for `DIGESTTEXT`:
   - **Field label**: `Digest Text Fallback`
   - **Field tag**: `DIGESTTEXT`
   - same settings as above
4. Mailchimp's default text-field max length is 80 characters. The
   digest HTML can be up to 6,000 chars. **Increase both fields'
   max length to 6000** in the field's edit modal (look for the
   "Max length" input — Mailchimp may not show this for default
   text fields, in which case you'll need to use a "Long text" type
   if available, or split the rendered HTML into multiple smaller
   merge fields. For initial testing, 1500-character digests fit
   in the default 80-char limit only if your audience has the
   higher-tier setting; check your Mailchimp plan).

If Mailchimp's UI doesn't let you raise the merge-field max above
255 for your tier, the V1 fallback is to use multiple structured
merge fields (`DIGEST_VIBE_1`, `DIGEST_TOP_POST_1_TITLE`, etc.)
and a richer template. That's a follow-up; ship the simple version
first and see if it bumps against the limit.


**Note on merge-tag character limit:** Mailchimp caps merge tags at
**10 characters** — that's why we use `DIGESTHTML` and `DIGESTTEXT`
instead of the more-descriptive `DIGEST_BLOCK` / `DIGEST_TEXT` we'd
otherwise prefer. If you change tag names, also update the merge-field
references in `frontend/lib/digest/send.ts` (search for `DIGESTHTML`
and `DIGESTTEXT`) so the runtime values match.

### Step 3 — (Optional) Set up a Mailchimp template

The cron's `fireDigestCampaign()` ships a default minimal template
inline. You can replace it with a branded template in the Mailchimp
dashboard:

1. Templates → Create template
2. Use a layout that has a content block
3. In the content area, drop `*|FNAME|*` and `*|DIGESTHTML|*` merge
   tags
4. Save the template name. (For V1 we don't reference a saved
   template — `cron-route.ts` posts the HTML inline. To use a saved
   template later, modify `fireDigestCampaign()` to set
   `template.id` instead of posting `content.html`.)

## Verifying it works

Run the cron manually once you've completed Steps 1 and 2:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://fan-engage-pearl.vercel.app/api/cron/weekly-digest
```

Expected response on the first run:

```json
{
  "ok": true,
  "aiAvailable": true,
  "summary": {
    "totalCandidates": 12,
    "prepared": 8,
    "preparedWithMailchimp": 8,
    "skipped": 4,
    "errors": [],
    "campaignId": "abc123def456",
    "campaignError": null,
    "weekStart": "2026-04-27",
    "durationMs": 31420
  }
}
```

`skipped` covers fans who follow no artists or have no fresh content
this week — that's correct behavior, not an error.

Then in SQL:

```sql
select status, count(*) from public.digest_log group by 1;

-- Most-recent run details
select fan_id, status, ai_summary_count, array_length(payload_communities, 1) as communities,
       array_length(payload_post_ids, 1) as posts,
       length(html_body) as html_chars, mailchimp_campaign_id
from public.digest_log
order by sent_at desc limit 10;
```

## Operational notes

### Costs

Anthropic Claude Haiku 4.5 at $0.25/M input + $1.25/M output. Per
fan: ~3 community-summary calls × ~250 input + ~50 output tokens =
~$0.0003. At 200 active fans: $0.06/week = $3/year.

Mailchimp: PUTs to the audience are free; the campaign send falls
under your existing plan's monthly send limit.

### Function-timeout caveat

The cron processes recipients sequentially. Per-fan latency is
gather (~200ms) + summarize (~3s for 3 Anthropic calls) + Mailchimp
PUT (~200ms) ≈ **3.5s per fan**. On Vercel Hobby's 60s function
timeout that's ~15 fans per cron run; if you have more than that,
the run times out and remaining fans roll into next Sunday's run
(they're picked up because `last_digest_sent_at` is still null).

If/when the audience grows past 15 fans:

- Upgrade Vercel project to Pro (300s function timeout) — covers
  ~85 fans per run.
- Or switch to per-fan Vercel queue jobs (Inngest, Upstash Q, or
  Vercel's own queue).
- Or batch the Anthropic summarize calls (one prompt covering all
  3 communities for a fan, which cuts 3 calls down to 1) — easy
  win, ~3× speedup, ~5x faster runs.

### Self-harm + auto-hide content

The gather step explicitly filters `moderation_status` to
`('pending', 'safe', 'flag_review')` — so `auto_hide` posts NEVER
show up in a digest. Same for `community_comments` when computing
comment counts. This is the same content-safety guarantee the live
feed has, applied to the email channel.

### Failure modes

- **`MAILCHIMP_*` env vars missing** — the cron still gathers,
  summarizes, and renders for each fan; the digest_log row gets
  status `'rendered'` (not sent). You can inspect the HTML body
  in the audit table even before Mailchimp is set up. Useful for
  staging tests.
- **`ANTHROPIC_API_KEY` missing** — fallback summaries kick in
  ("RaeLynn this week: 2 top posts and 1 upcoming event."). Less
  magical but still ships.
- **Mailchimp campaign create fails** — every prepared fan still
  has their merge fields set; next Sunday's run will overwrite
  them and try again. Worst case, fans get next week's email a
  week late.
- **Audience contains fans not in `fans` table** — Mailchimp PUT
  doesn't care; we always upsert the merge fields by email hash.

---

# Phase 5 — Auto-tagging community posts (recommendation #5)

The tagging classifier shipped in Phase 5 puts every new post through
Claude Haiku 4.5 to assign 1-4 tags from a closed vocabulary
(`live_show`, `merch_drop`, `studio_session`, etc.). Tags surface as
clickable filter chips on the community feed and become the substrate
for future recommendation, search, and analytics features.

## What's wired up

### Database

`supabase/migrations/0028_post_tags.sql` adds:

- `community_posts.tags text[] not null default '{}'`
- `community_posts.tagged_at timestamptz` — null = pending
- `community_posts.tag_model + tag_prompt_version` — re-classification
  provenance, mirrors moderation columns
- **GIN index on `tags`** for fast `@>` (contains) and `&&` (overlaps)
  queries used by the filter chips
- Partial btree index on `(created_at desc) where tagged_at is null`
  for the backfill cron's "find work" query
- `list_untagged_posts(limit)` — backfill cron's work-finder. Filters
  out auto_hide moderation rows
- `list_top_tags_for_community(slug, limit)` — most-used tags per
  community with counts. Powers the filter chip render (security
  invoker; respects RLS on community_posts)

### Application

`frontend/lib/tagging/`:

- `client.ts` — `classifyTags(input)` wraps Claude Haiku 4.5.
  CANONICAL_TAGS is a 21-string closed vocabulary (20 + `other`).
  Versioned via `TAG_PROMPT_VERSION`. Defensive parser validates
  every returned tag against the vocabulary, dedupes, caps at 4.
- `tag-row.ts` — `tagRow(postId)` workhorse: fetches post + artist
  genres for context, calls classifier, updates row. Skips
  auto_hide. `tagRowAsync` is the fire-and-forget variant.
- `index.ts` — barrel.

### Inline trigger

`frontend/app/artists/[slug]/community/actions.ts` — same 4
community_posts insert paths where `indexRowAsync` and
`moderateRowAsync` are wired now also call `tagRowAsync`. All three
run in parallel as fire-and-forget. Comments are **not** tagged.

### Background work

`frontend/app/api/cron/tags-backfill/route.ts` — every 15 min,
classifies posts with `tagged_at is null`. Same auth + 503 patterns.
BATCH_SIZE=30 keeps each tick under Vercel's 60s function timeout.

### UI surface

`frontend/app/artists/[slug]/community/page.tsx`:

- Reads `?tag=foo` from searchParams → server-side filters posts via
  the GIN index
- Parallel-fetches the top 10 tags for the community

`frontend/app/artists/[slug]/community/tag-filter-chips.tsx`:

- `"use client"` component. Click a chip → URL updates → page
  re-fetches with the filter applied. "All" chip clears.
- Pretty-labels snake_case canonical tags ("live_show" → "Live Shows")
- Hidden entirely if the artist has no tagged posts yet

## Setup steps for Phase 5

Just one — run the migration. No new env vars needed since
`ANTHROPIC_API_KEY` from Phase 2 covers it.

### Run migration 0028 in Supabase

Open https://supabase.com/dashboard/project/uhovonrljcauaoctypbg/sql/new
and paste the contents of `supabase/migrations/0028_post_tags.sql`.

Verify:

```sql
\d public.community_posts        -- should show tags + tagged_at + tag_* columns

select * from public.list_untagged_posts(5);
select * from public.list_top_tags_for_community('raelynn', 10);
```

After the migration runs, the `*/15 * * * *` `tags-backfill` cron will
classify all existing posts within 15-30 minutes of the next deploy.
A typical first-run summary:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://fan-engage-pearl.vercel.app/api/cron/tags-backfill
```

```json
{
  "ok": true,
  "summary": {
    "totalCandidates": 9,
    "processed": 9,
    "byStatus": { "tagged": 9 },
    "errors": [],
    "durationMs": 13420
  }
}
```

## Verifying the UI

After tags land, visit any artist's community feed:

1. https://fan-engage-pearl.vercel.app/artists/raelynn/community
2. Filter chips appear at the top showing the most-used tags + counts
3. Click a chip → URL becomes `?tag=live_show` → only matching posts
4. Click "All" to clear

Spot-check via SQL:

```sql
-- Tag distribution per community
select artist_slug, t.tag, count(*)
from public.community_posts p, unnest(p.tags) as t(tag)
where p.tagged_at is not null
group by 1, 2
order by 1, count(*) desc;
```

## Operational notes

### Costs

Claude Haiku 4.5 at $0.25/M input + $1.25/M output. Per post:
~150 input + ~50 output tokens = ~$0.0001. 1k posts/month = $0.10.

### When to bump TAG_PROMPT_VERSION

Bump the constant in `frontend/lib/tagging/client.ts` whenever:

- The closed vocabulary changes (added, removed, or renamed tags)
- The system prompt changes meaningfully (e.g. new examples)
- The classifier model is upgraded

After bumping, mark stale rows for re-classification:

```sql
update public.community_posts
set tagged_at = null
where tag_prompt_version != 'v2';  -- new version
```

The backfill cron picks them up within 15 min and re-tags.

### Self-harm + auto_hide content

Posts with `moderation_status = 'auto_hide'` are excluded from
`list_untagged_posts` and `list_top_tags_for_community`, so toxic
content never gets tags assigned and never appears in filter chip
counts.

### Failure modes

- **`ANTHROPIC_API_KEY` missing** — every classify call returns 503;
  `tagged_at` stays null. Filter chips render with whatever's already
  tagged. Filter still works on tagged posts; untagged posts just
  don't match any tag filter.
- **Anthropic 429 / 5xx** — `TagError` raised; row stays
  `tagged_at = null`; next cron tick retries.
- **Classifier returns invalid tag** — defensive parser rejects it,
  falls back to ['other']. Never persists garbage tags.
