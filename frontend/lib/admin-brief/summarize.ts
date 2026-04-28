/**
 * Claude Haiku-powered narrative summary of the gathered metrics.
 *
 * Output is plain text formatted for Slack — short headline, bullets
 * per community, anomalies called out at the bottom. No markdown
 * tables (Slack renders them poorly) and no emoji blasts.
 */

import type { AdminBriefMetrics } from "./gather";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

export const ADMIN_BRIEF_MODEL = "claude-haiku-4-5";
export const ADMIN_BRIEF_PROMPT_VERSION = "v1";

export class AdminBriefError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AdminBriefError";
  }
}

/**
 * Render the metrics as a Slack-ready plain-text brief. Returns the
 * narrative string; callers (the cron) persist + dispatch.
 */
export async function summarizeAdminBrief(
  metrics: AdminBriefMetrics,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Soft-fail to a deterministic non-AI summary so the brief still
    // ships when the key isn't configured. Cron continues to work.
    return renderFallback(metrics);
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(metrics);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ADMIN_BRIEF_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      // Lower temp than the drafter — we want consistent journalism,
      // not creative variety.
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 300);
    } catch {
      detail = response.statusText;
    }
    throw new AdminBriefError(`Anthropic API ${response.status}: ${detail}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = json.content.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new AdminBriefError("Empty response from Claude.");
  return text;
}

function buildSystemPrompt(): string {
  return `You are an analyst writing a daily admin brief for Fan Engage,
a fan-club platform for music artists. Your readers are the platform
admins — they want to know what's working, what's slipping, and what's
weird. They will read this in Slack between meetings.

OUTPUT FORMAT (plain text, no markdown headers, no tables):

Line 1: A one-sentence top-line summary. Lead with the most
important thing — biggest mover, biggest anomaly, or "quiet week
across the platform" if nothing notable.

Then, for each community that had ANY activity (this week or last):
  - Two short lines, dash-bulleted:
    • Numbers line — concrete WoW deltas. Match this format:
      "RaeLynn: 12 posts (was 8), 47 reactions (was 22), 3 new
       signups (was 1)."
    • Insight line — what's driving the move, in plain English.
      If a top_post is provided, name it. If posts dropped to 0,
      say so. Don't speculate beyond what the data shows.

Then, if the anomalies array is non-empty, a "Heads up:" section
with 1-2 line bullets — one per anomaly. Use the severity field
to decide tone: "warn" → cautious flag, "info" → neutral note.

End with a single blank line. No sign-off, no "let me know if".

CONSTRAINTS:
  * Total length ≤ 80 lines. Slack truncates beyond that.
  * No emojis except possibly one at the start of the top-line.
  * No markdown tables, headings, or fenced code blocks.
  * No invented metrics. If a number isn't in the data, don't cite it.
  * If a community has 0 activity both weeks, OMIT it entirely.
  * No filler ("It's been a productive week!"). Lead with numbers.`;
}

function buildUserPrompt(m: AdminBriefMetrics): string {
  const lines: string[] = [];
  lines.push(`Window ending: ${m.window_end}`);
  lines.push("");
  lines.push("PLATFORM TOTALS (this week vs last week):");
  lines.push(
    `  Signups: ${m.platform.signups} (was ${m.platform.signups_prev})`,
  );
  lines.push(`  Posts: ${m.platform.posts} (was ${m.platform.posts_prev})`);
  lines.push(`  Comments: ${m.platform.comments} (was ${m.platform.comments_prev})`);
  lines.push(`  Reactions: ${m.platform.reactions} (was ${m.platform.reactions_prev})`);
  lines.push(
    `  Active fans (posters or commenters): ${m.platform.active_fans} (was ${m.platform.active_fans_prev})`,
  );
  lines.push(
    `  Points awarded: ${m.platform.points_awarded} (was ${m.platform.points_awarded_prev})`,
  );
  lines.push("");
  lines.push("PER-COMMUNITY:");
  for (const c of m.communities) {
    lines.push(
      `  ${c.display_name} (${c.slug}):`,
    );
    lines.push(`    posts: ${c.posts} (was ${c.posts_prev})`);
    lines.push(`    comments: ${c.comments} (was ${c.comments_prev})`);
    lines.push(`    reactions: ${c.reactions} (was ${c.reactions_prev})`);
    lines.push(`    new follows: ${c.signups} (was ${c.signups_prev})`);
    lines.push(
      `    active fans: ${c.active_fans} (was ${c.active_fans_prev})`,
    );
    if (c.top_post) {
      const t = c.top_post.title ? `"${c.top_post.title}"` : "(untitled)";
      lines.push(
        `    top post: ${t} — ${c.top_post.reactions} reactions, ${c.top_post.comments} comments`,
      );
      lines.push(
        `      excerpt: ${c.top_post.body_excerpt.slice(0, 140)}`,
      );
    }
  }
  lines.push("");
  if (m.anomalies.length > 0) {
    lines.push("ANOMALIES (already detected by rule-based heuristics):");
    for (const a of m.anomalies) {
      lines.push(`  [${a.severity}] ${a.kind}: ${a.detail}`);
    }
  } else {
    lines.push("ANOMALIES: none flagged by rules.");
  }
  lines.push("");
  lines.push("Write the brief.");
  return lines.join("\n");
}

/**
 * Deterministic non-AI fallback used when ANTHROPIC_API_KEY is missing.
 * Same shape as the AI version so callers can always count on getting
 * SOMETHING readable.
 */
function renderFallback(m: AdminBriefMetrics): string {
  const lines: string[] = [];
  const direction =
    m.platform.posts === 0 && m.platform.posts_prev === 0
      ? "Quiet week — no posts in either window."
      : `Platform: ${m.platform.posts} posts (was ${m.platform.posts_prev}), ${m.platform.signups} signups (was ${m.platform.signups_prev}).`;
  lines.push(direction);
  lines.push("");
  for (const c of m.communities) {
    if (c.posts === 0 && c.posts_prev === 0 && c.signups === 0 && c.signups_prev === 0) continue;
    lines.push(
      `- ${c.display_name}: ${c.posts} posts (was ${c.posts_prev}), ${c.reactions} reactions (was ${c.reactions_prev}), ${c.signups} new follows (was ${c.signups_prev}).`,
    );
  }
  if (m.anomalies.length > 0) {
    lines.push("");
    lines.push("Heads up:");
    for (const a of m.anomalies) {
      lines.push(`- [${a.severity}] ${a.detail}`);
    }
  }
  return lines.join("\n");
}
