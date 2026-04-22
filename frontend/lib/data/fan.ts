import { createClient } from "@/lib/supabase/server";
import type { FanKpis, FanProfile, Tier } from "./types";
import { getTiers } from "./tiers";

/**
 * Fetches the current user's fan profile. Returns null for signed-out or
 * unconfigured-Supabase — callers should fall back to static preview content.
 */
export async function getCurrentFan(): Promise<FanProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("fans")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("getCurrentFan: supabase error", error.message);
      return null;
    }

    return data as FanProfile | null;
  } catch (err) {
    console.warn("getCurrentFan: failed", err);
    return null;
  }
}

/**
 * Rolls up the fan's headline KPIs: total points, referrals, badges,
 * distance to next tier.
 */
export async function getCurrentFanKpis(): Promise<FanKpis | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [fanRes, referralsRes, badgesRes, tiers] = await Promise.all([
      supabase.from("fans").select("total_points,current_tier").eq("id", user.id).maybeSingle(),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
      supabase.from("fan_badges").select("badge_slug", { count: "exact", head: true }).eq("fan_id", user.id),
      getTiers(),
    ]);

    if (fanRes.error) {
      console.warn("getCurrentFanKpis fans:", fanRes.error.message);
      return null;
    }

    const total_points = fanRes.data?.total_points ?? 0;
    const referral_count = referralsRes.count ?? 0;
    const badge_count = badgesRes.count ?? 0;

    const next_tier =
      tiers
        .filter((t) => t.min_points > total_points)
        .sort((a, b) => a.min_points - b.min_points)[0] ?? null;

    const points_to_next_tier = next_tier
      ? Math.max(0, next_tier.min_points - total_points)
      : null;

    return {
      total_points,
      referral_count,
      badge_count,
      next_tier: (next_tier ?? null) as Tier | null,
      points_to_next_tier,
    };
  } catch (err) {
    console.warn("getCurrentFanKpis: failed", err);
    return null;
  }
}
