-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 5c: atomic founder-slot claim
--
-- Race-safe founder number assignment. The webhook handler calls this
-- when processing customer.subscription.created — if two webhooks for
-- the same community race at the boundary (slot 99 + slot 100), the
-- advisory lock serializes them: one gets #99, the other gets #100 or
-- null (cap hit). Unique index on (community_id, founder_number) is
-- the belt + suspenders backstop.
--
-- Safe to re-run (idempotent).
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.claim_founder_slot(
  p_fan_id      uuid,
  p_community_id text
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_cap   integer;
  v_taken integer;
  v_next  integer;
  v_lock  bigint;
begin
  -- Per-community advisory lock — serializes concurrent claim calls for
  -- the same community. Held until the transaction commits.
  v_lock := ('x' || substr(md5(p_community_id), 1, 15))::bit(60)::bigint;
  perform pg_advisory_xact_lock(v_lock);

  select founder_cap into v_cap from communities where slug = p_community_id;
  if v_cap is null then return null; end if;

  select count(*) into v_taken
    from fan_community_memberships
    where community_id = p_community_id
      and founder_number is not null;

  if v_taken >= v_cap then return null; end if;

  v_next := v_taken + 1;

  -- Atomically write founder_number + is_founder on the fan's membership.
  update fan_community_memberships
     set founder_number = v_next,
         is_founder     = true
   where fan_id = p_fan_id
     and community_id = p_community_id;

  return v_next;
end $$;


-- ─── Smoke-test ────────────────────────────────────────────────────────────
-- -- Try claiming a slot for a test fan/community (no-op if already has one):
-- select public.claim_founder_slot(
--   (select id from fans limit 1),
--   'raelynn'
-- );
