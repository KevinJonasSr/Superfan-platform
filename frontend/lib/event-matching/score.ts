/**
 * Event-match scoring.
 *
 * Given an event and the fans who follow that event's artist, score
 * each fan on:
 *
 *   geo            — does the fan live near the event's location?
 *   past_rsvp_rate — has the fan RSVPed to this artist's events before?
 *   engagement     — has the fan reacted to / commented on similar
 *                    posts recently?
 *   tier_weight    — premium / founder fans rank above bronze
 *
 * Each component is in [0, 1]. Total score is a weighted sum, also
 * clamped to [0, 1]. The weights are constants here so they're easy
 * to retune from telemetry once we have real data.
 *
 * Honest caveat on geo: `fans.city` and `artist_events.location` are
 * both free-text — there's no lat/lng. v1 score is string-equality on
 * the city portion plus a softer state-substring fallback. Real
 * geocoding is a Phase 8.7 upgrade documented in the post-launch
 * checklist.
 */

export const SCORE_WEIGHTS = {
  geo: 0.4,
  past_rsvp_rate: 0.3,
  engagement: 0.2,
  tier_weight: 0.1,
} as const;

export interface ScoreComponents {
  geo: number;
  past_rsvp_rate: number;
  engagement: number;
  tier_weight: number;
}

export interface ScoreInput {
  /** Free-text city from fans.city, e.g. "Charlotte, NC". May be null. */
  fan_city: string | null;
  /** Free-text location from artist_events.location, e.g. "Charlotte, NC". */
  event_location: string | null;
  /**
   * Number of times this fan has RSVPed to past events from this
   * artist, divided by the artist's total past event count.
   * Defaults to 0 when the fan has no history.
   */
  past_rsvp_rate: number;
  /**
   * Recent engagement signal in [0, 1]. Computed upstream from
   * reactions + comments + post views in the last 30 days, decayed
   * exponentially toward 0.
   */
  engagement: number;
  /** One of the tier slugs. */
  fan_tier: "bronze" | "silver" | "gold" | "platinum" | "founder";
}

/** Pure function — easy to unit test. */
export function scoreFan(input: ScoreInput): {
  total: number;
  components: ScoreComponents;
} {
  const components: ScoreComponents = {
    geo: scoreGeo(input.fan_city, input.event_location),
    past_rsvp_rate: clamp01(input.past_rsvp_rate),
    engagement: clamp01(input.engagement),
    tier_weight: scoreTier(input.fan_tier),
  };

  const total = clamp01(
    components.geo * SCORE_WEIGHTS.geo +
      components.past_rsvp_rate * SCORE_WEIGHTS.past_rsvp_rate +
      components.engagement * SCORE_WEIGHTS.engagement +
      components.tier_weight * SCORE_WEIGHTS.tier_weight,
  );

  return { total, components };
}

/**
 * Geo score in [0, 1]. v1 algorithm:
 *
 *   1.0 — fan_city is a substring of event_location (or vice versa)
 *   0.5 — same state (last comma-separated token matches, e.g. "NC")
 *   0.0 — otherwise (or when either side is empty / null)
 *
 * v2 (post-launch): geocode both into lat/lng, return a sigmoid over
 * distance in miles. Tracked in LAUNCH_CHECKLIST.md.
 */
export function scoreGeo(
  fanCity: string | null,
  eventLocation: string | null,
): number {
  if (!fanCity || !eventLocation) return 0;
  const a = fanCity.trim().toLowerCase();
  const b = eventLocation.trim().toLowerCase();
  if (!a || !b) return 0;

  // Same / contained city.
  if (a === b || a.includes(b) || b.includes(a)) return 1;

  // Same state — last comma-separated token.
  const stateOf = (s: string) => {
    const parts = s.split(",").map((p) => p.trim());
    return parts[parts.length - 1] || "";
  };
  const sa = stateOf(a);
  const sb = stateOf(b);
  if (sa && sa === sb) return 0.5;

  return 0;
}

/**
 * Tier score in [0, 1]. Premium / founder fans get a meaningful nudge
 * because they're paying — but the weight is small (10%) so a Bronze
 * fan with strong other signals can still beat a Premium fan with no
 * geo / engagement history.
 */
export function scoreTier(tier: ScoreInput["fan_tier"]): number {
  switch (tier) {
    case "founder":
      return 1.0;
    case "platinum":
      return 0.85;
    case "gold":
      return 0.7;
    case "silver":
      return 0.5;
    case "bronze":
    default:
      return 0.25;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Top-N% cap configuration. The recs doc calls for 25%. */
export const CANDIDATE_TOP_PERCENT = 0.25;

/** Minimum score floor — even within the top 25%, fans below this
 *  threshold get dropped. Keeps notifications relevant when the
 *  follower pool is small. */
export const CANDIDATE_MIN_SCORE = 0.15;
