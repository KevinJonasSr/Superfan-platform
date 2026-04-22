"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

const WINNER_BONUS_POINTS = 200;

export async function pickWinnerAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) return;
  const postId = String(formData.get("post_id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  const fanId = String(formData.get("fan_id") ?? "");
  if (!postId || !entryId || !fanId) return;

  const supa = createAdminClient();

  // Record the winner via campaign_items (item_kind='challenge_winner'), guard against dupes.
  const { data: existing } = await supa
    .from("campaign_items")
    .select("id")
    .eq("item_kind", "challenge_winner")
    .eq("ref_id", postId)
    .limit(1);
  if (existing && existing.length > 0) return;

  await supa.from("campaign_items").insert({
    campaign_id: null,
    item_kind: "challenge_winner",
    ref_id: postId,
    metadata: { entry_id: entryId, fan_id: fanId },
  });

  // Award bonus points via ledger; idempotent guard.
  const refId = `challenge_winner:${postId}:${fanId}`;
  const { data: ledgerExists } = await supa
    .from("points_ledger")
    .select("id")
    .eq("source_ref", refId)
    .limit(1);
  if (!ledgerExists || ledgerExists.length === 0) {
    await supa.from("points_ledger").insert({
      fan_id: fanId,
      delta: WINNER_BONUS_POINTS,
      source: "challenge",
      source_ref: refId,
      note: "Challenge winner bonus",
    });
    // Fetch + update fan total_points (trigger will auto-promote tier)
    const { data: fanRow } = await supa
      .from("fans")
      .select("total_points")
      .eq("id", fanId)
      .maybeSingle();
    await supa
      .from("fans")
      .update({ total_points: (fanRow?.total_points ?? 0) + WINNER_BONUS_POINTS })
      .eq("id", fanId);
  }

  revalidatePath("/admin/challenges");
  revalidatePath("/admin/community");
}
