import Link from "next/link";
import { listPolicies } from "@/lib/data/policies";

export const dynamic = "force-dynamic";

export default async function AdminPoliciesPage() {
  const policies = await listPolicies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Policies
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Edit Terms of Service, Privacy Policy, and Cookie Policy. Once counsel delivers
          the final text, paste it here and flip the DRAFT banner off — no code deploy needed.
        </p>
      </div>

      <div className="space-y-3">
        {policies.length === 0 ? (
          <p className="text-xs text-white/50">No policies found. Re-run migration 0009.</p>
        ) : (
          policies.map((p) => {
            const publicSlug = p.slug === "cookie_policy" ? "cookie-policy" : p.slug;
            return (
              <Link
                key={p.slug}
                href={`/admin/policies/${p.slug}`}
                className="block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{p.title}</p>
                    <p className="text-xs text-white/60">/{publicSlug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_draft ? (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                        Draft
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                        Published
                      </span>
                    )}
                    {p.effective_date && (
                      <span className="text-[11px] text-white/50">
                        Effective {new Date(p.effective_date).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-white/50">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
