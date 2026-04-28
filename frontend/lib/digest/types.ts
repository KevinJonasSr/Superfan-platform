/**
 * Shared types for the digest pipeline.
 */

export interface DigestRecipient {
  fan_id: string;
  email: string;
  first_name: string | null;
  total_points: number;
  current_tier: string;
}

export interface DigestPostHighlight {
  id: string;
  artist_slug: string;
  title: string | null;
  body: string;
  /** Engagement signal we used to rank — reaction count, primarily. */
  reaction_count: number;
  comment_count: number;
  created_at: string;
  url: string;
}

export interface DigestEvent {
  id: string;
  artist_slug: string;
  title: string;
  detail: string | null;
  event_date: string | null;
  url: string;
}

export interface DigestRewardSuggestion {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  point_cost: number;
  url: string;
}

export interface DigestCommunityBlock {
  /** community_id == artist_slug for music tenants. */
  community_id: string;
  display_name: string;
  /** AI-generated 1-line summary of this week. Filled in by summarize.ts. */
  vibe_summary?: string;
  topPosts: DigestPostHighlight[];
  upcomingEvents: DigestEvent[];
}

/** Everything the renderer needs for one fan. */
export interface DigestPayload {
  recipient: DigestRecipient;
  /** Monday 00:00 UTC of the week being summarized. */
  week_start: string;
  communities: DigestCommunityBlock[];
  /** A reward the fan can afford right now. May be null if there's
   *  nothing in their tier under their point balance. */
  rewardSuggestion: DigestRewardSuggestion | null;
}
