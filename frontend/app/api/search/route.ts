import { NextResponse } from "next/server";
import { search } from "@/lib/search";
import { EmbeddingError } from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=<query>
 *
 * Public endpoint — no auth gate. The search is "public" visibility
 * by default, so non-public content is filtered at the RPC layer.
 *
 * Failure modes:
 *   400 — missing or trivially short q
 *   503 — OPENAI_API_KEY not set / OpenAI down
 *   500 — anything else
 *
 * Caching: no-store. The query results are too varied + cheap to cache
 * meaningfully, and we want fresh moderation/visibility filters.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing q parameter." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Search is unavailable — embedding service not configured." },
      { status: 503 },
    );
  }

  try {
    const results = await search(query);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    if (err instanceof EmbeddingError) {
      return NextResponse.json(
        { error: "Search temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/search] failed:", msg);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
