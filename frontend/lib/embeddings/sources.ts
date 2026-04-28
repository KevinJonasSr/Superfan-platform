/**
 * Source-table registry for the embedding pipeline.
 *
 * Each "source" describes one of the text-bearing tables in Fan Engage that
 * we want to embed. The registry tells the indexer:
 *
 *   1. How to assemble the embeddable text from the source row's columns
 *      (e.g. for community_posts: title + body; for communities: bio +
 *      tagline + genres).
 *   2. How to derive the (community_id, visibility) tenant/access metadata
 *      that gets mirrored into the content_embeddings row.
 *   3. The content_embeddings.source_id format. For uuid-keyed tables it's
 *      just the row's id; for `communities` (slug-keyed) we use a
 *      deterministic uuid derived from md5('community:' || slug) — same
 *      formula as `list_unembedded_rows()` in migration 0024.
 *
 * Adding a new embeddable table = adding one entry to SOURCES below.
 */

import crypto from "node:crypto";

/** What content_embeddings.source_table allows. Must match the SQL CHECK. */
export type SourceTable =
  | "community_posts"
  | "post_comments"
  | "communities"
  | "artist_events"
  | "rewards_catalog"
  | "offers";

/** What content_embeddings.visibility allows. Must match the SQL CHECK. */
export type Visibility = "public" | "premium" | "founder" | "private";

/** Describes one source table for the embedding indexer. */
export interface SourceDescriptor {
  /** Logical name used in content_embeddings.source_table. */
  table: SourceTable;
  /**
   * Columns to fetch from this table when (re)indexing a row. Must include
   * everything `buildText` and `extractMeta` need.
   */
  columns: string;
  /** Build the embeddable text from a row of this table. */
  buildText(row: Record<string, unknown>): string;
  /**
   * Map a source row to the tenant + access metadata that gets stored on
   * the content_embeddings row. For `communities`, community_id is just
   * row.slug. For everything else, it's row.community_id.
   */
  extractMeta(row: Record<string, unknown>): {
    community_id: string;
    visibility: Visibility;
    /** UUID to write into content_embeddings.source_id. */
    source_id: string;
  };
}

/** Convert a slug to a stable uuid for the content_embeddings.source_id
 *  column. communities is the only source table that doesn't have native
 *  uuid keys — it's keyed by a text slug. We derive a deterministic uuid
 *  from md5('community:' || slug) so the value is reproducible across
 *  inline-indexing calls and the backfill cron. The same formula appears
 *  in list_unembedded_rows() inside migration 0024 — keep them in sync. */
export function slugToSourceId(slug: string): string {
  const hex = crypto
    .createHash("md5")
    .update(`community:${slug}`)
    .digest("hex");
  // Format as a uuid: 8-4-4-4-12.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** SHA-256 of the embeddable text. Used to skip re-embedding when nothing
 *  meaningful changed. The hash matches what's stored in
 *  content_embeddings.content_hash. */
export function contentHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Map a community_posts.visibility ('public' | 'premium') to the
 * content_embeddings.visibility space ('public' | 'premium' | 'founder'
 * | 'private'). For now identity for the values that exist; a 'pinned'
 * post is still 'public'.
 */
function postVisibility(row: Record<string, unknown>): Visibility {
  const v = String(row.visibility ?? "public");
  if (v === "premium") return "premium";
  if (v === "founder") return "founder";
  return "public";
}

/** The registry. */
export const SOURCES: Record<SourceTable, SourceDescriptor> = {
  community_posts: {
    table: "community_posts",
    columns: "id, community_id, title, body, visibility",
    buildText: (row) =>
      [row.title, row.body]
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .join("\n\n"),
    extractMeta: (row) => ({
      community_id: String(row.community_id),
      visibility: postVisibility(row),
      source_id: String(row.id),
    }),
  },

  post_comments: {
    table: "post_comments",
    // We need the parent post's community_id + visibility. Caller resolves
    // these via a join (see indexRow in lib/embeddings/index-row.ts) and
    // passes them in via row.community_id / row.visibility.
    columns:
      "id, post_id, body, community_id, visibility",
    buildText: (row) => String(row.body ?? ""),
    extractMeta: (row) => ({
      community_id: String(row.community_id),
      visibility: postVisibility(row),
      source_id: String(row.id),
    }),
  },

  communities: {
    table: "communities",
    columns:
      "slug, display_name, tagline, bio, genres, type",
    buildText: (row) => {
      const parts: string[] = [];
      if (row.display_name) parts.push(String(row.display_name));
      if (row.tagline) parts.push(String(row.tagline));
      if (row.bio) parts.push(String(row.bio));
      if (Array.isArray(row.genres) && row.genres.length > 0) {
        parts.push(`Genres: ${row.genres.join(", ")}`);
      }
      return parts.join("\n\n");
    },
    extractMeta: (row) => ({
      community_id: String(row.slug),
      visibility: "public",
      source_id: slugToSourceId(String(row.slug)),
    }),
  },

  artist_events: {
    table: "artist_events",
    columns:
      "id, community_id, title, detail, location, tier",
    buildText: (row) => {
      const parts: string[] = [];
      if (row.title) parts.push(String(row.title));
      if (row.location) parts.push(`Location: ${row.location}`);
      if (row.detail) parts.push(String(row.detail));
      return parts.join("\n\n");
    },
    extractMeta: (row) => ({
      community_id: String(row.community_id),
      visibility:
        row.tier === "premium"
          ? "premium"
          : row.tier === "founder-only"
            ? "founder"
            : "public",
      source_id: String(row.id),
    }),
  },

  rewards_catalog: {
    table: "rewards_catalog",
    columns: "id, community_id, name, description",
    buildText: (row) => {
      const parts: string[] = [];
      if (row.name) parts.push(String(row.name));
      if (row.description) parts.push(String(row.description));
      return parts.join("\n\n");
    },
    extractMeta: (row) => ({
      community_id: String(row.community_id),
      visibility: "public",
      source_id: String(row.id),
    }),
  },

  offers: {
    table: "offers",
    columns: "id, community_id, title, description, category",
    buildText: (row) => {
      const parts: string[] = [];
      if (row.title) parts.push(String(row.title));
      if (row.category) parts.push(`Category: ${row.category}`);
      if (row.description) parts.push(String(row.description));
      return parts.join("\n\n");
    },
    extractMeta: (row) => ({
      community_id: String(row.community_id),
      visibility: "public",
      source_id: String(row.id),
    }),
  },
};

/** All source tables in deterministic order — used by the backfill cron. */
export const SOURCE_TABLES: SourceTable[] = [
  "community_posts",
  "post_comments",
  "communities",
  "artist_events",
  "rewards_catalog",
  "offers",
];
