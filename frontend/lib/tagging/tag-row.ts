/**
 * Tag a single community_posts row.
 *
 * Symmetric with lib/embeddings/index-row.ts and
 * lib/moderation/moderate-row.ts. Used by:
 *   * Inline trigger from the 4 community_posts insert paths
 *     (createPostAction, createPollAction, createChallengeAction,
 *      createAnnouncementAction)
 *   * Backfill cron — finds posts where tagged_at is null
 *
 * Idempotent: re-tagging just overwrites tags. The backfill cron
 * filters on tagged_at is null so re-classification only happens
 * deliberately (e.g. when bumping TAG_PROMPT_VERSION).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyTags,
  TagError,
  TAG_MODEL,
  TAG_PROMPT_VERSION,
  type CanonicalTag,
} from "./client";

export type TagRowResult =
  | { status: "tagged"; tags: CanonicalTag[] }
  | { status: "skipped_no_row" }
  | { status: "skipped_empty" }
  | { status: "error"; error: string };

/**
 * Classify and persist tags for a single community_posts row.
 */
export async function tagRow(postId: string): Promise<TagRowResult> {
  try {
    const admin = createAdminClient();

    // Fetch row + artist genres for context. Two queries (one for the
    // post, one for the artist's genres) — cheaper than a join given
    // we don't need to repeat the artist lookup if it fails.
    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .select("id, artist_slug, kind, title, body, moderation_status")
      .eq("id", postId)
      .maybeSingle();

    if (postErr) return { status: "error", error: postErr.message };
    if (!post) return { status: "skipped_no_row" };

    const body = String(post.body ?? "").trim();
    if (!body) return { status: "skipped_empty" };

    // Skip auto_hide posts — no point classifying content that's hidden.
    if (post.moderation_status === "auto_hide") {
      return { status: "skipped_empty" };
    }

    // Pull artist genres if available; failure is non-fatal.
    const { data: artist } = await admin
      .from("artists")
      .select("genres")
      .eq("slug", post.artist_slug as string)
      .maybeSingle();

    const tags = await classifyTags({
      body,
      title: (post.title as string | null) ?? null,
      kind: (post.kind as string) ?? "post",
      community_id: post.artist_slug as string,
      genres: (artist?.genres as string[] | null) ?? undefined,
    });

    // Update the row.
    const { error: updateErr } = await admin
      .from("community_posts")
      .update({
        tags,
        tagged_at: new Date().toISOString(),
        tag_model: TAG_MODEL,
        tag_prompt_version: TAG_PROMPT_VERSION,
      })
      .eq("id", postId);

    if (updateErr) return { status: "error", error: updateErr.message };

    return { status: "tagged", tags };
  } catch (err) {
    const message =
      err instanceof TagError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[tagging] tagRow ${postId} failed:`, message);
    return { status: "error", error: message };
  }
}

/**
 * Fire-and-forget version for inline server-action use.
 *
 *   import { tagRowAsync } from "@/lib/tagging";
 *   ...
 *   tagRowAsync(newPost.id);  // no await
 *
 * Backfill cron is the safety net.
 */
export function tagRowAsync(postId: string): void {
  void Promise.resolve().then(() => tagRow(postId));
}
