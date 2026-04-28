"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import {
  matchEvent,
  sendEventMatchNotifications,
} from "@/lib/event-matching";

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
 * Send in-app + SMS notifications to all unsent candidates.
 * Idempotent: skipping already-sent rows means re-clicks don't
 * re-notify.
 */
export async function sendEventMatchAction(eventId: string, slug: string) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin");

  await sendEventMatchNotifications(eventId);
  revalidatePath(`/admin/artists/${slug}/events/${eventId}/match`);
}
