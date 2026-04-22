"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark a single notification read. Uses the user-scoped client so RLS enforces
 * that fans can only touch their own rows — no extra check needed here.
 *
 * If the form submits a `redirect_to` value, we follow the deep link after
 * marking read. Otherwise we just revalidate the inbox.
 */
export async function markNotificationReadAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  revalidatePath("/inbox");
  revalidatePath("/", "layout"); // refresh header badge count

  if (redirectTo && redirectTo.startsWith("/")) {
    redirect(redirectTo);
  }
}

/**
 * Mark all unread notifications read for the signed-in fan.
 * Returns void so it can be used directly as a server-action form action.
 */
export async function markAllReadAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("fan_id", user.id)
    .is("read_at", null);

  revalidatePath("/inbox");
  revalidatePath("/", "layout");
}
