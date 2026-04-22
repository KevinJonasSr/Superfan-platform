"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function completeFanActionAction(formData: FormData) {
  const actionId = String(formData.get("action_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  if (!actionId || !artistSlug) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Insert completion (trigger awards points + guards against duplicates via PK)
  await supabase
    .from("fan_action_completions")
    .insert({ fan_id: user.id, action_id: actionId })
    .select();

  revalidatePath(`/artists/${artistSlug}/community`);
}
