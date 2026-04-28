/**
 * OpenAI embeddings client.
 *
 * Single source of truth for calling the OpenAI embeddings API. All callers
 * (inline indexing on post create, the backfill cron, the search query path)
 * route through this module so we have one place to change provider, log
 * usage, or apply rate limits.
 *
 * Provider: OpenAI text-embedding-3-small (1536 dims, $0.02 per 1M tokens).
 *
 * The model name + dim count are pinned because they have to match the
 * `vector(1536)` column type in the content_embeddings table (migration
 * 0024). If we ever change models, that's a coordinated migration.
 */

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

/** Pinned to match content_embeddings.embedding column type. */
export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMS = 1536;

/** OpenAI accepts up to 2048 inputs per call. We stay well below that. */
const BATCH_SIZE_MAX = 100;

/** Hard cap per input in tokens. text-embedding-3-* supports 8191; we
 *  truncate at ~8000 chars (≈ 2000 tokens) to stay safe and predictable. */
const MAX_INPUT_CHARS = 8000;

interface OpenAIEmbedResponse {
  data: Array<{ index: number; embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface OpenAIErrorResponse {
  error?: { message?: string; code?: string };
}

export class EmbeddingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/**
 * Embed a single piece of text. Returns a 1536-dim float array.
 * Throws EmbeddingError on auth / rate / server failures.
 *
 * Empty/whitespace-only input returns null — caller decides whether to
 * skip the row or use a zero vector.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const cleaned = normalizeForEmbedding(text);
  if (!cleaned) return null;
  const [vec] = await embedBatch([cleaned]);
  return vec ?? null;
}

/**
 * Embed multiple texts in a single API call. Returns vectors in the same
 * order as the inputs. Empty inputs are filtered out *before* the API call;
 * the returned array's length may be shorter than `texts.length`.
 *
 * For variable-length inputs where you need 1:1 mapping back to source rows,
 * use `embedBatchWithIndex` instead.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > BATCH_SIZE_MAX) {
    // Split into chunks. OpenAI handles large batches, but smaller chunks
    // give us better progress visibility for the backfill cron.
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE_MAX) {
      const chunk = texts.slice(i, i + BATCH_SIZE_MAX);
      const vectors = await embedBatch(chunk);
      out.push(...vectors);
    }
    return out;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      "OPENAI_API_KEY is not set. Add it to Vercel env vars before the embedding pipeline can run.",
    );
  }

  // Filter empty inputs to avoid wasting API calls.
  const inputs = texts.map(normalizeForEmbedding).filter((t): t is string => !!t);
  if (inputs.length === 0) return [];

  const response = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      // OpenAI defaults to 1536 for text-embedding-3-small but we pin
      // explicitly so a future model default change can't silently break
      // the pgvector dimension match.
      dimensions: EMBED_DIMS,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as OpenAIErrorResponse;
      detail = err.error?.message ?? "";
    } catch {
      detail = await response.text();
    }
    throw new EmbeddingError(
      `OpenAI embeddings API ${response.status}: ${detail || response.statusText}`,
    );
  }

  const json = (await response.json()) as OpenAIEmbedResponse;
  // OpenAI returns embeddings in the same order as the inputs.
  return json.data.map((d) => d.embedding);
}

/**
 * Same as `embedBatch` but returns `(originalItem, vector)` pairs so
 * callers can map results back to source rows even when some inputs were
 * filtered out as empty. Use this when you have rows you're trying to
 * index — you need the source_id for each successful embed.
 */
export async function embedBatchWithIndex<T>(
  items: T[],
  textOf: (item: T) => string,
): Promise<Array<{ item: T; embedding: number[] }>> {
  // Build (item, normalizedText) pairs, dropping empties.
  const pairs = items
    .map((item) => ({ item, text: normalizeForEmbedding(textOf(item)) }))
    .filter((p): p is { item: T; text: string } => !!p.text);

  if (pairs.length === 0) return [];

  const vectors = await embedBatch(pairs.map((p) => p.text));
  if (vectors.length !== pairs.length) {
    throw new EmbeddingError(
      `Embedding count mismatch: sent ${pairs.length} inputs, got ${vectors.length} vectors`,
    );
  }

  return pairs.map((p, i) => ({ item: p.item, embedding: vectors[i] }));
}

/**
 * Normalize text before embedding:
 *   - trim outer whitespace
 *   - collapse internal runs of whitespace to a single space
 *   - truncate to MAX_INPUT_CHARS (the API can handle longer but we cap
 *     to keep token cost predictable)
 *   - return null for empty / whitespace-only input
 *
 * Keep this stable — the content_hash for skip-on-no-change uses the
 * normalized form, so changing this function would invalidate hashes.
 */
export function normalizeForEmbedding(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_INPUT_CHARS);
}

/**
 * Serialize a number[] for inclusion in a Postgres pgvector INSERT/UPDATE.
 * pgvector's text format is `[0.123, 0.456, ...]` — JSON-array-shaped but
 * with no quotes. Numbers must not be NaN/Infinity.
 *
 * We pass this as a literal in SQL queries via supabase-js's .from().insert(),
 * which accepts the string form for vector columns.
 */
export function pgvectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBED_DIMS) {
    throw new EmbeddingError(
      `Expected ${EMBED_DIMS}-dim vector, got ${embedding.length}`,
    );
  }
  for (const n of embedding) {
    if (!Number.isFinite(n)) {
      throw new EmbeddingError(`Embedding contains non-finite value: ${n}`);
    }
  }
  return `[${embedding.join(",")}]`;
}
