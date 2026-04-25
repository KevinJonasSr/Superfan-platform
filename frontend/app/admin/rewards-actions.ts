"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";

export async function createRewardAction(formData: FormData) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const supabase = createAdminClient();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const image_url = formData.get("image_url") as string;
  const point_cost = parseInt(formData.get("point_cost") as string);
  const kind = formData.get("kind") as string;
  const stock = formData.get("stock") ? parseInt(formData.get("stock") as string) : null;
  const requires_tier = (formData.get("requires_tier") as string) || null;

  const { data, error } = await supabase
    .from("rewards_catalog")
    .insert([
      {
        community_id: ctx.currentCommunityId,
        title,
        description: description || null,
        image_url: image_url || null,
        point_cost,
        kind,
        stock,
        requires_tier,
      },
    ])
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, rewardId: data.id };
}

export async function updateRewardAction(formData: FormData) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const rewardId = formData.get("id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const image_url = formData.get("image_url") as string;
  const point_cost = parseInt(formData.get("point_cost") as string);
  const kind = formData.get("kind") as string;
  const stock = formData.get("stock") ? parseInt(formData.get("stock") as string) : null;
  const active = formData.get("active") === "on";
  const requires_tier = (formData.get("requires_tier") as string) || null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rewards_catalog")
    .update({
      title,
      description: description || null,
      image_url: image_url || null,
      point_cost,
      kind,
      stock,
      active,
      requires_tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rewardId);

  if (error) {
    throw new Error(`updateRewardAction failed: ${error.message}`);
  }
  redirect("/admin/rewards");
}

export async function toggleRewardActiveAction(rewardId: string, active: boolean) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rewards_catalog")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", rewardId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

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
    .eq("id", redemptionId);

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

  // Update redemption status
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

  // Refund points: read current, then update.
  const { data: currentFan } = await supabase
    .from("fans")
    .select("total_points")
    .eq("id", fanId)
    .maybeSingle();
  const currentPoints = (currentFan?.total_points as number | null) ?? 0;
  const { error: pointsError } = await supabase
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
      note: `Refunded: redemption cancelled`,
    },
  ]);

  if (pointsError) {
    return { error: pointsError.message };
  }

  return { success: true };
}
