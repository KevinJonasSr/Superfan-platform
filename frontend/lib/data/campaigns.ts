import { createClient } from "@/lib/supabase/server";

export interface FanActionRow {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  cta_label: string;
  point_value: number;
  completed: boolean;
}

/**
 * Returns active fan_actions for an artist plus whether the current fan has
 * already completed each one. Safe for signed-out callers (returns
 * completed=false for everything).
 */
export async function getActiveFanActionsForArtist(
  artistSlug: string,
): Promise<FanActionRow[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: actions, error } = await supabase
      .from("fan_actions")
      .select("id,kind,title,description,url,cta_label,point_value")
      .eq("artist_slug", artistSlug)
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    if (!actions || actions.length === 0) return [];

    let completedSet = new Set<string>();
    if (user) {
      const { data: done } = await supabase
        .from("fan_action_completions")
        .select("action_id")
        .eq("fan_id", user.id)
        .in(
          "action_id",
          actions.map((a) => a.id as string),
        );
      completedSet = new Set((done ?? []).map((d) => d.action_id as string));
    }

    return actions.map(
      (a) =>
        ({
          id: a.id as string,
          kind: a.kind as string,
          title: a.title as string,
          description: (a.description as string | null) ?? null,
          url: (a.url as string | null) ?? null,
          cta_label: a.cta_label as string,
          point_value: a.point_value as number,
          completed: completedSet.has(a.id as string),
        }) as FanActionRow,
    );
  } catch {
    return [];
  }
}
