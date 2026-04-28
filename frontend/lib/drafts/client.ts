/**
 * Anthropic Claude client for AI-drafted comment replies.
 *
 * Used by the comment composer's "✨ Draft a reply" button. Returns 3
 * short reply drafts that match (a) the post the user is replying to,
 * (b) the user's prior comment style if they have one, (c) the
 * community vibe.
 *
 * Pinned to claude-haiku-4-5 — cheap, fast, plenty of capability for
 * a 3-option draft generation task. Roughly $0.0003 per click.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Pinned model. */
export const DRAFT_MODEL = "claude-haiku-4-5";

/** Pinned prompt version. Bump when the prompt changes meaningfully. */
export const DRAFT_PROMPT_VERSION = "v1";

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

interface AnthropicErrorResponse {
  error?: { message?: string; type?: string };
}

export class DraftError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DraftError";
  }
}

/** Inputs the prompt needs to generate good drafts. */
export interface DraftCommentInput {
  /** The body of the post the user is about to reply to. */
  postBody: string;
  /** Optional title for posts that have one. */
  postTitle?: string | null;
  /** What kind of post — colors the prompt's tone advice. */
  postKind?: string;
  /** Community context (the artist or brand). */
  communityName?: string;
  communityTagline?: string | null;
  communityGenres?: string[];
  /** User's recent comments — style transfer fodder. Up to 10. */
  userPriorComments?: string[];
}

/**
 * Generate 3 reply-draft options for the given post.
 *
 * Returns a string array, length 3, each ≤ 25 words. Throws DraftError
 * on Anthropic API failures or malformed output. Callers (the API
 * route) should surface a user-facing error and let the user write
 * their own comment.
 */
export async function generateCommentDrafts(
  input: DraftCommentInput,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new DraftError(
      "ANTHROPIC_API_KEY is not set. The drafter is unavailable until the env var lands.",
    );
  }

  const cleanedBody = (input.postBody ?? "").trim();
  if (!cleanedBody) {
    throw new DraftError("Cannot draft a reply to an empty post.");
  }

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
      model: DRAFT_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      // Some temperature for variety — drafts that all sound the same
      // defeat the purpose. Not so high that we get nonsense.
      temperature: 0.7,
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
    throw new DraftError(
      `Anthropic API ${response.status}: ${detail || response.statusText}`,
    );
  }

  const json = (await response.json()) as AnthropicMessageResponse;
  const textBlock = json.content.find((c) => c.type === "text")?.text ?? "";
  if (!textBlock) throw new DraftError("Empty response from Claude");

  return parseDraftsOutput(textBlock);
}

function buildSystemPrompt(): string {
  return `You are drafting reply options for a fan to leave on a community
post in Fan Engage, a fan-club platform for music artists. Your job is
to give the fan 3 short, distinct reply options they can pick from and
edit.

Output JSON ONLY with this exact schema, no surrounding commentary:

{
  "drafts": ["draft 1", "draft 2", "draft 3"]
}

CONSTRAINTS — strictly enforced:
  * Exactly 3 drafts.
  * Each draft ≤ 25 words. Long replies feel inauthentic; short ones
    invite the fan to hit Send.
  * No leading "I" — passive openings feel less self-centered and have
    higher engagement on this kind of platform.
  * Each draft should reference SOMETHING SPECIFIC from the post. A
    generic "Love this!" reply is failure mode #1. Hook into a
    detail — a song title, a venue, a turn of phrase, an emoji.
  * The 3 drafts should feel DISTINCT in stance — e.g. one supportive,
    one curious, one playful. Don't return three variations of the
    same sentiment.
  * Match the user's prior comment style if you have it. If they use
    short clipped sentences, do that. If they use emojis, use them
    too. If they don't, don't shoehorn one in.
  * Match the community vibe — country fans talk differently from pop
    fans. If genre signals are present, lean into them.
  * No hashtags. No @-mentions of the artist (the post is already
    inside their community). No URLs.
  * No platitudes ("amazing!", "incredible!", "you're the best!").
    These read as bot output.
  * If the post is a poll/challenge/question, drafts should ENGAGE
    with the question — give an actual position or guess, not a meta
    comment about the question.

The fan is going to scan all 3 in under 5 seconds. Make them want to
click one.`;
}

function buildUserPrompt(input: DraftCommentInput): string {
  const parts: string[] = [];

  parts.push("COMMUNITY CONTEXT:");
  if (input.communityName) parts.push(`  Community: ${input.communityName}`);
  if (input.communityTagline) parts.push(`  Tagline: ${input.communityTagline}`);
  if (input.communityGenres?.length) {
    parts.push(`  Genres: ${input.communityGenres.join(", ")}`);
  }
  parts.push("");

  parts.push("POST TO REPLY TO:");
  if (input.postKind) parts.push(`  Kind: ${input.postKind}`);
  if (input.postTitle) parts.push(`  Title: ${input.postTitle}`);
  parts.push("  Body:");
  for (const line of input.postBody.split("\n")) {
    parts.push(`    ${line}`);
  }
  parts.push("");

  if (input.userPriorComments?.length) {
    parts.push(`USER'S RECENT COMMENTS (for tone-matching, ${input.userPriorComments.length} samples):`);
    for (const c of input.userPriorComments.slice(0, 10)) {
      parts.push(`  • ${c.slice(0, 200)}`);
    }
    parts.push("");
  } else {
    parts.push("USER'S RECENT COMMENTS: (none — they're new to the platform)");
    parts.push("");
  }

  parts.push("Generate 3 reply drafts following the constraints. JSON only.");
  return parts.join("\n");
}

/** Defensive parser. Strips ```json fences if present, validates shape. */
function parseDraftsOutput(raw: string): string[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new DraftError(
      `Drafter returned non-JSON: ${stripped.slice(0, 200)}`,
      err,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new DraftError("Drafter output is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  const drafts = obj.drafts;
  if (!Array.isArray(drafts)) {
    throw new DraftError("Drafter output missing 'drafts' array");
  }

  const cleaned = drafts
    .map((d) => String(d).trim())
    .filter((d) => d.length > 0)
    .slice(0, 3);

  if (cleaned.length === 0) {
    throw new DraftError("Drafter returned no usable drafts");
  }

  return cleaned;
}
