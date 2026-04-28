-- ============================================================================
-- 0024_content_embeddings.sql — Fan Engage AI infrastructure: pgvector pipeline
-- ============================================================================
-- Foundation for the AI features in FAN_ENGAGE_AI_RECOMMENDATIONS.md. Adds:
--
--   1. The `vector` extension (pgvector — Supabase has this available; just enable)
--   2. A single `content_embeddings` table that stores embeddings for every
--      indexed text-bearing row in the platform, keyed by (source_table,
--      source_id). Content from any of these tables can be embedded:
--        * community_posts    (title + body)
--        * community_comments (body)
--        * communities        (display_name + tagline + bio)
--        * artist_events      (title + detail + event_date)
--        * rewards_catalog    (title + description)
--      offers is intentionally excluded for V1: that table is global (no
--      community_id), and we'd need a small schema change to make embedding
--      it useful for tenant-scoped recommendations. Add later.
--   3. An HNSW index for fast nearest-neighbor search at scale
--   4. RLS — anon can read embeddings whose visibility is 'public'; the
--      actual content access is still gated by the parent table's RLS, so
--      embeddings being readable adds no information leak (the embedding
--      vector is meaningless without joining back to the source row).
--   5. A `content_hash` column so we skip re-embedding rows whose text
--      didn't change — saves OpenAI API costs on every UPDATE.
--   6. Default privileges so the embedding worker (running as service_role)
--      can INSERT/UPDATE without manual grants.
--
-- Idempotent: re-running is safe (CREATE EXTENSION IF NOT EXISTS, drop+create
-- patterns for policies, ALTER TABLE … IF NOT EXISTS where applicable).
--
-- Cost reference (OpenAI text-embedding-3-small @ $0.02/1M tokens):
--   * 50k posts at ~80 tokens each = 4M tokens = $0.08
--   * Backfill of all 6 seeded communities + artist events + rewards = $0.01
--   * Ongoing cost at 1k posts/month = $0.001/month
--   In other words: this is a rounding error on the bill.
-- ============================================================================

-- ─── 1. pgvector extension ─────────────────────────────────────────────────
create extension if not exists vector;

-- ─── 2. content_embeddings table ───────────────────────────────────────────
create table if not exists public.content_embeddings (
  id            uuid primary key default gen_random_uuid(),

  -- Where this embedding came from. The (source_table, source_id) pair is
  -- the natural key — we never want two rows for the same source.
  source_table  text not null
                check (source_table in (
                  'community_posts',
                  'community_comments',
                  'communities',
                  'artist_events',
                  'rewards_catalog'
                )),
  source_id     uuid not null,

  -- Tenant scope — every embedding row belongs to exactly one community
  -- so cross-community queries can be filtered cheaply via the index below.
  -- For the `communities` table itself, this equals the community's own slug.
  community_id  text not null references public.communities(slug) on delete cascade,

  -- Visibility mirror — copies the parent row's visibility so search queries
  -- can pre-filter without joining the source table. Possible values match
  -- community_posts.visibility plus 'private' for admin-only content.
  visibility    text not null default 'public'
                check (visibility in ('public', 'premium', 'founder-only', 'private')),

  -- The vector itself. 1536 dimensions matches OpenAI's
  -- text-embedding-3-small. If we ever swap providers, we'll bump this and
  -- backfill — store enough metadata to know which model produced the row.
  embedding     vector(1536) not null,

  -- Content fingerprint of the text that was embedded. SHA-256 of the
  -- normalized input string. Lets us cheaply skip re-embedding when an
  -- UPDATE doesn't actually change the embeddable text.
  content_hash  text not null,

  -- Provenance — which model + which prompt template produced this vector.
  -- When we change embedding strategy, we can identify and re-embed stale rows.
  model         text not null default 'text-embedding-3-small',
  model_version text not null default '1',

  embedded_at   timestamptz not null default now(),

  -- One embedding per source row.
  unique (source_table, source_id)
);

comment on table  public.content_embeddings        is 'Vector embeddings for every text-bearing row in Fan Engage. Joined to source via (source_table, source_id). RLS policies on the source table govern access to the underlying content; this table itself just holds the vector.';
comment on column public.content_embeddings.content_hash is 'SHA-256 of the normalized embeddable text. Lets the indexing worker skip rows whose text did not change between updates.';
comment on column public.content_embeddings.visibility   is 'Mirrors the parent row''s visibility so search queries can pre-filter without joining the source.';

-- ─── 3. Indexes ────────────────────────────────────────────────────────────
-- HNSW (Hierarchical Navigable Small World) is the right choice for
-- read-heavy semantic search workloads. Build cost is high (slow inserts)
-- but query latency is sub-millisecond at 100k+ rows. For Fan Engage's
-- write rate (~1k posts/month at maturity), the build cost is irrelevant.
create index if not exists content_embeddings_hnsw_idx
  on public.content_embeddings
  using hnsw (embedding vector_cosine_ops);

-- Filter index for community-scoped searches (most queries narrow by community)
create index if not exists content_embeddings_community_idx
  on public.content_embeddings (community_id, visibility);

-- ─── 4. RLS ────────────────────────────────────────────────────────────────
alter table public.content_embeddings enable row level security;

-- Public can read public-visibility embeddings. The actual content the
-- embedding represents is still RLS-gated on the source table, so this
-- doesn't leak information — the vector is opaque without the source row.
drop policy if exists content_embeddings_public_read on public.content_embeddings;
create policy content_embeddings_public_read on public.content_embeddings
  for select using (visibility = 'public');

-- Authenticated members can additionally read embeddings whose visibility
-- matches their tier in the relevant community. Two policies — Postgres
-- OR's them together.
drop policy if exists content_embeddings_premium_read on public.content_embeddings;
create policy content_embeddings_premium_read on public.content_embeddings
  for select to authenticated using (
    visibility = 'premium' and exists (
      select 1 from public.fan_community_memberships m
      where m.fan_id = auth.uid()
        and m.community_id = content_embeddings.community_id
        and m.subscription_tier in ('premium', 'comped', 'past_due')
    )
  );

drop policy if exists content_embeddings_founder_read on public.content_embeddings;
create policy content_embeddings_founder_read on public.content_embeddings
  for select to authenticated using (
    visibility = 'founder-only' and exists (
      select 1 from public.fan_community_memberships m
      where m.fan_id = auth.uid()
        and m.community_id = content_embeddings.community_id
        and m.is_founder = true
    )
  );

-- Admins can read everything in their community (private/draft included).
drop policy if exists content_embeddings_admin_read on public.content_embeddings;
create policy content_embeddings_admin_read on public.content_embeddings
  for select to authenticated using (public.is_admin_of(community_id));

-- Writes happen exclusively via the embedding worker running as service_role,
-- which bypasses RLS. No INSERT/UPDATE/DELETE policies for anon/authenticated.

-- ─── 5. Grants ────────────────────────────────────────────────────────────
grant select on public.content_embeddings to anon, authenticated;
grant all    on public.content_embeddings to service_role;

-- ─── 6. Helper function: search nearest by community + visibility ──────────
-- Wraps the HNSW query in a function so callers don't have to write the
-- vector cosine syntax. Returns top-K nearest neighbors with distance.
create or replace function public.search_embeddings(
  p_query        vector(1536),
  p_community_id text default null,            -- null = search all communities
  p_visibility   text default 'public',         -- minimum visibility (RLS still applies)
  p_source_table text default null,            -- null = search all source types
  p_limit        int  default 20
) returns table (
  source_table text,
  source_id    uuid,
  community_id text,
  visibility   text,
  distance     float
)
language sql
security invoker        -- run as caller — RLS applies
stable
as $$
  select
    e.source_table,
    e.source_id,
    e.community_id,
    e.visibility,
    (e.embedding <=> p_query) as distance
  from public.content_embeddings e
  where (p_community_id is null or e.community_id = p_community_id)
    and (p_source_table is null or e.source_table = p_source_table)
    and (
      p_visibility = 'public'        and e.visibility = 'public'
      or p_visibility = 'premium'     and e.visibility in ('public', 'premium')
      or p_visibility = 'founder-only' and e.visibility in ('public', 'premium', 'founder-only')
      or p_visibility = 'private'     -- admin-only path; RLS gates this
    )
  order by e.embedding <=> p_query
  limit p_limit;
$$;

comment on function public.search_embeddings is 'Nearest-neighbor search on content_embeddings. Caller passes a query vector (already produced by the embedding API) and gets back the top K most similar rows. RLS on the underlying table is still enforced because security invoker.';

grant execute on function public.search_embeddings to anon, authenticated;

-- ─── 7. Helper function: list rows missing embeddings ─────────────────────
-- The backfill cron uses this to find work to do. Returns rows from any of
-- the 5 indexed tables that don't yet have an entry in content_embeddings.
create or replace function public.list_unembedded_rows(
  p_limit int default 100
) returns table (
  source_table text,
  source_id    uuid,
  community_id text
)
language sql
security definer       -- bypass RLS — backfill needs to see private rows too
stable
as $$
  -- community_posts (visibility lives on the row; multi-tenant via artist_slug
  -- which == community slug for music tenants from migration 0011)
  select 'community_posts'::text, p.id, p.artist_slug
  from public.community_posts p
  left join public.content_embeddings e
    on e.source_table = 'community_posts' and e.source_id = p.id
  where e.id is null
  union all

  -- community_comments (parent post supplies community_id)
  select 'community_comments'::text, c.id, p.artist_slug
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  left join public.content_embeddings e
    on e.source_table = 'community_comments' and e.source_id = c.id
  where e.id is null
  union all

  -- communities (slug-keyed; we derive a deterministic uuid from md5())
  select 'communities'::text,
         (md5('community:' || c.slug))::uuid,
         c.slug
  from public.communities c
  left join public.content_embeddings e
    on e.source_table = 'communities' and e.source_id = (md5('community:' || c.slug))::uuid
  where e.id is null and c.active = true
  union all

  -- artist_events (uses artist_slug, which doubles as community_id in FE)
  select 'artist_events'::text, ev.id, ev.artist_slug
  from public.artist_events ev
  left join public.content_embeddings e
    on e.source_table = 'artist_events' and e.source_id = ev.id
  where e.id is null and ev.active = true
  union all

  -- rewards_catalog
  select 'rewards_catalog'::text, r.id, r.community_id
  from public.rewards_catalog r
  left join public.content_embeddings e
    on e.source_table = 'rewards_catalog' and e.source_id = r.id
  where e.id is null and r.active = true and r.community_id is not null

  limit p_limit;
$$;

comment on function public.list_unembedded_rows is 'Returns rows from any indexed source table that do not yet have an entry in content_embeddings. Used by the /api/cron/embeddings-backfill worker to find work.';

grant execute on function public.list_unembedded_rows to service_role;

-- ─── 8. Verify (commented; uncomment to spot-check) ───────────────────────
-- select count(*) from public.content_embeddings;
-- select * from public.list_unembedded_rows(5);
-- \d public.content_embeddings
