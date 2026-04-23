import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { getCommunity } from "@/lib/community";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/artists", label: "Artists" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/challenges", label: "Challenges" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/fans", label: "Fans" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/policies", label: "Policies" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin");

  // Check which pathname we're on — if the user hasn't picked a community
  // yet AND they're not already on the switcher page, bounce them there.
  const h = await headers();
  const pathname =
    h.get("x-invoke-path") ?? h.get("next-url") ?? h.get("referer") ?? "";
  const isOnSwitcher = pathname.includes("/admin/communities");
  const needsToPick =
    (ctx.isSuperAdmin || ctx.communities.length > 1) &&
    !ctx.currentCommunityId &&
    !isOnSwitcher;
  if (needsToPick) redirect("/admin/communities");

  const currentCommunity = ctx.currentCommunityId
    ? await getCommunity(ctx.currentCommunityId)
    : null;

  return (
    <div className="min-h-screen bg-midnight">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs uppercase tracking-wide text-amber-300">
              Admin
            </span>
            {currentCommunity && (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs"
                title={`Managing ${currentCommunity.display_name}`}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${currentCommunity.accent_from}, ${currentCommunity.accent_to})`,
                  }}
                />
                <span className="font-semibold text-white">
                  {currentCommunity.display_name}
                </span>
                {(ctx.isSuperAdmin || ctx.communities.length > 1) && (
                  <Link
                    href="/admin/communities"
                    className="text-white/50 hover:text-white"
                  >
                    switch
                  </Link>
                )}
              </span>
            )}
            <span className="text-white/60">{ctx.user.email}</span>
            {ctx.isSuperAdmin && (
              <span className="rounded-full bg-aurora/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-aurora">
                Super-admin
              </span>
            )}
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm text-white/70">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
