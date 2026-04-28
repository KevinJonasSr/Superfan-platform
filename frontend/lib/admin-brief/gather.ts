/**
 * Gather week-over-week metrics for the daily admin brief.
 *
 * "This week" = last 7 days back from `windowEnd`.
 * "Last week" = the 7 days before that.
 *
 * Returned shape is friendly for both:
 *   - Persisting straight into admin_briefs.metrics (jsonb)
 *   - Passing to the Claude summarizer as the prompt input
 *
 * Honest scope notes:
 *   - points_ledger is global (no community_id column today). We surface
 *     total points awarded as a platform metric only — per-community
 *     attribution is a v2 upgrade once points_ledger gains community_id.
 *   - Active fans = distinct posters OR commenters in the window. We
 *     don't include reactors because reactions are pseudonymous-feeling
 *     and inflate the count.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface CommunityMetrics {
  slug: string;
  display_name: string;
  posts: number;
  posts_prev: number;
  comments: number;
  comments_prev: number;
  reactions: number;
  reactions_prev: number;
  signups: number;
  signups_prev: number;
  active_fans: number;
  active_fans_prev: number;
  /** Highest-engagement post this week, if any. */
  top_post: {
    id: string;
    title: string | null;
    body_excerpt: string;
    reactions: number;
    comments: number;
  } | null;
}

export interface PlatformMetrics {
  signups: number;
  signups_prev: number;
  posts: number;
  posts_prev: number;
  comments: number;
  comments_prev: number;
  reactions: number;
  reactions_prev: number;
  active_fans: number;
  active_fans_prev: number;
  points_awarded: number;
  points_awarded_prev: number;
}

export type Anomaly =
  | { kind: "signup_spike"; severity: "info" | "warn"; detail: string; community_id?: string }
  | { kind: "engagement_drop"; severity: "info" | "warn"; detail: string; community_id: string }
  | { kind: "engagement_jump"; severity: "info"; detail: string; community_id: string }
  | { kind: "no_activity"; severity: "warn"; detail: string; community_id: string };

export interface AdminBriefMetrics {
  window_end: string; // ISO
  platform: PlatformMetrics;
  communities: CommunityMetrics[];
  anomalies: Anomaly[];
}

export async function gatherAdminBriefMetrics(
  windowEnd: Date = new Date(),
): Promise<AdminBriefMetrics> {
  const admin = createAdminClient();
  const ms = (d: Date) => d.toISOString();

  const t0 = windowEnd;
  const t7 = new Date(t0.getTime() - 7 * 24 * 3600 * 1000);
  const t14 = new Date(t0.getTime() - 14 * 24 * 3600 * 1000);

  // Active community list.
  const { data: communities } = await admin
    .from("communities")
    .select("slug, display_name")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const comms = (communities ?? []) as Array<{ slug: string; display_name: string }>;

  // Per-community metrics in parallel.
  const perCommunity = await Promise.all(
    comms.map((c) => gatherForCommunity(c.slug, c.display_name, ms(t14), ms(t7), ms(t0))),
  );

  // Platform totals.
  const platform = aggregatePlatform(perCommunity);

  // Global signups (fans.created_at — not community-scoped).
  const [{ count: signupsThisRaw }, { count: signupsPrevRaw }] = await Promise.all([
    admin
      .from("fans")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", ms(t7))
      .lt("created_at", ms(t0)),
    admin
      .from("fans")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", ms(t14))
      .lt("created_at", ms(t7)),
  ]);
  platform.signups = signupsThisRaw ?? 0;
  platform.signups_prev = signupsPrevRaw ?? 0;

  // Total points awarded — sum of positive deltas.
  const [{ data: pointsThis }, { data: pointsPrev }] = await Promise.all([
    admin
      .from("points_ledger")
      .select("delta")
      .gte("created_at", ms(t7))
      .lt("created_at", ms(t0)),
    admin
      .from("points_ledger")
      .select("delta")
      .gte("created_at", ms(t14))
      .lt("created_at", ms(t7)),
  ]);
  platform.points_awarded = sumPositiveDelta(pointsThis ?? []);
  platform.points_awarded_prev = sumPositiveDelta(pointsPrev ?? []);

  // Anomaly detection.
  const anomalies = detectAnomalies(perCommunity, platform);

  return {
    window_end: ms(t0),
    platform,
    communities: perCommunity,
    anomalies,
  };
}

async function gatherForCommunity(
  slug: string,
  displayName: string,
  startPrevIso: string,
  startThisIso: string,
  endThisIso: string,
): Promise<CommunityMetrics> {
  const admin = createAdminClient();

  // Posts (this + prev) — fetch this-week's rows so we can compute top_post later.
  const [postsThisQ, postsPrevQ] = await Promise.all([
    admin
      .from("community_posts")
      .select("id, title, body, created_at", { count: "exact" })
      .eq("artist_slug", slug)
      .gte("created_at", startThisIso)
      .lt("created_at", endThisIso),
    admin
      .from("community_posts")
      .select("id", { head: true, count: "exact" })
      .eq("artist_slug", slug)
      .gte("created_at", startPrevIso)
      .lt("created_at", startThisIso),
  ]);
  const postsThisRows = ((postsThisQ.data ?? []) as Array<{
    id: string;
    title: string | null;
    body: string;
  }>);

  // Comments.
  const [commentsThisQ, commentsPrevQ] = await Promise.all([
    admin
      .from("community_comments")
      .select("id, community_posts!inner(artist_slug)", { count: "exact", head: true })
      .eq("community_posts.artist_slug", slug)
      .gte("created_at", startThisIso)
      .lt("created_at", endThisIso),
    admin
      .from("community_comments")
      .select("id, community_posts!inner(artist_slug)", { count: "exact", head: true })
      .eq("community_posts.artist_slug", slug)
      .gte("created_at", startPrevIso)
      .lt("created_at", startThisIso),
  ]);

  // Reactions.
  const [reactionsThisQ, reactionsPrevQ] = await Promise.all([
    admin
      .from("community_reactions")
      .select("post_id, community_posts!inner(artist_slug)", { count: "exact", head: true })
      .eq("community_posts.artist_slug", slug)
      .gte("created_at", startThisIso)
      .lt("created_at", endThisIso),
    admin
      .from("community_reactions")
      .select("post_id, community_posts!inner(artist_slug)", { count: "exact", head: true })
      .eq("community_posts.artist_slug", slug)
      .gte("created_at", startPrevIso)
      .lt("created_at", startThisIso),
  ]);

  // Community-scoped signups via fan_artist_following.
  const [followsThisQ, followsPrevQ] = await Promise.all([
    admin
      .from("fan_artist_following")
      .select("fan_id", { count: "exact", head: true })
      .eq("artist_slug", slug)
      .gte("followed_at", startThisIso)
      .lt("followed_at", endThisIso),
    admin
      .from("fan_artist_following")
      .select("fan_id", { count: "exact", head: true })
      .eq("artist_slug", slug)
      .gte("followed_at", startPrevIso)
      .lt("followed_at", startThisIso),
  ]);

  // Active fans = distinct posters or commenters in the window.
  const activeFans = await countDistinctActiveFans(slug, startThisIso, endThisIso);
  const activeFansPrev = await countDistinctActiveFans(slug, startPrevIso, startThisIso);

  // Top post.
  const top_post = await pickTopPost(
    postsThisRows.map((p) => p.id),
    postsThisRows,
  );

  return {
    slug,
    display_name: displayName,
    posts: postsThisQ.count ?? 0,
    posts_prev: postsPrevQ.count ?? 0,
    comments: commentsThisQ.count ?? 0,
    comments_prev: commentsPrevQ.count ?? 0,
    reactions: reactionsThisQ.count ?? 0,
    reactions_prev: reactionsPrevQ.count ?? 0,
    signups: followsThisQ.count ?? 0,
    signups_prev: followsPrevQ.count ?? 0,
    active_fans: activeFans,
    active_fans_prev: activeFansPrev,
    top_post,
  };
}

function sumPositiveDelta(rows: Array<{ delta: number | null }>): number {
  let s = 0;
  for (const r of rows) {
    if (typeof r.delta === "number" && r.delta > 0) s += r.delta;
  }
  return s;
}

async function countDistinctActiveFans(
  slug: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const admin = createAdminClient();
  const set = new Set<string>();

  const { data: posters } = await admin
    .from("community_posts")
    .select("author_id")
    .eq("artist_slug", slug)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  for (const r of (posters ?? []) as Array<{ author_id: string }>) {
    set.add(r.author_id);
  }

  const { data: commenters } = await admin
    .from("community_comments")
    .select("author_id, community_posts!inner(artist_slug)")
    .eq("community_posts.artist_slug", slug)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  for (const r of (commenters ?? []) as Array<{ author_id: string }>) {
    set.add(r.author_id);
  }

  return set.size;
}

async function pickTopPost(
  postIds: string[],
  posts: Array<{ id: string; title: string | null; body: string }>,
): Promise<CommunityMetrics["top_post"]> {
  if (postIds.length === 0) return null;
  const admin = createAdminClient();

  const { data: rxRows } = await admin
    .from("community_reactions")
    .select("post_id")
    .in("post_id", postIds);
  const rxCount = new Map<string, number>();
  for (const r of (rxRows ?? []) as Array<{ post_id: string }>) {
    rxCount.set(r.post_id, (rxCount.get(r.post_id) ?? 0) + 1);
  }

  const { data: cmRows } = await admin
    .from("community_comments")
    .select("post_id")
    .in("post_id", postIds);
  const cmCount = new Map<string, number>();
  for (const r of (cmRows ?? []) as Array<{ post_id: string }>) {
    cmCount.set(r.post_id, (cmCount.get(r.post_id) ?? 0) + 1);
  }

  let bestId: string | null = null;
  let bestScore = -1;
  for (const id of postIds) {
    // Comments weighted 2x — they're harder to write than a reaction.
    const score = (rxCount.get(id) ?? 0) + 2 * (cmCount.get(id) ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  if (!bestId || bestScore <= 0) return null;
  const post = posts.find((p) => p.id === bestId);
  if (!post) return null;
  return {
    id: post.id,
    title: post.title,
    body_excerpt: post.body.slice(0, 200),
    reactions: rxCount.get(bestId) ?? 0,
    comments: cmCount.get(bestId) ?? 0,
  };
}

function aggregatePlatform(perCommunity: CommunityMetrics[]): PlatformMetrics {
  const sum = (key: keyof CommunityMetrics) =>
    perCommunity.reduce((a, c) => a + ((c[key] as number) ?? 0), 0);
  return {
    signups: 0,
    signups_prev: 0,
    posts: sum("posts"),
    posts_prev: sum("posts_prev"),
    comments: sum("comments"),
    comments_prev: sum("comments_prev"),
    reactions: sum("reactions"),
    reactions_prev: sum("reactions_prev"),
    active_fans: sum("active_fans"),
    active_fans_prev: sum("active_fans_prev"),
    points_awarded: 0,
    points_awarded_prev: 0,
  };
}

/**
 * Heuristic anomaly detection. We deliberately keep the rules simple
 * so the brief stays readable. The Claude summarizer can synthesize
 * subtler patterns from the raw metrics.
 */
function detectAnomalies(
  communities: CommunityMetrics[],
  platform: PlatformMetrics,
): Anomaly[] {
  const out: Anomaly[] = [];

  // Platform-wide signup spike — 3x or more vs prior week.
  if (platform.signups_prev > 0 && platform.signups >= platform.signups_prev * 3) {
    out.push({
      kind: "signup_spike",
      severity: "warn",
      detail: `Platform signups jumped from ${platform.signups_prev} to ${platform.signups} (3x+). Worth verifying this isn't a referral-link bot. (V2: track signup IPs to attribute the source.)`,
    });
  } else if (platform.signups_prev === 0 && platform.signups >= 10) {
    out.push({
      kind: "signup_spike",
      severity: "info",
      detail: `${platform.signups} new signups this week from a quiet baseline.`,
    });
  }

  // Per-community: no posts at all this week → quiet community alert.
  for (const c of communities) {
    if (c.posts === 0 && c.posts_prev > 0) {
      out.push({
        kind: "no_activity",
        severity: "warn",
        community_id: c.slug,
        detail: `${c.display_name} had ${c.posts_prev} post(s) last week and 0 this week.`,
      });
    }

    const eng = c.reactions + c.comments;
    const engPrev = c.reactions_prev + c.comments_prev;
    if (engPrev >= 10) {
      const pct = ((eng - engPrev) / engPrev) * 100;
      if (pct <= -20) {
        out.push({
          kind: "engagement_drop",
          severity: pct <= -40 ? "warn" : "info",
          community_id: c.slug,
          detail: `${c.display_name} engagement (reactions+comments) is down ${Math.abs(pct).toFixed(0)}% (${engPrev} → ${eng}).`,
        });
      } else if (pct >= 20) {
        out.push({
          kind: "engagement_jump",
          severity: "info",
          community_id: c.slug,
          detail: `${c.display_name} engagement is up ${pct.toFixed(0)}% (${engPrev} → ${eng}).`,
        });
      }
    }
  }

  return out;
}
