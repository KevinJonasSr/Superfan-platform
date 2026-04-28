/**
 * Anthropic Claude client for moderation classification.
 *
 * Single source of truth for calling the Claude API for content moderation.
 * Pinned to claude-haiku-4-5 — fast, cheap, and capable enough for the
 * structured classification task. Roughly $0.0001 per post.
 *
 * The moderation prompt is versioned (PROMPT_VERSION) so we can re-classify
 * historical content when we change the prompt and identify which rows used
 * which version.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Pinned model. Bump = re-classify campaign + audit log marker. */
export const MODERATION_MODEL = "claude-haiku-4-5";

/** Pinned prompt version. Stored on every classification row so we can
 *  identify which rows used which prompt and re-classify selectively. */
export const PROMPT_VERSION = "v1";

/** Categories the classifier maps content into. Open-ended `other` for
 *  things we want to capture but haven't formalized yet. */
export const CATEGORIES = [
  "spam",
  "harassment",
  "hate_speech",
  "self_harm",
  "violence",
  "sexual",
  "pii_leak",
  "off_topic",
  "brigading",
  "other",
] as const;
export type ModerationCategory = (typeof CATEGORIES)[number];

/** What the classifier returns for one piece of content. */
export interface ModerationResult {
  /** Final routing decision. */
  status: "safe" | "flag_review" | "auto_hide";
  /** 0 = totally safe, 5 = severe (auto-hide territory). */
  severity: 0 | 1 | 2 | 3 | 4 | 5;
  /** Categories detected. May be empty for safe content. */
  categories: ModerationCategory[];
  /**
   * Self-harm is independently flagged regardless of severity. Self-harm
   * posts STAY VISIBLE — they're help-seeking behavior. The UI separately
   * surfaces crisis resources to the author + admins are notified.
   */
  self_harm_detected: boolean;
  /** Plain-English explanation, ~1 sentence. Shown to admins in the queue. */
  reason: string;
}

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

interface AnthropicErrorResponse {
  error?: { message?: string; type?: string };
}

export class ModerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ModerationError";
  }
}

/** Context passed alongside the body. Affects prompt reasoning — e.g. a
 *  post in the country-music community vs. a comment under an event. */
export interface ModerationContext {
  community_id?: string;
  kind?: string; // e.g. 'post', 'comment', 'announcement', 'challenge', 'poll'
  visibility?: string;
  parent_post_kind?: string;
}

/**
 * Classify a piece of user-generated text into our moderation taxonomy.
 *
 * Throws ModerationError on auth/rate/server failures. Returns a structured
 * ModerationResult on success — never silently returns a "safe" default.
 * Callers (the inline trigger and the cron) handle errors by leaving the
 * row in 'pending' status so the next pass retries.
 */
export async function classifyContent(
  text: string,
  context: ModerationContext = {},
): Promise<ModerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModerationError(
      "ANTHROPIC_API_KEY is not set. Add it to Vercel env vars before the moderation pipeline can run.",
    );
  }

  const cleanText = (text ?? "").trim();
  if (!cleanText) {
    // Empty input → trivially safe. Cheap path that avoids an API call.
    return {
      status: "safe",
      severity: 0,
      categories: [],
      self_harm_detected: false,
      reason: "Empty content.",
    };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(cleanText, context);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODERATION_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      // Lower temp = more consistent classification across identical inputs.
      temperature: 0,
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
    throw new ModerationError(
      `Anthropic API ${response.status}: ${detail || response.statusText}`,
    );
  }

  const json = (await response.json()) as AnthropicMessageResponse;
  const textBlock = json.content.find((c) => c.type === "text")?.text ?? "";
  if (!textBlock) {
    throw new ModerationError("Empty response from Claude");
  }

  return parseClassifierOutput(textBlock);
}

/** System prompt — establishes role + output format. Versioned via
 *  PROMPT_VERSION above; bumping the version is the signal to re-classify
 *  historical content. */
function buildSystemPrompt(): string {
  return `You are a content moderation classifier for Fan Engage, a
fan-club community platform for music artists. Your job is to classify
user-generated posts and comments by safety risk.

Output JSON ONLY, with no surrounding text or commentary. Schema:

{
  "status": "safe" | "flag_review" | "auto_hide",
  "severity": 0-5,
  "categories": [],
  "self_harm_detected": boolean,
  "reason": "1 sentence explanation"
}

Severity scale:
  0 = Totally safe; clearly on-topic fan content.
  1 = Mild edge case (slight off-topic, lukewarm complaint). Status: safe.
  2 = Edge case worth a human eye (mild rudeness, plausibly off-topic). Status: flag_review.
  3 = Clear policy concern but not severe (heated argument, soft slur). Status: flag_review.
  4 = Serious violation (explicit harassment, scam link, doxxing). Status: auto_hide.
  5 = Severe violation (hate speech, explicit threats, CSAM signals). Status: auto_hide.

Categories (include all that apply, may be empty for safe content):
  spam, harassment, hate_speech, self_harm, violence, sexual,
  pii_leak, off_topic, brigading, other

Special cases:
  * SELF-HARM: If the content suggests the author is struggling with
    self-harm, suicidal ideation, or eating disorders, set
    self_harm_detected: true. Do NOT auto_hide self-harm posts — they're
    often help-seeking. Set status based on other factors only.
  * BRIGADING: Aggressive criticism of the artist coming from outside
    the artist's actual fan base (e.g., trolls from rival fandoms).
    Distinguish from honest critique by long-term members.
  * PII LEAK: Phone numbers, home addresses, real names of minors,
    private DM screenshots without consent. Severity 4-5.
  * OFF-TOPIC: Posts about completely unrelated topics. Severity 1-2.
    A post about an artist's tour in another artist's community is
    severity 2-3 (flag_review).

Be CALIBRATED. Most fan content is severity 0-1. Don't over-flag mild
heated comments — fans get passionate. Reserve severity 4-5 for content
that genuinely shouldn't be visible.`;
}

/** User prompt — wraps the actual content + context in a clear frame. */
function buildUserPrompt(text: string, context: ModerationContext): string {
  const parts: string[] = [];
  parts.push("CONTEXT:");
  if (context.community_id) parts.push(`  Community: ${context.community_id}`);
  if (context.kind) parts.push(`  Kind: ${context.kind}`);
  if (context.visibility) parts.push(`  Visibility: ${context.visibility}`);
  if (context.parent_post_kind) {
    parts.push(`  Parent post kind: ${context.parent_post_kind}`);
  }
  parts.push("");
  parts.push("CONTENT:");
  parts.push(text);
  parts.push("");
  parts.push("Classify the content above. Output JSON only.");
  return parts.join("\n");
}

/** Parse + validate the classifier's JSON output. Defensive — Claude is
 *  consistent at temp=0 but we still pin everything. */
function parseClassifierOutput(raw: string): ModerationResult {
  // Claude sometimes wraps JSON in ```json fences. Strip them defensively.
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new ModerationError(
      `Classifier returned non-JSON output: ${stripped.slice(0, 200)}`,
      err,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ModerationError("Classifier output is not an object");
  }
  const obj = parsed as Record<string, unknown>;

  // status
  const status = obj.status;
  if (status !== "safe" && status !== "flag_review" && status !== "auto_hide") {
    throw new ModerationError(`Invalid status: ${String(status)}`);
  }

  // severity
  const sev = Number(obj.severity);
  if (!Number.isInteger(sev) || sev < 0 || sev > 5) {
    throw new ModerationError(`Invalid severity: ${String(obj.severity)}`);
  }

  // categories
  const rawCategories = Array.isArray(obj.categories) ? obj.categories : [];
  const categories: ModerationCategory[] = rawCategories
    .map((c) => String(c))
    .filter((c): c is ModerationCategory =>
      (CATEGORIES as readonly string[]).includes(c),
    );

  // self_harm_detected
  const selfHarm = obj.self_harm_detected === true;

  // reason
  const reason = typeof obj.reason === "string" ? obj.reason : "";

  return {
    status,
    severity: sev as ModerationResult["severity"],
    categories,
    self_harm_detected: selfHarm,
    reason,
  };
}
