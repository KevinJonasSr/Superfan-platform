-- ============================================================================
-- 0025_moderation.sql — Fan Engage AI infrastructure: post/comment moderation
-- ============================================================================
-- Phase 2 of FAN_ENGAGE_AI_RECOMMENDATIONS.md (recommendation #2).
--
-- Adds moderation columns to community_posts + community_comments so every
-- piece of user-generated content gets an automated safety classification:
--
--   pending      — newly created, not yet classified (default)
--   safe         — classifier said it's clean; visible normally
--   flag_review  — visible but in admin queue; human should look
--   auto_hide    — hidden from non-author/non-admin readers
--
-- Plus structured metadata: severity (0-5), categories (text[]), reason
-- (the classifier's human-readable explanation), and provenance fields so
-- we can re-classify when prompts change.
--
-- Also adds:
--   * Updated RLS on community_posts so auto_hide posts only show to author
--     + community admins. Same on community_comments.
--   * moderation_decisions table — audit log of every classification
--     decision, including admin overrides. Useful for retrospectives,
--     prompt tuning, and dispute resolution.
--   * list_pending_moderation() helper used by the backfill cron.
--
-- Idempotent. Safe to re-run.
--
-- Cost reference (Anthropic claude-haiku-4-5 @ $0.25/M input, $1.25/M output):
--   * ~200 input tokens (post body + system prompt) + ~150 output tokens
--   * ~$0.0001 per classification
--   * 1,000 posts/month → $0.10/month
--   * 100,000 posts/month → $10/month
--   Trivial at any realistic scale.
-- ============================================================================

-- ─── 1. Moderation columns on community_posts ──────────────────────────────
alter table public.community_posts
  add column if not exists moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'safe', 'flag_review', 'auto_hide')),
  add column if not exists moderation_severity smallint check (moderation_severity between 0 and 5),
  add column if not exists moderation_categories text[],
  add column if not exists moderation_reason text,
  -- self_harm is its own dimension separate from severity. A self-harm
  -- post is NOT auto-hidden (the recs doc explicitly says: leave it visible,
  -- show empathetic banner + crisis resources; this is help-seeking behavior).
  add column if not exists moderation_self_harm boolean not null default false,
  add column if not exists moderation_classified_at timestamptz,
  add column if not exists moderation_model text,
  add column if not exists moderation_prompt_version text;

comment on column public.community_posts.moderation_status   is 'pending → safe | flag_review | auto_hide. Set by the moderation classifier; overridable by admins.';
comment on column public.community_posts.moderation_severity is '0=safe, 5=auto-hide territory. severity 2-3 is flag_review, 4-5 is auto_hide.';
comment on column public.community_posts.moderation_self_harm is 'True if classifier detected self-harm signals. Post stays visible (per FAN_ENGAGE_AI_RECOMMENDATIONS.md) but UI surfaces crisis resources.';

create index if not exists community_posts_moderation_idx
  on public.community_posts (moderation_status)
  where moderation_status in ('pending', 'flag_review', 'auto_hide');

-- ─── 2. Moderation columns on community_comments ──────────────────────────
alter table public.community_comments
  add column if not exists moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'safe', 'flag_review', 'auto_hide')),
  add column if not exists moderation_severity smallint check (moderation_severity between 0 and 5),
  add column if not exists moderation_categories text[],
  add column if not exists moderation_reason text,
  add column if not exists moderation_self_harm boolean not null default false,
  add column if not exists moderation_classified_at timestamptz,
  add column if not exists moderation_model text,
  add column if not exists moderation_prompt_version text;

create index if not exists community_comments_moderation_idx
  on public.community_comments (moderation_status)
  where moderation_status in ('pending', 'flag_review', 'auto_hide');

-- ─── 3. RLS update on community_posts — hide auto_hide rows ───────────────
-- The existing community_posts_public_read policy lets anyone read any
-- non-deleted post. Now we add an additional filter: auto_hide posts are
-- only visible to the author + community admins.
--
-- Because Postgres ORs select policies together, simply adding a more
-- restrictive policy doesn't tighten access. We replace the public_read
-- policy in place.

drop policy if exists community_posts_public_read on public.community_posts;
create policy community_posts_public_read on public.community_posts
  for select using (
    moderation_status in ('pending', 'safe', 'flag_review')
    -- 'pending' rows are visible during the brief window before the
    -- classifier runs (~5 sec inline, up to 15 min if backfill is path).
    -- This trades a small risk window for not silently breaking new posts
    -- if the moderation pipeline is briefly down.
  );

-- Authors can always see their own posts even if auto_hidden — gives them
-- a path to read their flagged content and request an admin review.
drop policy if exists community_posts_author_read on public.community_posts;
create policy community_posts_author_read on public.community_posts
  for select to authenticated using (auth.uid() = author_id);

-- Admins can see everything in their community.
drop policy if exists community_posts_admin_read on public.community_posts;
create policy community_posts_admin_read on public.community_posts
  for select to authenticated using (public.is_admin_of(artist_slug));

-- Same RLS pattern on community_comments.
drop policy if exists community_comments_public_read on public.community_comments;
create policy community_comments_public_read on public.community_comments
  for select using (
    moderation_status in ('pending', 'safe', 'flag_review')
  );

drop policy if exists community_comments_author_read on public.community_comments;
create policy community_comments_author_read on public.community_comments
  for select to authenticated using (auth.uid() = author_id);

drop policy if exists community_comments_admin_read on public.community_comments;
create policy community_comments_admin_read on public.community_comments
  for select to authenticated using (
    -- Admin-of relationship is on the parent post's community.
    exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and public.is_admin_of(p.artist_slug)
    )
  );

-- ─── 4. moderation_decisions audit table ──────────────────────────────────
-- Every classification or admin override appends here. We never overwrite —
-- the row history is the audit trail. Useful for:
--   * Tuning the classifier prompt (look at admin overrides)
--   * Proving compliance / handling disputes
--   * Building per-author moderation reputation later
create table if not exists public.moderation_decisions (
  id              uuid primary key default gen_random_uuid(),
  source_table    text not null check (source_table in ('community_posts', 'community_comments')),
  source_id       uuid not null,
  -- Who made the decision: 'ai' | 'admin' | 'system' (e.g., bulk import)
  decided_by      text not null check (decided_by in ('ai', 'admin', 'system')),
  -- For admin overrides, the user_id of the admin
  admin_user_id   uuid references auth.users(id) on delete set null,
  prior_status    text,
  new_status      text not null check (new_status in ('pending', 'safe', 'flag_review', 'auto_hide')),
  severity        smallint check (severity between 0 and 5),
  categories      text[],
  reason          text,
  self_harm       boolean not null default false,
  -- Provenance for AI decisions
  model           text,
  prompt_version  text,
  -- For admin overrides, optional notes
  admin_notes     text,
  created_at      timestamptz not null default now()
);

comment on table public.moderation_decisions is 'Append-only audit log of every moderation decision (AI classifications + admin overrides). Powers retrospectives, prompt tuning, and dispute resolution.';

create index if not exists moderation_decisions_source_idx
  on public.moderation_decisions (source_table, source_id, created_at desc);

create index if not exists moderation_decisions_admin_idx
  on public.moderation_decisions (admin_user_id, created_at desc)
  where decided_by = 'admin';

alter table public.moderation_decisions enable row level security;

-- Only admins can read the audit log. No public access.
drop policy if exists moderation_decisions_admin_read on public.moderation_decisions;
create policy moderation_decisions_admin_read on public.moderation_decisions
  for select to authenticated using (
    -- Admin of the relevant community (resolved via the source row)
    exists (
      select 1 from public.community_posts p
      where source_table = 'community_posts'
        and p.id = moderation_decisions.source_id
        and public.is_admin_of(p.artist_slug)
    )
    or exists (
      select 1 from public.community_comments c
      join public.community_posts p on p.id = c.post_id
      where source_table = 'community_comments'
        and c.id = moderation_decisions.source_id
        and public.is_admin_of(p.artist_slug)
    )
  );

grant select on public.moderation_decisions to authenticated;
grant all on public.moderation_decisions to service_role;

-- ─── 5. Helper: list pending rows for the backfill cron ────────────────────
create or replace function public.list_pending_moderation(
  p_limit int default 50
) returns table (
  source_table text,
  source_id    uuid,
  body_text    text,
  context      jsonb
)
language sql
security definer
stable
as $$
  -- community_posts pending classification
  select
    'community_posts'::text,
    p.id,
    coalesce(p.title || E'\n\n' || p.body, p.body),
    jsonb_build_object(
      'community_id', p.artist_slug,
      'kind', p.kind,
      'visibility', p.visibility
    )
  from public.community_posts p
  where p.moderation_status = 'pending'
    and coalesce(length(p.body), 0) > 0
  union all

  -- community_comments pending classification
  select
    'community_comments'::text,
    c.id,
    c.body,
    jsonb_build_object(
      'community_id', p.artist_slug,
      'post_id', c.post_id,
      'parent_post_kind', p.kind
    )
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  where c.moderation_status = 'pending'
    and coalesce(length(c.body), 0) > 0

  limit p_limit;
$$;

comment on function public.list_pending_moderation is 'Returns rows from community_posts + community_comments that are still pending moderation classification. Used by /api/cron/moderation-backfill.';

grant execute on function public.list_pending_moderation to service_role;

-- ─── 6. Helper: apply a moderation decision atomically ────────────────────
-- Takes the result of a classification and writes BOTH the source row's
-- moderation columns AND a moderation_decisions audit row in a single
-- transaction. Callers (the classify worker + admin override actions)
-- both go through this so the audit log can never drift from the
-- source row's actual status.
create or replace function public.apply_moderation_decision(
  p_source_table   text,
  p_source_id      uuid,
  p_decided_by     text,
  p_admin_user_id  uuid,
  p_new_status     text,
  p_severity       smallint,
  p_categories     text[],
  p_reason         text,
  p_self_harm      boolean,
  p_model          text,
  p_prompt_version text,
  p_admin_notes    text
) returns void
language plpgsql
security definer
as $$
declare
  v_prior_status text;
begin
  -- Fetch prior status for the audit log.
  if p_source_table = 'community_posts' then
    select moderation_status into v_prior_status
    from public.community_posts where id = p_source_id;
  elsif p_source_table = 'community_comments' then
    select moderation_status into v_prior_status
    from public.community_comments where id = p_source_id;
  else
    raise exception 'Unknown source_table: %', p_source_table;
  end if;

  -- Update the source row.
  if p_source_table = 'community_posts' then
    update public.community_posts set
      moderation_status      = p_new_status,
      moderation_severity    = p_severity,
      moderation_categories  = p_categories,
      moderation_reason      = p_reason,
      moderation_self_harm   = p_self_harm,
      moderation_classified_at = now(),
      moderation_model       = p_model,
      moderation_prompt_version = p_prompt_version
    where id = p_source_id;
  else
    update public.community_comments set
      moderation_status      = p_new_status,
      moderation_severity    = p_severity,
      moderation_categories  = p_categories,
      moderation_reason      = p_reason,
      moderation_self_harm   = p_self_harm,
      moderation_classified_at = now(),
      moderation_model       = p_model,
      moderation_prompt_version = p_prompt_version
    where id = p_source_id;
  end if;

  -- Append to audit log.
  insert into public.moderation_decisions (
    source_table, source_id, decided_by, admin_user_id,
    prior_status, new_status, severity, categories, reason,
    self_harm, model, prompt_version, admin_notes
  ) values (
    p_source_table, p_source_id, p_decided_by, p_admin_user_id,
    v_prior_status, p_new_status, p_severity, p_categories, p_reason,
    p_self_harm, p_model, p_prompt_version, p_admin_notes
  );
end;
$$;

comment on function public.apply_moderation_decision is 'Atomically updates a source row''s moderation columns AND appends an audit row to moderation_decisions. All moderation writes (AI + admin) go through this.';

grant execute on function public.apply_moderation_decision to service_role;

-- ─── 7. Verify (commented; uncomment to spot-check) ───────────────────────
-- select count(*), moderation_status from public.community_posts group by 2;
-- select * from public.list_pending_moderation(5);
-- \d public.moderation_decisions
