/**
 * Persist + dispatch the admin brief.
 *
 * Channels (env-gated, all optional):
 *   - DB persist: ALWAYS — admins can view at /admin/briefs.
 *   - Slack: when SLACK_ADMIN_WEBHOOK_URL is set. Single POST to a
 *     Slack incoming webhook with a plain text payload.
 *   - Email: deferred — see Phase 15 docs for the v2 path.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminBriefMetrics } from "./gather";
import { ADMIN_BRIEF_MODEL, ADMIN_BRIEF_PROMPT_VERSION } from "./summarize";

export interface SendBriefResult {
  brief_id: string;
  channels_sent: string[];
  errors: string[];
}

export async function persistAndDispatchBrief(
  metrics: AdminBriefMetrics,
  summary: string,
  generatedMs: number,
): Promise<SendBriefResult> {
  const admin = createAdminClient();
  const errors: string[] = [];
  const channels: string[] = [];

  // 1. Persist (always).
  const { data: row, error: insertErr } = await admin
    .from("admin_briefs")
    .insert({
      window_end: metrics.window_end,
      metrics: metrics as unknown as Record<string, unknown>,
      summary,
      prompt_version: ADMIN_BRIEF_PROMPT_VERSION,
      model: ADMIN_BRIEF_MODEL,
      generated_ms: generatedMs,
      channels_sent: [],
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    throw new Error(
      `admin_briefs insert failed: ${insertErr?.message ?? "no row"}`,
    );
  }

  // 2. Slack.
  const slackUrl = process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (slackUrl) {
    try {
      const slackResp = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*Fan Engage daily brief*\n\`\`\`${summary}\`\`\``,
        }),
      });
      if (!slackResp.ok) {
        const txt = await slackResp.text().catch(() => "");
        errors.push(`Slack ${slackResp.status}: ${txt.slice(0, 200)}`);
      } else {
        channels.push("slack");
      }
    } catch (err) {
      errors.push(
        `Slack send failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 3. Stamp channels_sent on the row.
  if (channels.length > 0) {
    await admin
      .from("admin_briefs")
      .update({ channels_sent: channels })
      .eq("id", row.id);
  }

  return {
    brief_id: row.id as string,
    channels_sent: channels,
    errors,
  };
}
