import { createAdminClient } from "@/lib/supabase/admin";

async function getCounts() {
  try {
    const admin = createAdminClient();
    const [fans, offers, referrals, purchases] = await Promise.all([
      admin.from("fans").select("id", { count: "exact", head: true }),
      admin.from("offers").select("id", { count: "exact", head: true }),
      admin.from("referrals").select("id", { count: "exact", head: true }),
      admin.from("purchases").select("id", { count: "exact", head: true }),
    ]);
    return {
      fans: fans.count ?? 0,
      offers: offers.count ?? 0,
      referrals: referrals.count ?? 0,
      purchases: purchases.count ?? 0,
    };
  } catch {
    return { fans: 0, offers: 0, referrals: 0, purchases: 0 };
  }
}

export default async function AdminOverviewPage() {
  const counts = await getCounts();
  const cards = [
    { label: "Fans", value: counts.fans, href: "/admin/fans" },
    { label: "Offers", value: counts.offers, href: "/admin/offers" },
    { label: "Referrals", value: counts.referrals, href: "#" },
    { label: "Purchases", value: counts.purchases, href: "#" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Platform overview
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Quick glance at the fan base. Use the tabs above to dive in.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <p className="text-xs uppercase tracking-wide text-white/60">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
