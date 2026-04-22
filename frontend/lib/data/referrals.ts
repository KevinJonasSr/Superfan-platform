import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow, Referral } from "./types";

export async function getMyReferrals(): Promise<Referral[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Referral[];
  } catch {
    return [];
  }
}

/**
 * Top referrers leaderboard. Uses the service-role client indirectly would
 * bypass RLS; for launch we just do a public query with a public-readable view
 * that we'll add in a follow-up migration. For now the query is best-effort
 * against the referrals table — RLS restricts visibility to the user's own
 * rows, so this will return empty for most users until we add the view.
 */
export async function getReferralLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  try {
    const supabase = await createClient();

    // This query needs a SQL view or service-role path to be accurate;
    // keeping a stub so the route renders and we can expose real data later.
    const { data, error } = await supabase
      .from("referrals")
      .select("referrer_id")
      .limit(limit * 10);
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const counts = new Map<string, number>();
    for (const r of data) {
      counts.set(r.referrer_id, (counts.get(r.referrer_id) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([fan_id, referral_count]) => ({
        fan_id,
        display_name: fan_id.slice(0, 6), // placeholder until we join to fans + display rules
        referral_count,
      }));
  } catch {
    return [];
  }
}
