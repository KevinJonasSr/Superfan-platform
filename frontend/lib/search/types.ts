/**
 * Shared types for the semantic search pipeline.
 */

/** What content_embeddings.source_table allows. Matches the SQL CHECK
 *  constraint in migration 0024. */
export type SearchSourceTable =
  | "community_posts"
  | "community_comments"
  | "communities"
  | "artist_events"
  | "rewards_catalog";

/** A single search hit with the source data inlined for rendering. */
export interface SearchHit {
  source_table: SearchSourceTable;
  source_id: string;
  community_id: string;
  /** Cosine distance from the query (0 = identical). Useful for
   *  thresholding ("show only matches with distance < 0.5"). */
  distance: number;
  /** Source-specific renderable data. */
  data: SearchHitData;
}

export type SearchHitData =
  | { kind: "community"; slug: string; display_name: string; tagline: string | null; bio: string | null }
  | { kind: "post"; id: string; artist_slug: string; title: string | null; body: string; created_at: string }
  | { kind: "comment"; id: string; post_id: string; body: string; created_at: string; artist_slug: string }
  | { kind: "event"; id: string; artist_slug: string; title: string; detail: string | null; event_date: string | null; url: string | null }
  | { kind: "reward"; id: string; community_id: string; title: string; description: string | null; point_cost: number };

/** Final response shape — grouped + ordered for the results page. */
export interface SearchResults {
  query: string;
  durationMs: number;
  totalHits: number;
  /** Source rows that didn't load (deleted between embedding + query). */
  missingSourceRows: number;
  groups: {
    communities: SearchHit[];
    posts: SearchHit[];
    events: SearchHit[];
    rewards: SearchHit[];
    comments: SearchHit[];
  };
}
