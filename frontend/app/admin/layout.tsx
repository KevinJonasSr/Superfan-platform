import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/challenges", label: "Challenges" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/fans", label: "Fans" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?next=/admin");

  return (
    <div className="min-h-screen bg-midnight">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs uppercase tracking-wide text-amber-300">
              Admin
            </span>
            <span className="text-white/60">Signed in as {admin.email}</span>
          </div>
          <nav className="flex items-center gap-1 text-sm text-white/70">
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
