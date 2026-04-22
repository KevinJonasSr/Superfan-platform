"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function createPostAction(formData: FormData) {
  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  if (!artistSlug || !body) return;
  if (body.length > 2000) return;

  const { supabase, userId } = await requireUser();
  const imageUrl = imageUrlRaw && /^https?:\/\//i.test(imageUrlRaw) ? imageUrlRaw : null;

  await supabase.from("community_posts").insert({
    artist_slug: artistSlug,
    author_id: userId,
    kind: "post",
    body,
    image_url: imageUrl,
  });

  revalidatePath(`/artists/${artistSlug}/community`);
  revalidatePath(`/artists/${artistSlug}`);
}

export async function toggleReactionAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const emoji = String(formData.get("emoji") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  if (!postId || !emoji || !artistSlug) return;

  const { supabase, userId } = await requireUser();

  // If the fan already reacted with this emoji, remove it (toggle off).
  // Otherwise insert.
  const { data: existing } = await supabase
    .from("community_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("fan_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("fan_id", userId)
      .eq("emoji", emoji);
  } else {
    await supabase.from("community_reactions").insert({
      post_id: postId,
      fan_id: userId,
      emoji,
    });
  }

  revalidatePath(`/artists/${artistSlug}/community`);
}

export async function addCommentAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !artistSlug || !body) return;
  if (body.length > 1000) return;

  const { supabase, userId } = await requireUser();

  await supabase.from("community_comments").insert({
    post_id: postId,
    author_id: userId,
    body,
  });

  revalidatePath(`/artists/${artistSlug}/community`);
}

export async function deletePostAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  if (!postId || !artistSlug) return;

  const { supabase, userId } = await requireUser();
  const adminUser = await getAdminUser();

  // Author can delete own; admin can delete any (via service-role client).
  if (adminUser) {
    const admin = createAdminClient();
    await admin.from("community_posts").delete().eq("id", postId);
  } else {
    await supabase
      .from("community_posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", userId);
  }

  revalidatePath(`/artists/${artistSlug}/community`);
}

export async function togglePinAction(formData: FormData) {
  // Admin only — pins a post to the top of an artist's feed.
  const postId = String(formData.get("post_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  const currentlyPinned = String(formData.get("currently_pinned") ?? "false") === "true";
  if (!postId || !artistSlug) return;

  const adminUser = await getAdminUser();
  if (!adminUser) return;

  const admin = createAdminClient();
  await admin
    .from("community_posts")
    .update({ pinned: !currentlyPinned })
    .eq("id", postId);

  revalidatePath(`/artists/${artistSlug}/community`);
}
