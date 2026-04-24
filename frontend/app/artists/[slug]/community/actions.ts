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

// ─── Phase 2a: polls ──────────────────────────────────────────────────────

export async function createPollAction(formData: FormData) {
  // Admin only — regular fans can't create polls in Phase 2a.
  const adminUser = await getAdminUser();
  if (!adminUser) return;

  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const visibility =
    String(formData.get("visibility") ?? "public") === "premium"
      ? "premium"
      : "public";
  const options = formData
    .getAll("option")
    .map((o) => String(o).trim())
    .filter((o) => o.length > 0);
  if (!artistSlug || !body || options.length < 2 || options.length > 6) return;

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("community_posts")
    .insert({
      artist_slug: artistSlug,
      author_id: adminUser.id,
      kind: "poll",
      body,
      visibility,
    })
    .select("id")
    .single();
  if (!post) return;

  await admin.from("community_poll_options").insert(
    options.map((label, i) => ({
      post_id: post.id,
      label,
      sort_order: i,
    })),
  );

  revalidatePath(`/artists/${artistSlug}/community`);
}

export async function votePollAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const optionId = String(formData.get("option_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  if (!postId || !optionId || !artistSlug) return;

  const { supabase, userId } = await requireUser();

  // If fan already voted, replace their vote (delete + insert).
  await supabase
    .from("community_poll_votes")
    .delete()
    .eq("post_id", postId)
    .eq("fan_id", userId);

  await supabase.from("community_poll_votes").insert({
    post_id: postId,
    fan_id: userId,
    option_id: optionId,
  });

  revalidatePath(`/artists/${artistSlug}/community`);
}

// ─── Phase 2a: challenges ─────────────────────────────────────────────────

export async function createChallengeAction(formData: FormData) {
  const adminUser = await getAdminUser();
  if (!adminUser) return;

  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const visibility =
    String(formData.get("visibility") ?? "public") === "premium"
      ? "premium"
      : "public";
  if (!artistSlug || !body) return;

  const admin = createAdminClient();
  await admin.from("community_posts").insert({
    artist_slug: artistSlug,
    author_id: adminUser.id,
    kind: "challenge",
    title: title || null,
    body,
    visibility,
  });

  revalidatePath(`/artists/${artistSlug}/community`);
}

export async function submitEntryAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  if (!postId || !artistSlug || (!body && !imageUrlRaw)) return;

  const { supabase, userId } = await requireUser();
  const imageUrl = imageUrlRaw && /^https?:\/\//i.test(imageUrlRaw) ? imageUrlRaw : null;

  await supabase.from("community_challenge_entries").insert({
    post_id: postId,
    fan_id: userId,
    body: body || null,
    image_url: imageUrl,
  });

  revalidatePath(`/artists/${artistSlug}/community`);
}

// ─── Phase 2a: announcements ──────────────────────────────────────────────

export async function createAnnouncementAction(formData: FormData) {
  const adminUser = await getAdminUser();
  if (!adminUser) return;

  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const visibility =
    String(formData.get("visibility") ?? "public") === "premium"
      ? "premium"
      : "public";
  if (!artistSlug || !body) return;

  const admin = createAdminClient();
  await admin.from("community_posts").insert({
    artist_slug: artistSlug,
    author_id: adminUser.id,
    kind: "announcement",
    title: title || null,
    body,
    pinned: true, // announcements are pinned by default
    visibility,
  });

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
