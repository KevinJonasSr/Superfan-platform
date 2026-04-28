-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 10: Reward recommendations
-- Recommendation #10 from FAN_ENGAGE_AI_RECOMMENDATIONS.md.
--
-- Surface a single hero card on /artists/[slug]/rewards: "Based on your
-- tier, your points, and what fans like you redeemed, you'd love this."
--
-- Algorithm: sum cosine similarity across the fan's past redemptions vs
-- every active reward in the same community, filter by tier eligibility +
-- affordability + 30-day recency penalty, return top N.
--
-- Cost: zero AI / OpenAI usage. Pure pgvector arithmetic against
-- already-indexed reward embeddings.
--
-- Safe to re-run (idempotent). Apply via: Supabase SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── recommend_rewards_for_fan(fan, community, limit) ─────────────────────
-- Returns up to p_limit rewards ranked by affinity to the fan's past
-- redemption history. Cold-start (no past redemptions) returns 0 rows —
-- the caller is expected to fall back to a popular / static ordering.
create or replace function public.recommend_rewards_for_fan(
  p_fan_id       uuid,
  p_community_id text,
  p_limit        int default 1
) returns table (
  reward_id       uuid,
  title           text,
  description     text,
  image_url       text,
  point_cost      integer,
  requires_tier   text,
  affinity_score  real,
  match_count     int
)
language sql
security definer  -- bypass RLS so we can read all reward embeddings;
                  -- the WHERE clauses do all the per-fan gating.
stable
set search_path = public
as $$
  with past_redemptions as (
    -- Pull the embedding of every past reward this fan has redeemed.
    -- 'pending' counts because the redemption was already a strong
    -- positive signal; 'cancelled' doesn't (it's the fan changing
    -- their mind). Cap at 20 so a long history doesn't blow up the
    -- cross-join below.
    select rr.reward_id, e.embedding
    from public.reward_redemptions rr
    join public.content_embeddings e
      on e.source_table = 'rewards_catalog'
     and e.source_id   = rr.reward_id
    where rr.fan_id = p_fan_id
      and rr.status in ('pending','fulfilled')
    order by rr.created_at desc
    limit 20
  ),
  candidates as (
    -- Every active reward in this community that the fan can actually
    -- afford and is tier-eligible for, minus anything they redeemed in
    -- the last 30 days (so we don't re-suggest the same item).
    select
      rc.id, rc.title, rc.description, rc.image_url,
      rc.point_cost, rc.requires_tier,
      e.embedding as cand_embedding
    from public.rewards_catalog rc
    join public.content_embeddings e
      on e.source_table = 'rewards_catalog'
     and e.source_id   = rc.id
    where rc.community_id = p_community_id
      and rc.active = true
      and rc.point_cost <= (
        select coalesce(total_points, 0)
        from public.fans
        where id = p_fan_id
      )
      and (
        rc.requires_tier is null
        or (rc.requires_tier = 'premium'
            and public.is_premium(p_fan_id, p_community_id))
        or (rc.requires_tier = 'founder-only'
            and public.is_founder(p_fan_id, p_community_id))
      )
      and not exists (
        select 1
        from public.reward_redemptions rr2
        where rr2.fan_id    = p_fan_id
          and rr2.reward_id = rc.id
          and rr2.created_at > now() - interval '30 days'
      )
  )
  -- Score each candidate by summing cosine similarity (= 1 - distance)
  -- across the fan's past redemptions. Higher = better match.
  select
    c.id           as reward_id,
    c.title,
    c.description,
    c.image_url,
    c.point_cost,
    c.requires_tier,
    sum(1 - (c.cand_embedding <=> p.embedding))::real as affinity_score,
    count(*)::int                                     as match_count
  from candidates c, past_redemptions p
  group by 1, 2, 3, 4, 5, 6
  order by affinity_score desc
  limit p_limit;
$$;

comment on function public.recommend_rewards_for_fan is
  'Returns rewards ranked by affinity to the fan''s past redemption
   history (sum of cosine similarities across past-redeemed reward
   embeddings). Filters by community, active status, affordability,
   tier eligibility, and a 30-day recency penalty. Returns 0 rows if
   the fan has no past redemptions — caller should fall back to a
   popularity- or curation-based default.';

grant execute on function public.recommend_rewards_for_fan to anon, authenticated;
