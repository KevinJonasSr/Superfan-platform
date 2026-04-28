/**
 * Anthropic Claude vision client for AI-suggested image captions.
 *
 * Used by the post composer's "✨ Suggest captions" button when an
 * image is attached. Returns 3 short captions varying in tone.
 *
 * Pinned to claude-haiku-4-5 — vision-capable, cheap, fast. Per call:
 * ~1600 input tokens (image) + ~150 output tokens × 3 captions ≈
 * \$0.0007.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Pinned model. */
export const CAPTION_MODEL = "claude-haiku-4-5";

/** Pinned prompt version. Bump when the prompt changes meaningfully. */
export const CAPTION_PROMPT_VERSION = "v1";

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

interface AnthropicErrorResponse {
  error?: { message?: string; type?: string };
}

export class CaptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CaptionError";
  }
}

export interface SuggestCaptionsInput {
  /** Public URL of the image (already uploaded to Supabase Storage). */
  imageUrl: string;
  /** Community context (the artist or brand). */
  communityName?: string;
  communityTagline?: string | null;
  communityGenres?: string[];
  /** Optional partial caption the fan has already started typing. */
  partialBody?: string;
}

/**
 * Generate 3 caption options for the given image. Returns a string
 * array, length 3, each ≤ 100 chars. Throws CaptionError on Anthropic
 * API failures or malformed output.
 */
export async function suggestCaptions(
  input: SuggestCaptionsInput,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new CaptionError(
      "ANTHROPIC_API_KEY is not set. Caption suggester unavailable.",
    );
  }

  const url = (input.imageUrl ?? "").trim();
  if (!url) throw new CaptionError("Missing imageUrl.");
  if (!/^https?:\/\//i.test(url)) {
    throw new CaptionError("imageUrl must be http(s).");
  }

  const systemPrompt = buildSystemPrompt();
  const userText = buildUserPrompt(input);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url },
            },
            { type: "text", text: userText },
          ],
        },
      ],
      // Modest temperature for distinct tones across the 3 options.
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
    throw new CaptionError(
      `Anthropic API ${response.status}: ${detail || response.statusText}`,
    );
  }

  const json = (await response.json()) as AnthropicMessageResponse;
  const textBlock = json.content.find((c) => c.type === "text")?.text ?? "";
  if (!textBlock) throw new CaptionError("Empty response from Claude.");

  return parseCaptionsOutput(textBlock);
}

function buildSystemPrompt(): string {
  return `You are suggesting captions for a fan to use on a photo they're
about to post in Fan Engage, a fan-club platform for music artists.

Output JSON ONLY with this exact schema, no surrounding commentary:

{
  "captions": ["caption 1", "caption 2", "caption 3"]
}

CONSTRAINTS — strictly enforced:
  * Exactly 3 captions.
  * Each caption ≤ 100 characters. Short captions feel native to
    fan-community posts; long ones feel like marketing copy.
  * Each caption MUST reference something specific you can SEE in
    the photo. "Beautiful shot!" is failure mode #1.
  * The 3 captions should feel DISTINCT in tone — exactly one of:
      1. Observational / matter-of-fact (no emojis)
      2. Enthusiastic / emoji-friendly (1-2 emojis OK)
      3. Curious / question-style (ends with a question)
  * Match the community vibe if genres are provided. Country fans
    talk differently from pop fans.
  * No hashtags. No @-mentions of the artist (the post is already in
    their community). No URLs.
  * No platitudes ("amazing!", "incredible!", "the best!").
  * If the photo clearly shows the artist (or someone who could be
    the artist), describe what they're DOING (singing, soundchecking,
    holding a guitar) rather than NAMING them — fans will know.
  * If you can't tell what's in the image (too dark, blurry, abstract),
    suggest captions about the MOOD or CONTEXT a fan would post about,
    not about the unclear visual.

The fan should be able to scan all 3 in under 3 seconds and pick one.`;
}

function buildUserPrompt(input: SuggestCaptionsInput): string {
  const parts: string[] = [];

  parts.push("COMMUNITY CONTEXT:");
  if (input.communityName) parts.push(`  Community: ${input.communityName}`);
  if (input.communityTagline) parts.push(`  Tagline: ${input.communityTagline}`);
  if (input.communityGenres?.length) {
    parts.push(`  Genres: ${input.communityGenres.join(", ")}`);
  }
  parts.push("");

  if (input.partialBody && input.partialBody.trim()) {
    parts.push("THE FAN HAS ALREADY STARTED TYPING:");
    parts.push(`  ${input.partialBody.trim().slice(0, 200)}`);
    parts.push(
      "  Build on this rather than ignoring it. Suggestions should " +
        "feel like ways to FINISH this thought, not replace it.",
    );
    parts.push("");
  }

  parts.push("Generate 3 caption suggestions following the constraints. JSON only.");
  return parts.join("\n");
}

/** Defensive parser. Strips ```json fences, validates shape. */
function parseCaptionsOutput(raw: string): string[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new CaptionError(`Could not parse caption JSON: ${stripped.slice(0, 200)}`, err);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("captions" in parsed) ||
    !Array.isArray((parsed as { captions: unknown }).captions)
  ) {
    throw new CaptionError(`Bad caption shape: ${stripped.slice(0, 200)}`);
  }

  const arr = (parsed as { captions: unknown[] }).captions;
  if (arr.length !== 3) {
    throw new CaptionError(`Expected 3 captions, got ${arr.length}`);
  }
  const captions = arr.map((c) => {
    if (typeof c !== "string") throw new CaptionError("Non-string caption");
    return c.trim();
  });
  if (captions.some((c) => c.length === 0)) {
    throw new CaptionError("Empty caption returned");
  }
  return captions;
}
