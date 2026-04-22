"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Forbidden");
  return admin;
}

export async function adminDeletePostAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;
  const admin = createAdminClient();
  await admin.from("community_posts").delete().eq("id", postId);
  revalidatePath("/admin/community");
}

export async function adminTogglePinAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("post_id") ?? "");
  const currentlyPinned =
    String(formData.get("currently_pinned") ?? "false") === "true";
  if (!postId) return;
  const admin = createAdminClient();
  await admin
    .from("community_posts")
    .update({ pinned: !currentlyPinned })
    .eq("id", postId);
  revalidatePath("/admin/community");
}

export async function adminDeleteCommentAction(formData: FormData) {
  await requireAdmin();
  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return;
  const admin = createAdminClient();
  await admin.from("community_comments").delete().eq("id", commentId);
  revalidatePath("/admin/community");
}

export async function adminDeleteEntryAction(formData: FormData) {
  await requireAdmin();
  const entryId = String(formData.get("entry_id") ?? "");
  if (!entryId) return;
  const admin = createAdminClient();
  await admin.from("community_challenge_entries").delete().eq("id", entryId);
  revalidatePath("/admin/community");
  revalidatePath("/admin/challenges");
}

export async function adminSuspendFanAction(formData: FormData) {
  await requireAdmin();
  const fanId = String(formData.get("fan_id") ?? "");
  const suspend = String(formData.get("suspend") ?? "true") === "true";
  if (!fanId) return;
  const admin = createAdminClient();
  await admin.from("fans").update({ suspended: suspend }).eq("id", fanId);
  revalidatePath("/admin/fans");
  revalidatePath(`/admin/fans/${fanId}`);
}
