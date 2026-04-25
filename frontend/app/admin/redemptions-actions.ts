"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin";
import { redirect } from "next/navigation";

export async function markFulfilledAction(redemptionId: string, fulfillmentNote: string) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reward_redemptions")
    .update({
      status: "fulfilled",
      fulfillment_note: fulfillmentNote || null,
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", redemptionId)
    .eq("community_id", ctx.currentCommunityId || "");

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function cancelRedemptionAction(
  redemptionId: string,
  fanId: string,
  pointCost: number
) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const supabase = createAdminClient();

  // Get the redemption to verify community
  const { data: redemption, error: fetchError } = await supabase
    .from("reward_redemptions")
    .select("*")
    .eq("id", redemptionId)
    .maybeSingle();

  if (fetchError || !redemption) {
    return { error: "Redemption not found" };
  }

  if (redemption.community_id !== ctx.currentCommunityId && !ctx.isSuperAdmin) {
    return { error: "Unauthorized" };
  }

  // Update status
  const { error: updateError } = await supabase
    .from("reward_redemptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", redemptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Refund points: read current, then update (no race concern — refunds are
  // admin-triggered and low-volume).
  const { data: currentFan } = await supabase
    .from("fans")
    .select("total_points")
    .eq("id", fanId)
    .maybeSingle();
  const currentPoints = (currentFan?.total_points as number | null) ?? 0;
  await supabase
    .from("fans")
    .update({ total_points: currentPoints + pointCost })
    .eq("id", fanId);

  // Ledger entry for audit trail.
  await supabase.from("points_ledger").insert([
    {
      fan_id: fanId,
      delta: pointCost,
      source: "reward_redemption",
      source_ref: `redemption:${redemptionId}:refund`,
      note: "Refunded: redemption cancelled",
    },
  ]);

  return { success: true };
}
