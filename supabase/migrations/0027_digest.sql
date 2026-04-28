-- ============================================================================
-- 0027_digest.sql — Fan Engage AI: weekly personalized digest emails
-- ============================================================================
-- Phase 4 of FAN_ENGAGE_AI_RECOMMENDATIONS.md (recommendation #4).
--
-- Adds:
--   1. fans.digest_subscribed boolean — per-fan opt-out for the digest
--      (defaults true; gated by email_opted_in too — fans who opted out
--      of email entirely never get a digest).
--   2. fans.last_digest_sent_at timestamptz — bookkeeping for the cron
--      so we can avoid double-sends + spread sends over multiple ticks
--      if needed.
--   3. digest_log table — audit row per (fan, week) with the rendered
--      HTML, the Mailchimp campaign id, and a status.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ─── 1. fans columns ───────────────────────────────────────────────────────
alter table public.fans
  add column if not exists digest_subscribed boolean not null default true,
  add column if not exists last_digest_sent_at timestamptz;

comment on column public.fans.digest_subscribed   is 'Per-fan opt-out for the AI weekly digest. Default true; honored alongside email_opted_in (fans who opted out of email entirely never get a digest regardless of this flag).';
comment on column public.fans.last_digest_sent_at is 'Timestamp of the last digest send to this fan. Used by the cron to skip fans who got one within the last 6 days, so retries / partial sends never double-deliver.';

create index if not exists fans_digest_subscribed_idx
  on public.fans (digest_subscribed, last_digest_sent_at)
  where digest_subscribed = true and email_opted_in = true and suspended = false;

-- ─── 2. digest_log table ──────────────────────────────────────────────────
create table if not exists public.digest_log (
  id                       uuid primary key default gen_random_uuid(),
  fan_id                   uuid not null references public.fans(id) on delete cascade,
  -- When this digest covers (week start, Monday 00:00 UTC of the relevant week)
  week_start               date not null,
  -- When the cron actually fired the send
  sent_at                  timestamptz not null default now(),

  -- Outcome
  status                   text not null default 'queued'
                            check (status in ('queued', 'rendered', 'merge_fields_updated', 'sent', 'skipped', 'error')),
  error_message            text,

  -- Provenance — content + Mailchimp tracking
  html_body                text,                 -- rendered HTML stuffed into DIGEST_BLOCK merge field
  text_body                text,                 -- plain-text fallback
  mailchimp_campaign_id    text,                 -- the campaign that delivered the digest
  ai_summary_count         smallint,             -- how many community vibe summaries we generated
  payload_communities      text[],               -- which communities the fan got content for
  payload_post_ids         uuid[],               -- which posts featured (for impression analytics)

  -- One row per (fan, week)
  unique (fan_id, week_start)
);

comment on table  public.digest_log is 'Append-only-per-(fan,week) audit of weekly AI digest sends. Tracks rendered HTML, Mailchimp campaign id, status, and which posts featured. Powers retrospectives + impression analytics.';
comment on column public.digest_log.week_start is 'Monday 00:00 UTC of the week the digest covers. Lets us answer "what did I send to fan X for week of Apr 21".';
comment on column public.digest_log.payload_post_ids is 'Posts that featured in this digest. Joined back to community_posts later for impression analytics ("how often did fan X actually click through to post Y after seeing it in a digest").';

create index if not exists digest_log_week_idx        on public.digest_log (week_start desc);
create index if not exists digest_log_fan_idx         on public.digest_log (fan_id, week_start desc);
create index if not exists digest_log_status_idx      on public.digest_log (status, sent_at desc) where status in ('error', 'skipped');
create index if not exists digest_log_campaign_idx    on public.digest_log (mailchimp_campaign_id) where mailchimp_campaign_id is not null;

alter table public.digest_log enable row level security;

-- Service role writes (cron). Admins of any community can read for ops
-- — this is platform-level audit data, not per-tenant.
drop policy if exists digest_log_admin_read on public.digest_log;
create policy digest_log_admin_read on public.digest_log
  for select to authenticated using (
    exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.role in ('owner', 'admin')
    )
  );

grant select on public.digest_log to authenticated;
grant all on public.digest_log to service_role;

-- ─── 3. Helper: list digest recipients for the cron ───────────────────────
-- Returns active opted-in fans who haven't received a digest in the last
-- 6 days. The cron uses this to find work without double-counting recent
-- sends across partial-failure retries.
create or replace function public.list_digest_recipients(
  p_limit int default 500
) returns table (
  fan_id        uuid,
  email         text,
  first_name    text,
  total_points  integer,
  current_tier  text
)
language sql
security definer
stable
as $$
  select
    f.id, f.email, f.first_name, f.total_points, f.current_tier::text
  from public.fans f
  where f.digest_subscribed = true
    and f.email_opted_in   = true
    and f.suspended        = false
    and f.email is not null
    and (
      f.last_digest_sent_at is null
      or f.last_digest_sent_at < (now() - interval '6 days')
    )
  order by f.last_digest_sent_at asc nulls first
  limit p_limit;
$$;

comment on function public.list_digest_recipients is
  'Active opted-in fans who haven''t received a digest in the last 6 days. Ordered by oldest send first so a partial run still makes forward progress. Used by /api/cron/weekly-digest.';

grant execute on function public.list_digest_recipients to service_role;

-- ─── 4. Verify (commented; uncomment to spot-check) ─────────────────────
-- select count(*) from public.list_digest_recipients(500);
-- select status, count(*) from public.digest_log group by 1;
-- \d public.digest_log
