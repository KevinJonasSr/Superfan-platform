"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { matchEvent } from "@/lib/event-matching";

/**
 * Re-run the scoring for an event. Used after follower changes or
 * scoring-weight tweaks. Idempotent — overwrites prior rows.
 */
export async function rescoreEventAction(eventId: string, slug: string) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin");

  await matchEvent(eventId);
  revalidatePath(`/admin/artists/${slug}/events/${eventId}/match`);
}

/**
 * Phase 8.4 will replace this stub with a real send implementation
 * (in-app notifications + SMS via lib/broadcast). For now it just
 * re-scores so the page works end-to-end during 8.3 review.
 */
export async function sendEventMatchAction(eventId: string, slug: string) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin");

  // TEMP: stub. Phase 8.4 wires the actual send.
  await matchEvent(eventId);
  revalidatePath(`/admin/artists/${slug}/events/${eventId}/match`);
}
