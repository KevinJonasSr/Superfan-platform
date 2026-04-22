"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFollowAction(formData: FormData) {
  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const wantFollow = String(formData.get("follow") ?? "true") === "true";
  if (!artistSlug) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (wantFollow) {
    await supabase
      .from("fan_artist_following")
      .upsert(
        { fan_id: user.id, artist_slug: artistSlug },
        { onConflict: "fan_id,artist_slug" },
      );
  } else {
    await supabase
      .from("fan_artist_following")
      .delete()
      .eq("fan_id", user.id)
      .eq("artist_slug", artistSlug);
  }

  revalidatePath(`/artists/${artistSlug}`);
  revalidatePath(`/artists/${artistSlug}/community`);
}
