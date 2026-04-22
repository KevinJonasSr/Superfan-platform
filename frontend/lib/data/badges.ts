import { createClient } from "@/lib/supabase/server";
import type { Badge } from "./types";

/**
 * Full badge list, joined with the current user's earned status.
 * Returns an empty list when the user isn't signed in or Supabase isn't
 * reachable — pages fall back to their static preview rows.
 */
export async function getBadgesWithEarnedStatus(): Promise<Badge[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: badges, error: badgesErr } = await supabase
      .from("badges")
      .select("*")
      .order("point_value");
    if (badgesErr) throw badgesErr;
    if (!badges || badges.length === 0) return [];

    if (!user) {
      return badges.map((b) => ({ ...b, earned: false, earned_at: null }) as Badge);
    }

    const { data: earned, error: earnedErr } = await supabase
      .from("fan_badges")
      .select("badge_slug,earned_at")
      .eq("fan_id", user.id);
    if (earnedErr) throw earnedErr;

    const earnedMap = new Map(
      (earned ?? []).map((r) => [r.badge_slug, r.earned_at as string]),
    );

    return badges.map((b) => ({
      ...b,
      earned: earnedMap.has(b.slug),
      earned_at: earnedMap.get(b.slug) ?? null,
    })) as Badge[];
  } catch {
    return [];
  }
}
