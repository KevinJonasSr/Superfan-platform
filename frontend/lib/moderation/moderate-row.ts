/**
 * Moderate a single row.
 *
 * Entry point for inline moderation (server actions on post create) and
 * the backfill cron. Symmetric with lib/embeddings/index-row.ts.
 *
 * Calls the classifier, then applies the decision via the
 * apply_moderation_decision() Postgres function — atomic update of the
 * source row + audit log row in one transaction.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyContent,
  ModerationError,
  MODERATION_MODEL,
  PROMPT_VERSION,
  type ModerationResult,
} from "./client";

export type ModerateSourceTable = "community_posts" | "community_comments";

export type ModerateResult =
  | {
      status: "classified";
      decision: ModerationResult;
    }
  | { status: "skipped_no_row" }
  | { status: "skipped_empty" }
  | { status: "error"; error: string };

/**
 * Classify and persist a moderation decision for a single source row.
 *
 * Idempotent semantics: if the row is already classified (status !=
 * 'pending'), we re-classify and overwrite — useful when a prompt version
 * changes. Callers that want to skip already-classified rows should
 * filter at the SQL layer.
 */
export async function moderateRow(
  table: ModerateSourceTable,
  rowId: string,
): Promise<ModerateResult> {
  try {
    const admin = createAdminClient();

    // 1. Fetch the row + the context the prompt needs.
    let body = "";
    let context: Record<string, unknown> = {};

    if (table === "community_posts") {
      const { data, error } = await admin
        .from("community_posts")
        .select("id, artist_slug, kind, title, body, visibility")
        .eq("id", rowId)
        .maybeSingle();
      if (error) return { status: "error", error: error.message };
      if (!data) return { status: "skipped_no_row" };
      body = [data.title, data.body]
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .join("\n\n");
      context = {
        community_id: data.artist_slug,
        kind: data.kind,
        visibility: data.visibility,
      };
    } else {
      // community_comments — also need parent post for context
      const { data, error } = await admin
        .from("community_comments")
        .select(
          "id, post_id, body, community_posts!inner(artist_slug, kind, visibility)",
        )
        .eq("id", rowId)
        .maybeSingle();
      if (error) return { status: "error", error: error.message };
      if (!data) return { status: "skipped_no_row" };
      const parent = (
        data as unknown as {
          community_posts: {
            artist_slug: string;
            kind: string;
            visibility: string;
          };
        }
      ).community_posts;
      body = data.body ?? "";
      context = {
        community_id: parent?.artist_slug,
        parent_post_kind: parent?.kind,
        visibility: parent?.visibility,
        kind: "comment",
      };
    }

    if (!body.trim()) return { status: "skipped_empty" };

    // 2. Classify.
    const decision = await classifyContent(body, context);

    // 3. Apply the decision atomically (source row + audit log).
    const { error: applyError } = await admin.rpc(
      "apply_moderation_decision",
      {
        p_source_table: table,
        p_source_id: rowId,
        p_decided_by: "ai",
        p_admin_user_id: null,
        p_new_status: decision.status,
        p_severity: decision.severity,
        p_categories: decision.categories,
        p_reason: decision.reason,
        p_self_harm: decision.self_harm_detected,
        p_model: MODERATION_MODEL,
        p_prompt_version: PROMPT_VERSION,
        p_admin_notes: null,
      },
    );
    if (applyError) {
      return { status: "error", error: applyError.message };
    }

    return { status: "classified", decision };
  } catch (err) {
    const message =
      err instanceof ModerationError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[moderation] moderateRow ${table}/${rowId} failed:`, message);
    return { status: "error", error: message };
  }
}

/**
 * Fire-and-forget version for inline use in server actions.
 *
 *   import { moderateRowAsync } from "@/lib/moderation";
 *   ...
 *   moderateRowAsync("community_posts", newPost.id);  // no await
 *
 * The Promise is intentionally not awaited; we don't want the user's
 * response to block on the classifier. The backfill cron is the safety
 * net for cases where this path fails.
 */
export function moderateRowAsync(
  table: ModerateSourceTable,
  rowId: string,
): void {
  void Promise.resolve().then(() => moderateRow(table, rowId));
}

/**
 * Admin override path. Sets a row to a specific status with admin notes,
 * appending to the audit log.
 */
export async function applyAdminOverride(args: {
  table: ModerateSourceTable;
  rowId: string;
  adminUserId: string;
  newStatus: "safe" | "flag_review" | "auto_hide";
  adminNotes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("apply_moderation_decision", {
      p_source_table: args.table,
      p_source_id: args.rowId,
      p_decided_by: "admin",
      p_admin_user_id: args.adminUserId,
      p_new_status: args.newStatus,
      p_severity: null,
      p_categories: null,
      p_reason: null,
      p_self_harm: false,
      p_model: null,
      p_prompt_version: null,
      p_admin_notes: args.adminNotes ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
