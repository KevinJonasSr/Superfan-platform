import { getActiveOffers } from "@/lib/data/offers";
import type { Offer } from "@/lib/data/types";

const tabs = ["Featured", "Merch", "Experiences", "Collectibles", "Fan-Exclusive"];

// Static preview content used when Supabase has no offers yet.
const fallbackProducts = [
  { title: "Signed World Tour Hoodie", tier: "Silver Priority", pts: "3,400 pts", category: "Merch", badge: "Limited" },
  { title: "Backstage Polaroid Pack", tier: "Gold Exclusive", pts: "5,200 pts", category: "Featured", badge: "Drop" },
  { title: "VIP Soundcheck + Meet", tier: "Platinum", pts: "9,800 pts", category: "Experiences", badge: "New" },
  { title: "Handwritten Lyric Sheet", tier: "Gold", pts: "4,750 pts", category: "Collectibles", badge: "1/50" },
  { title: "Fan-Exclusive Vinyl Variant", tier: "All tiers", pts: "$45", category: "Fan-Exclusive", badge: "Preorder" },
];

function formatPrice(o: Offer): string {
  if (o.price_points) return `${new Intl.NumberFormat("en-US").format(o.price_points)} pts`;
  if (o.price_cents != null) return `$${(o.price_cents / 100).toFixed(2)}`;
  return "—";
}

function formatTier(slug: Offer["min_tier"]): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function formatCategory(cat: Offer["category"]): string {
  return {
    merch: "Merch",
    experience: "Experience",
    collectible: "Collectible",
    digital: "Digital",
    ticket: "Ticket",
  }[cat];
}

export default async function MarketplacePage() {
  const dbOffers = await getActiveOffers();
  const usingDb = dbOffers.length > 0;

  const products = usingDb
    ? dbOffers.map((o) => ({
        title: o.title,
        tier: formatTier(o.min_tier),
        pts: formatPrice(o),
        category: formatCategory(o.category),
        badge: o.inventory != null && o.inventory > 0 ? `${o.inventory} left` : "New",
        slug: o.slug,
      }))
    : fallbackProducts.map((p) => ({ ...p, slug: p.title.toLowerCase().replace(/\s+/g, "-") }));

  return (
    <div className="min-h-screen bg-midnight">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row">
        <div className="flex-1 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-800/30 via-slate-900 to-midnight p-6 shadow-glass">
            <p className="text-sm uppercase tracking-wide text-white/60">Marketplace</p>
            <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Drops tailored to your tier
            </h1>
            <p className="mt-4 text-sm text-white/70">
              Redeem points or purchase exclusive merch, experiences, and collectibles before they hit the public store.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  className={`rounded-full px-4 py-2 text-sm ${
                    index === 0
                      ? "bg-white text-midnight"
                      : "border border-white/20 text-white/70"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {!usingDb && (
              <p className="mt-4 text-xs text-white/40">
                Preview data — add offers in /admin or via Supabase to populate real inventory.
              </p>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {products.map((item) => (
              <div key={item.slug} className="glass-card p-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">
                  <span>{item.tier}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">{item.badge}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">Category · {item.category}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-lg font-semibold text-emerald-300">{item.pts}</span>
                  <button className="rounded-full border border-white/30 px-4 py-2 text-sm text-white/80">
                    Redeem
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="w-full max-w-sm space-y-6">
          <section className="glass-card p-6">
            <p className="text-sm uppercase tracking-wide text-white/60">Mobile view</p>
            <div className="mt-4 space-y-4">
              {products.slice(0, 3).map((item) => (
                <div key={item.slug} className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{item.tier}</p>
                  <p className="mt-1 text-sm font-semibold">{item.title}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-300">{item.pts}</span>
                    <button className="text-xs text-white/70">Reserve →</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
