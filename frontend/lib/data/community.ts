import { createClient } from "@/lib/supabase/server";
import type { CommunityComment, CommunityPost } from "./types";

/**
 * Fetches the community feed for one artist, newest first with pinned
 * posts always at the top. Aggregates reactions + comment counts so the
 * UI renders in a single round-trip.
 */
export async function getPostsByArtist(
  artistSlug: string,
  limit = 30,
): Promise<CommunityPost[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: posts, error: postsErr } = await supabase
      .from("community_posts")
      .select("id, artist_slug, author_id, kind, title, body, image_url, pinned, created_at")
      .eq("artist_slug", artistSlug)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (postsErr) throw postsErr;
    if (!posts || posts.length === 0) return [];

    const postIds = posts.map((p) => p.id as string);
    const authorIds = [...new Set(posts.map((p) => p.author_id as string))];

    const [authorsRes, reactionsRes, myReactionsRes, commentCountRes] = await Promise.all([
      supabase
        .from("fans")
        .select("id, first_name")
        .in("id", authorIds),
      supabase
        .from("community_reactions")
        .select("post_id, emoji")
        .in("post_id", postIds),
      user
        ? supabase
            .from("community_reactions")
            .select("post_id, emoji")
            .in("post_id", postIds)
            .eq("fan_id", user.id)
        : Promise.resolve({ data: [] as { post_id: string; emoji: string }[], error: null }),
      supabase
        .from("community_comments")
        .select("post_id")
        .in("post_id", postIds),
    ]);

    const authorNameById = new Map<string, string | null>(
      (authorsRes.data ?? []).map((a) => [a.id as string, (a.first_name as string | null) ?? null]),
    );

    const reactionsByPost = new Map<string, Record<string, number>>();
    for (const r of reactionsRes.data ?? []) {
      const pid = r.post_id as string;
      const e = r.emoji as string;
      const bucket = reactionsByPost.get(pid) ?? {};
      bucket[e] = (bucket[e] ?? 0) + 1;
      reactionsByPost.set(pid, bucket);
    }

    const myReactionsByPost = new Map<string, string[]>();
    for (const r of myReactionsRes.data ?? []) {
      const pid = r.post_id as string;
      const arr = myReactionsByPost.get(pid) ?? [];
      arr.push(r.emoji as string);
      myReactionsByPost.set(pid, arr);
    }

    const commentCountsByPost = new Map<string, number>();
    for (const c of commentCountRes.data ?? []) {
      const pid = c.post_id as string;
      commentCountsByPost.set(pid, (commentCountsByPost.get(pid) ?? 0) + 1);
    }

    return posts.map(
      (p) =>
        ({
          id: p.id as string,
          artist_slug: p.artist_slug as string,
          author_id: p.author_id as string,
          author_first_name: authorNameById.get(p.author_id as string) ?? null,
          kind: p.kind,
          title: p.title as string | null,
          body: p.body as string,
          image_url: p.image_url as string | null,
          pinned: p.pinned as boolean,
          created_at: p.created_at as string,
          reaction_counts: reactionsByPost.get(p.id as string) ?? {},
          my_reactions: myReactionsByPost.get(p.id as string) ?? [],
          comment_count: commentCountsByPost.get(p.id as string) ?? 0,
        }) as CommunityPost,
    );
  } catch {
    return [];
  }
}

/** All comments on a single post, ascending by time. */
export async function getCommentsByPost(
  postId: string,
): Promise<CommunityComment[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("community_comments")
      .select("id, post_id, author_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const authorIds = [...new Set(data.map((c) => c.author_id as string))];
    const { data: authors } = await supabase
      .from("fans")
      .select("id, first_name")
      .in("id", authorIds);
    const nameById = new Map<string, string | null>(
      (authors ?? []).map((a) => [a.id as string, (a.first_name as string | null) ?? null]),
    );

    return data.map(
      (c) =>
        ({
          id: c.id as string,
          post_id: c.post_id as string,
          author_id: c.author_id as string,
          author_first_name: nameById.get(c.author_id as string) ?? null,
          body: c.body as string,
          created_at: c.created_at as string,
        }) as CommunityComment,
    );
  } catch {
    return [];
  }
}
