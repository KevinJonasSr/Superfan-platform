/**
 * Match an event against the artist's followers, score them, and
 * write the result to event_match_log.
 *
 * Pure data flow — no notifications fired here. The send step is a
 * separate function (sendEventMatchNotifications) that the admin
 * triggers explicitly from the preview UI.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  scoreFan,
  CANDIDATE_TOP_PERCENT,
  CANDIDATE_MIN_SCORE,
  type ScoreComponents,
} from "./score";

export interface MatchedFan {
  fan_id: string;
  first_name: string | null;
  email: string | null;
  city: string | null;
  tier: "bronze" | "silver" | "gold" | "platinum" | "founder";
  sms_opted_in: boolean;
  total_score: number;
  components: ScoreComponents;
  is_candidate: boolean;
}

export interface MatchEventResult {
  event_id: string;
  artist_slug: string;
  total_followers: number;
  scored: number;
  candidates: number;
  fans: MatchedFan[];
}

/**
 * Score every follower of an event's artist and persist the result.
 * Idempotent — re-running just overwrites the rows for that event.
 */
export async function matchEvent(eventId: string): Promise<MatchEventResult> {
  const admin = createAdminClient();

  // 1. Load the event.
  const { data: event, error: eventErr } = await admin
    .from("artist_events")
    .select("id, artist_slug, location, starts_at, active")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event) {
    throw new Error(`event ${eventId} not found: ${eventErr?.message ?? "no row"}`);
  }
  if (!event.active) {
    throw new Error(`event ${eventId} is not active`);
  }

  // 2. Load the artist's followers with the data we need to score.
  const { data: followingRows } = await admin
    .from("fan_artist_following")
    .select("fan_id")
    .eq("artist_slug", event.artist_slug);
  const followerIds = (followingRows ?? []).map((r) => r.fan_id as string);

  if (followerIds.length === 0) {
    return {
      event_id: eventId,
      artist_slug: event.artist_slug as string,
      total_followers: 0,
      scored: 0,
      candidates: 0,
      fans: [],
    };
  }

  const { data: fans } = await admin
    .from("fans")
    .select(
      "id, first_name, email, phone, city, current_tier, sms_opted_in, suspended",
    )
    .in("id", followerIds);

  const fanRows = ((fans ?? []) as Array<{
    id: string;
    first_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    current_tier: "bronze" | "silver" | "gold" | "platinum" | "founder";
    sms_opted_in: boolean;
    suspended: boolean | null;
  }>).filter((f) => !f.suspended);

  // 3. Per-fan past RSVP rate against this artist.
  const pastRates = await loadPastRsvpRates(
    event.artist_slug as string,
    eventId,
    fanRows.map((f) => f.id),
  );

  // 4. Per-fan recent engagement decay.
  const engagementMap = await loadEngagementSignal(
    event.artist_slug as string,
    fanRows.map((f) => f.id),
  );

  // 5. Score everyone.
  const scored: MatchedFan[] = fanRows.map((f) => {
    const { total, components } = scoreFan({
      fan_city: f.city,
      event_location: (event.location as string | null) ?? null,
      past_rsvp_rate: pastRates.get(f.id) ?? 0,
      engagement: engagementMap.get(f.id) ?? 0,
      fan_tier: f.current_tier,
    });
    return {
      fan_id: f.id,
      first_name: f.first_name,
      email: f.email,
      city: f.city,
      tier: f.current_tier,
      sms_opted_in: f.sms_opted_in === true,
      total_score: total,
      components,
      is_candidate: false, // filled in after we know the cutoff
    };
  });

  // 6. Apply the top-25% cap with a min-score floor.
  scored.sort((a, b) => b.total_score - a.total_score);
  const cap = Math.max(1, Math.ceil(scored.length * CANDIDATE_TOP_PERCENT));
  for (let i = 0; i < scored.length; i++) {
    scored[i].is_candidate =
      i < cap && scored[i].total_score >= CANDIDATE_MIN_SCORE;
  }

  // 7. Persist into event_match_log. Upsert keyed on (event_id, fan_id).
  if (scored.length > 0) {
    const { error: upsertErr } = await admin.from("event_match_log").upsert(
      scored.map((s) => ({
        event_id: eventId,
        fan_id: s.fan_id,
        total_score: s.total_score,
        score_components: s.components,
        is_candidate: s.is_candidate,
      })),
      { onConflict: "event_id,fan_id" },
    );
    if (upsertErr) {
      throw new Error(`event_match_log upsert failed: ${upsertErr.message}`);
    }
  }

  // 8. Mark the event as processed.
  await admin
    .from("artist_events")
    .update({ match_processed_at: new Date().toISOString() })
    .eq("id", eventId);

  const candidates = scored.filter((s) => s.is_candidate).length;
  return {
    event_id: eventId,
    artist_slug: event.artist_slug as string,
    total_followers: followerIds.length,
    scored: scored.length,
    candidates,
    fans: scored,
  };
}

/**
 * For each fan, compute (RSVPs to past events of this artist) /
 * (total past events of this artist). Cap at 1.0.
 */
async function loadPastRsvpRates(
  artistSlug: string,
  excludeEventId: string,
  fanIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (fanIds.length === 0) return out;

  const admin = createAdminClient();

  // Total past events for this artist (excluding the current one).
  const { count: pastEventCount } = await admin
    .from("artist_events")
    .select("id", { head: true, count: "exact" })
    .eq("artist_slug", artistSlug)
    .neq("id", excludeEventId)
    .lt("starts_at", new Date().toISOString());

  const denom = pastEventCount ?? 0;
  if (denom === 0) {
    // No past events yet — every fan gets a 0 here, the engagement
    // and tier components carry the score.
    for (const id of fanIds) out.set(id, 0);
    return out;
  }

  // Pull RSVPs by these fans against past events of this artist.
  const { data } = await admin
    .from("event_rsvps")
    .select("fan_id, event_id, artist_events!inner(artist_slug, starts_at)")
    .in("fan_id", fanIds)
    .eq("artist_events.artist_slug", artistSlug)
    .lt("artist_events.starts_at", new Date().toISOString());

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ fan_id: string }>) {
    counts.set(row.fan_id, (counts.get(row.fan_id) ?? 0) + 1);
  }
  for (const id of fanIds) {
    const c = counts.get(id) ?? 0;
    out.set(id, Math.min(1, c / denom));
  }
  return out;
}

/**
 * Recent engagement signal in [0, 1].
 *
 * v1: count of comments + reactions in the last 30 days against THIS
 *     artist's posts, normalized by 5 (so 5+ interactions = 1.0).
 *
 * v2: weight by recency (exponential decay) — easy follow-up.
 */
async function loadEngagementSignal(
  artistSlug: string,
  fanIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (fanIds.length === 0) return out;

  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  // Comments by these fans on this artist's posts.
  const { data: comments } = await admin
    .from("community_comments")
    .select("author_id, community_posts!inner(artist_slug)")
    .in("author_id", fanIds)
    .eq("community_posts.artist_slug", artistSlug)
    .gt("created_at", sinceIso);

  const counts = new Map<string, number>();
  for (const row of (comments ?? []) as Array<{ author_id: string }>) {
    counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  }

  // Normalize: 5+ interactions in 30 days = 1.0.
  for (const id of fanIds) {
    const c = counts.get(id) ?? 0;
    out.set(id, Math.min(1, c / 5));
  }
  return out;
}
