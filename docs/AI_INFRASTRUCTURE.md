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
