import { createAdminClient } from "@/lib/supabase/admin";

type FanRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  current_tier: string;
  total_points: number;
  created_at: string;
};

async function listTopFans(limit = 50): Promise<FanRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("fans")
      .select("id,email,first_name,current_tier,total_points,created_at")
      .order("total_points", { ascending: false })
      .limit(limit);
    return (data ?? []) as FanRow[];
  } catch {
    return [];
  }
}

export default async function AdminFansPage() {
  const fans = await listTopFans();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Fans
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Top {fans.length} fans by total points. Read-only for now — edits happen via Supabase
          directly.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/40 text-left text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {fans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/50">
                  No fans yet.
                </td>
              </tr>
            )}
            {fans.map((f) => (
              <tr key={f.id} className="border-t border-white/5">
                <td className="px-4 py-3">{f.first_name ?? "—"}</td>
                <td className="px-4 py-3">{f.email ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{f.current_tier}</td>
                <td className="px-4 py-3 text-right">
                  {new Intl.NumberFormat("en-US").format(f.total_points)}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {new Date(f.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
