/**
 * Server-side helper that gathers everything the comment drafter needs
 * and calls the classifier.
 *
 * Splits the work into two phases:
 *   1. Gather context (the post body, the user's prior comments, the
 *      community's tagline + genres) via service-role queries
 *   2. Call generateCommentDrafts() with the assembled context
 *
 * The API route at /api/ai/draft-comment wraps this with auth + error
 * handling.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { generateCommentDrafts, DraftError } from "./client";

export interface DraftCommentRequest {
  postId: string;
  /** auth.uid() of the requester. */
  userId: string;
}

export type DraftCommentResult =
  | { ok: true; drafts: string[] }
  | { ok: false; error: string };

/** Generate 3 reply drafts for the given (post, user) pair. */
export async function draftComment(
  req: DraftCommentRequest,
): Promise<DraftCommentResult> {
  if (!req.postId || !req.userId) {
    return { ok: false, error: "Missing postId or userId." };
  }

  try {
    const admin = createAdminClient();

    // 1. Load the post + parent community context in one query.
    //    artist_slug doubles as community slug across the music tenants.
    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .select("id, artist_slug, kind, title, body, communities!inner(display_name, tagline, type), artists!inner(genres)")
      .eq("id", req.postId)
      .maybeSingle();

    if (postErr) {
      // Maybe the join shape is wrong — the artists table is keyed by slug
      // (matches artist_slug). Fall back to two queries.
      return await draftCommentWithoutJoin(req);
    }
    if (!post) return { ok: false, error: "Post not found." };

    const postRow = post as unknown as {
      id: string;
      artist_slug: string;
      kind: string;
      title: string | null;
      body: string;
      communities: { display_name: string; tagline: string | null; type: string };
      artists: { genres: string[] | null };
    };

    // 2. Load user's last 10 comments across all communities for style fodder.
    const { data: priorComments } = await admin
      .from("community_comments")
      .select("body")
      .eq("author_id", req.userId)
      .neq("post_id", req.postId)
      .order("created_at", { ascending: false })
      .limit(10);

    const drafts = await generateCommentDrafts({
      postBody: postRow.body,
      postTitle: postRow.title,
      postKind: postRow.kind,
      communityName: postRow.communities?.display_name,
      communityTagline: postRow.communities?.tagline ?? null,
      communityGenres: postRow.artists?.genres ?? undefined,
      userPriorComments: (priorComments ?? [])
        .map((r) => String(r.body ?? "").trim())
        .filter((s) => s.length > 0),
    });

    return { ok: true, drafts };
  } catch (err) {
    const message =
      err instanceof DraftError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[drafts] draftComment failed:", message);
    return { ok: false, error: message };
  }
}

/**
 * Fallback path used when the joined query above fails (e.g. the
 * supabase-js version doesn't infer the cross-table FK shape we want).
 * Issues separate queries.
 */
async function draftCommentWithoutJoin(
  req: DraftCommentRequest,
): Promise<DraftCommentResult> {
  try {
    const admin = createAdminClient();

    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .select("id, artist_slug, kind, title, body")
      .eq("id", req.postId)
      .maybeSingle();
    if (postErr || !post) {
      return { ok: false, error: postErr?.message ?? "Post not found." };
    }

    // Look up the community by slug = artist_slug (multi_tenant migration
    // 0011 made these the same namespace).
    const { data: community } = await admin
      .from("communities")
      .select("display_name, tagline, type")
      .eq("slug", post.artist_slug)
      .maybeSingle();

    // Genres live on the legacy artists table.
    const { data: artist } = await admin
      .from("artists")
      .select("genres")
      .eq("slug", post.artist_slug)
      .maybeSingle();

    const { data: priorComments } = await admin
      .from("community_comments")
      .select("body")
      .eq("author_id", req.userId)
      .neq("post_id", req.postId)
      .order("created_at", { ascending: false })
      .limit(10);

    const drafts = await generateCommentDrafts({
      postBody: post.body as string,
      postTitle: post.title as string | null,
      postKind: post.kind as string,
      communityName: (community?.display_name as string) ?? undefined,
      communityTagline: (community?.tagline as string | null) ?? null,
      communityGenres: (artist?.genres as string[] | null) ?? undefined,
      userPriorComments: (priorComments ?? [])
        .map((r) => String(r.body ?? "").trim())
        .filter((s) => s.length > 0),
    });

    return { ok: true, drafts };
  } catch (err) {
    const message =
      err instanceof DraftError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[drafts] draftComment fallback failed:", message);
    return { ok: false, error: message };
  }
}
