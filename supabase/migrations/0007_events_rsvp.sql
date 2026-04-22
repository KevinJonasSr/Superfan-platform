-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 3b: event RSVPs + capacity + per-event campaigns
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Expand artist_events with real event metadata ─────────────────────────
alter table public.artist_events
  add column if not exists capacity    integer,
  add column if not exists starts_at   timestamptz,
  add column if not exists ends_at     timestamptz,
  add column if not exists location    text,
  add column if not exists image_url   text;

create index if not exists artist_events_starts_at_idx
  on public.artist_events (starts_at);

-- ─── event_rsvps (one row per fan per event) ───────────────────────────────
create table if not exists public.event_rsvps (
  event_id   uuid not null references public.artist_events(id) on delete cascade,
  fan_id     uuid not null references public.fans(id) on delete cascade,
  rsvp_at    timestamptz not null default now(),
  primary key (event_id, fan_id)
);

create index if not exists event_rsvps_fan_idx on public.event_rsvps (fan_id, rsvp_at desc);
create index if not exists event_rsvps_event_idx on public.event_rsvps (event_id);

-- ─── Points on RSVP (+10 pts, idempotent via source_ref guard) ────────────
create or replace function public.award_event_rsvp_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  award int := 10;
  ref_id text := 'event_rsvp:' || new.event_id::text || ':' || new.fan_id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.fan_id, award, 'event_rsvp', ref_id, 'RSVPed to event');

    update fans
      set total_points = coalesce(total_points, 0) + award
    where id = new.fan_id;
  end if;
  return new;
end $$;

drop trigger if exists event_rsvps_award_points on public.event_rsvps;
create trigger event_rsvps_award_points
  after insert on public.event_rsvps
  for each row execute function public.award_event_rsvp_points();

-- ─── Capacity enforcement (block RSVP when full) ──────────────────────────
create or replace function public.enforce_event_capacity()
returns trigger language plpgsql as $$
declare
  v_capacity integer;
  v_current  integer;
begin
  select capacity into v_capacity from artist_events where id = new.event_id;
  if v_capacity is null then return new; end if;  -- unlimited

  select count(*) into v_current from event_rsvps where event_id = new.event_id;
  if v_current >= v_capacity then
    raise exception 'Event is at capacity';
  end if;
  return new;
end $$;

drop trigger if exists event_rsvps_enforce_capacity on public.event_rsvps;
create trigger event_rsvps_enforce_capacity
  before insert on public.event_rsvps
  for each row execute function public.enforce_event_capacity();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.event_rsvps enable row level security;

-- Fan can read own RSVPs
drop policy if exists event_rsvps_select_own on public.event_rsvps;
create policy event_rsvps_select_own on public.event_rsvps
  for select using (auth.uid() = fan_id);

-- Aggregate counts are public — but since the table has fan_id in it, we
-- expose a view instead of a separate public policy. Counts are fetched
-- via service-role admin client.

-- Fan can insert own RSVP
drop policy if exists event_rsvps_insert_own on public.event_rsvps;
create policy event_rsvps_insert_own on public.event_rsvps
  for insert with check (auth.uid() = fan_id);

-- Fan can delete (un-RSVP) own row
drop policy if exists event_rsvps_delete_own on public.event_rsvps;
create policy event_rsvps_delete_own on public.event_rsvps
  for delete using (auth.uid() = fan_id);

-- ─── Smoke test ────────────────────────────────────────────────────────────
-- select id, title, capacity, starts_at from artist_events order by sort_order;
-- select count(*) from event_rsvps;
