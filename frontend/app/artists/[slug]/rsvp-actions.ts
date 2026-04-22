"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleRsvpAction(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "").trim();
  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const wantRsvp = String(formData.get("rsvp") ?? "true") === "true";
  if (!eventId || !artistSlug) return { ok: false as const, error: "Missing event" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (wantRsvp) {
    const { error } = await supabase
      .from("event_rsvps")
      .insert({ event_id: eventId, fan_id: user.id });
    if (error) {
      revalidatePath(`/artists/${artistSlug}`);
      return {
        ok: false as const,
        error: error.message.includes("capacity")
          ? "Event is at capacity"
          : "Couldn't RSVP (try again in a moment)",
      };
    }
  } else {
    await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("fan_id", user.id);
  }

  revalidatePath(`/artists/${artistSlug}`);
  return { ok: true as const };
}
