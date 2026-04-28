/**
 * Anthropic Claude client for AI-assigned post tags.
 *
 * Classifies each community_posts row into 1-4 tags from a closed
 * vocabulary. Closed vocabulary keeps tags consistent across
 * communities so filters and recommendations can rely on stable
 * values; we'll relax to open-vocabulary later once we see what tags
 * the AI actually wants to propose.
 *
 * Pinned to claude-haiku-4-5 — ~150 input + ~50 output tokens per
 * call ≈ $0.0001/post.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

export const TAG_MODEL = "claude-haiku-4-5";
export const TAG_PROMPT_VERSION = "v1";

/** Closed vocabulary for V1. ~20 tags covering the music-fan-club
 *  surface area. Adding tags = bumping TAG_PROMPT_VERSION + re-running
 *  the backfill cron. Removing/renaming tags requires a migration to
 *  rewrite existing rows. Add 'other' as the catch-all. */
export const CANONICAL_TAGS = [
  // Performance
  "live_show",
  "tour_announcement",
  "setlist",
  "tour_recap",
  "livestream",
  // Studio + content
  "studio_session",
  "behind_the_scenes",
  "release",
  "lyrics",
  "collaboration",
  // Commerce
  "merch_drop",
  "pre_order",
  // Community
  "fan_question",
  "fan_art",
  "celebration",
  "gratitude",
  "meme",
  "introduction",
  // Personal + media
  "personal_update",
  "media_appearance",
  // Catch-all
  "other",
] as const;

export type CanonicalTag = (typeof CANONICAL_TAGS)[number];

/** Max tags per post. The classifier should pick the 1-4 most relevant. */
const MAX_TAGS_PER_POST = 4;

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
}

interface AnthropicErrorResponse {
  error?: { message?: string; type?: string };
}

export class TagError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "TagError";
  }
}

/** Inputs the prompt needs to produce good tags. */
export interface TagInput {
  /** Body of the post being classified. */
  body: string;
  /** Optional title — usually populated for announcements + challenges. */
  title?: string | null;
  /** community_posts.kind: post | announcement | poll | challenge */
  kind?: string;
  /** Community context (the artist). */
  community_id?: string;
  /** Artist genres for context (helps disambiguate "tour" in country
   *  vs. pop fan communities). */
  genres?: string[];
}

/**
 * Classify a single post. Returns 1-4 canonical tags.
 * Empty input returns ['other']. Throws TagError on API failures so
 * callers can decide whether to retry or skip.
 */
export async function classifyTags(input: TagInput): Promise<CanonicalTag[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TagError(
      "ANTHROPIC_API_KEY is not set. Add it to Vercel env vars before the tagging pipeline can run.",
    );
  }

  const cleanBody = (input.body ?? "").trim();
  if (!cleanBody) return ["other"];

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TAG_MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      // Lower temp = more consistent tag assignments across similar posts.
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as AnthropicErrorResponse;
      detail = err.error?.message ?? "";
    } catch {
      detail = await response.text();
    }
    throw new TagError(
      `Anthropic API ${response.status}: ${detail || response.statusText}`,
    );
  }

  const json = (await response.json()) as AnthropicMessageResponse;
  const text = json.content.find((c) => c.type === "text")?.text ?? "";
  if (!text) throw new TagError("Empty response from Claude");

  return parseTagsOutput(text);
}

function buildSystemPrompt(): string {
  return `You classify posts in Fan Engage, a music fan-club community
platform. Each post gets 1-4 tags from a CLOSED VOCABULARY. Output
JSON ONLY with this schema:

{
  "tags": ["tag1", "tag2", ...]
}

CLOSED VOCABULARY (use ONLY these strings):
  Performance:    live_show, tour_announcement, setlist, tour_recap, livestream
  Studio+content: studio_session, behind_the_scenes, release, lyrics, collaboration
  Commerce:       merch_drop, pre_order
  Community:      fan_question, fan_art, celebration, gratitude, meme, introduction
  Personal+media: personal_update, media_appearance
  Catch-all:      other

CONSTRAINTS:
  * Output 1-4 tags. Pick the most specific applicable; don't pad
    with weakly-relevant tags.
  * Never invent tags outside the vocabulary above. If nothing fits,
    return ["other"].
  * NO duplicates within a single post.
  * Order tags by relevance (most relevant first).

EXAMPLES:
  Post: "Just finished tracking vocals for the title track. Cannot
         wait for y'all to hear this one."
  Tags: ["studio_session", "release"]

  Post: "Charlotte tickets drop tomorrow at 10am ET. Don't miss it."
  Tags: ["tour_announcement"]

  Post: "Y'all what's your favorite RaeLynn song from the new album?"
  Tags: ["fan_question"]

  Post: "Look at this fan art from @sarah — wow."
  Tags: ["fan_art", "gratitude"]

  Post: "🔥🔥🔥"
  Tags: ["celebration"]   (low signal but pick the closest match;
                            'other' is for content where nothing
                            fits, not for short reactions)

Be CALIBRATED. Most posts have 1-2 clear tags; reaching for 3-4 only
makes sense when the post is genuinely multi-themed (e.g. an
announcement that's also a tour update and a celebration).`;
}

function buildUserPrompt(input: TagInput): string {
  const parts: string[] = [];
  parts.push("CONTEXT:");
  if (input.community_id) parts.push(`  Community: ${input.community_id}`);
  if (input.kind) parts.push(`  Post kind: ${input.kind}`);
  if (input.genres?.length) parts.push(`  Genres: ${input.genres.join(", ")}`);
  parts.push("");
  parts.push("POST:");
  if (input.title) parts.push(`  Title: ${input.title}`);
  parts.push(`  Body: ${input.body}`);
  parts.push("");
  parts.push("Classify the post above. Output JSON only.");
  return parts.join("\n");
}

/** Defensive parser. Strips ```json fences, validates each tag is in
 *  the closed vocabulary, dedupes, caps at MAX_TAGS_PER_POST. */
function parseTagsOutput(raw: string): CanonicalTag[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new TagError(
      `Tagger returned non-JSON: ${stripped.slice(0, 200)}`,
      err,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new TagError("Tagger output is not an object");
  }

  const obj = parsed as Record<string, unknown>;
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const validVocab = new Set<string>(CANONICAL_TAGS);

  const seen = new Set<string>();
  const out: CanonicalTag[] = [];
  for (const t of rawTags) {
    const s = String(t).trim();
    if (!validVocab.has(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s as CanonicalTag);
    if (out.length >= MAX_TAGS_PER_POST) break;
  }

  // Always return at least one tag — fallback to 'other'.
  if (out.length === 0) out.push("other");
  return out;
}
