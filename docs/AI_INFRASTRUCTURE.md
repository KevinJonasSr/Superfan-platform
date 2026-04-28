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
