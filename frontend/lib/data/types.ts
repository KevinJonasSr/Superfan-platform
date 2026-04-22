// Shared TS shapes for data-layer queries.
// These mirror the migration in supabase/migrations/0001_init.sql.

export type TierSlug = "bronze" | "silver" | "gold" | "platinum";

export type OfferCategory =
  | "merch"
  | "experience"
  | "collectible"
  | "digital"
  | "ticket";

export type PurchaseStatus =
  | "pending"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export interface Tier {
  slug: TierSlug;
  display_name: string;
  min_points: number;
  perks: string[];
  sort_order: number;
}

export interface FanProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  phone: string | null;
  handle: string | null;
  favorite_song: string | null;
  interest: string | null;
  referral_code: string | null;
  referred_by: string | null;
  total_points: number;
  current_tier: TierSlug;
  sms_opted_in: boolean;
  email_opted_in: boolean;
}

export interface FanKpis {
  total_points: number;
  referral_count: number;
  badge_count: number;
  next_tier: Tier | null;
  points_to_next_tier: number | null;
}

export interface Offer {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: OfferCategory;
  price_points: number | null;
  price_cents: number | null;
  min_tier: TierSlug;
  inventory: number | null;
  image_url: string | null;
  active: boolean;
}

export interface Badge {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  point_value: number;
  earned: boolean;
  earned_at: string | null;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referred_email: string | null;
  status: string;
  points_awarded: number;
  created_at: string;
  verified_at: string | null;
}

export interface LeaderboardRow {
  fan_id: string;
  display_name: string;
  referral_count: number;
}

// ─── Community Hub ─────────────────────────────────────────────────────────

export type CommunityPostKind = "post" | "announcement" | "poll" | "challenge";

export interface CommunityPost {
  id: string;
  artist_slug: string;
  author_id: string;
  author_first_name: string | null;
  kind: CommunityPostKind;
  title: string | null;
  body: string;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  reaction_counts: Record<string, number>; // { "❤️": 3, "🔥": 2 }
  my_reactions: string[]; // emoji list the current fan has already given
  comment_count: number;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author_first_name: string | null;
  body: string;
  created_at: string;
}
