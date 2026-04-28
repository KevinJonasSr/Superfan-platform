-- ============================================================================
-- 0028_post_tags.sql — Fan Engage AI: auto-tagging community posts
-- ============================================================================
-- Phase 5 of FAN_ENGAGE_AI_RECOMMENDATIONS.md (recommendation #5).
--
-- Adds a tags column to community_posts. Each post gets 1-4 tags
-- assigned by an AI classifier from a closed vocabulary like
-- 'live_show', 'merch_drop', 'studio_session', etc. Tags become the
-- substrate for filter chips on the community feed, recommendations,
-- digest grouping, and platform-wide analytics.
--
-- Schema fits the same shape as moderation (#2):
--   * tags text[] not null default '{}' — array of canonical strings
--   * tagged_at timestamptz — null = not yet classified
--   * tag_model + tag_prompt_version — provenance for re-classification
--
-- Indexes:
--   * GIN on tags for cheap @> / && filter queries
--   * Partial btree on tagged_at where tagged_at is null — backfill
--     cron's "find work" query
--
-- Idempotent. Safe to re-run.
--
-- Cost reference (Anthropic claude-haiku-4-5, ~150 input + ~50 output
-- tokens per classification = ~$0.0001/post):
--   * 1k posts/month → $0.10/month
--   * 100k posts/month → $10/month
--   Trivial.
-- ============================================================================

-- ─── 1. tags column + provenance ───────────────────────────────────────────
alter table public.community_posts
  add column if not exists tags text[] not null default '{}',
  add column if not exists tagged_at timestamptz,
  add column if not exists tag_model text,
  add column if not exists tag_prompt_version text;

comment on column public.community_posts.tags is
  'AI-assigned semantic tags from a closed vocabulary (e.g. live_show, merch_drop, studio_session). Set by /lib/tagging classifier and the tags-backfill cron. Used for filter chips on the community feed, digest grouping, and analytics.';

-- ─── 2. Indexes ────────────────────────────────────────────────────────────
-- GIN supports @> (contains) and && (overlaps) queries:
--   select * from community_posts where tags @> '{live_show}';
--   select * from community_posts where tags && '{live_show, tour_announcement}';
create index if not exists community_posts_tags_gin_idx
  on public.community_posts using gin (tags);

-- Partial index for the backfill cron's "find work" query.
create index if not exists community_posts_untagged_idx
  on public.community_posts (created_at desc)
  where tagged_at is null;

-- ─── 3. Helper: list posts pending tagging ────────────────────────────────
-- Same pattern as list_pending_moderation. Filters out:
--   * already-tagged rows
--   * empty-body posts
--   * auto_hide moderation rows (don't waste API calls on hidden content)
create or replace function public.list_untagged_posts(
  p_limit int default 50
) returns table (
  post_id      uuid,
  artist_slug  text,
  body_text    text,
  context      jsonb
)
language sql
security definer
stable
as $$
  select
    p.id,
    p.artist_slug,
    coalesce(p.title || E'\n\n' || p.body, p.body),
    jsonb_build_object(
      'community_id', p.artist_slug,
      'kind', p.kind,
      'visibility', p.visibility
    )
  from public.community_posts p
  where p.tagged_at is null
    and coalesce(length(p.body), 0) > 0
    and (p.moderation_status is null or p.moderation_status != 'auto_hide')
  order by p.created_at desc
  limit p_limit;
$$;

comment on function public.list_untagged_posts is
  'Returns community_posts rows that have not yet been classified for tags. Filters out auto_hide moderation rows. Used by /api/cron/tags-backfill.';

grant execute on function public.list_untagged_posts to service_role;

-- ─── 4. Helper: top tags per community (for filter chip ranking) ──────────
-- The community page renders chip filters showing the N most-used tags.
-- This function is queried at page-render time (so it must be cheap;
-- the GIN index supports it).
create or replace function public.list_top_tags_for_community(
  p_artist_slug text,
  p_limit int default 12
) returns table (
  tag        text,
  post_count bigint
)
language sql
security invoker
stable
as $$
  select
    t.tag,
    count(*) as post_count
  from public.community_posts p,
       unnest(p.tags) as t(tag)
  where p.artist_slug = p_artist_slug
    and (p.moderation_status is null or p.moderation_status != 'auto_hide')
  group by t.tag
  order by post_count desc, t.tag asc
  limit p_limit;
$$;

comment on function public.list_top_tags_for_community is
  'Returns the most-frequently-used tags in a community, with post counts. Used by the /artists/[slug]/community filter chips.';

grant execute on function public.list_top_tags_for_community to anon, authenticated;

-- ─── 5. Verify (commented; uncomment to spot-check) ───────────────────────
-- select count(*) filter (where tagged_at is not null) as tagged,
--        count(*) filter (where tagged_at is null) as pending
-- from public.community_posts;
--
-- select * from public.list_untagged_posts(5);
-- select * from public.list_top_tags_for_community('raelynn', 10);
