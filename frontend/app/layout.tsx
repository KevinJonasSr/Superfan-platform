import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/cookie-banner";
import Footer from "@/components/footer";
import InstallPrompt from "@/components/install-prompt";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/data/notifications";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://fan-engage-pearl.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Fan Engage — your front-row seat",
    template: "%s · Fan Engage",
  },
  description:
    "The superfan platform. Follow artists, earn points for every fan move, and unlock real drops — signed vinyl, backstage access, listening parties.",
  applicationName: "Fan Engage",
  keywords: [
    "superfan",
    "fan club",
    "artist community",
    "fan rewards",
    "listening party",
    "VIP access",
  ],
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Fan Engage",
    title: "Fan Engage — your front-row seat",
    description:
      "Follow artists, earn points, unlock real drops. The superfan platform built for fans who actually show up.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fan Engage — your front-row seat",
    description:
      "Follow artists, earn points, unlock real drops. Built for the fans who actually show up.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fan Engage",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const navItems = [
  { href: "/", label: "Fan Home" },
  { href: "/rewards", label: "Rewards" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/referrals", label: "Referrals" },
  { href: "/artists", label: "Artists" },
];

/**
 * Tries to fetch the current user via the Supabase server client. If Supabase
 * isn't configured yet (env vars missing) we degrade gracefully and render the
 * signed-out header — the site still works end-to-end.
 */
async function getCurrentUserSafe() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: fan } = await supabase
      .from("fans")
      .select("first_name, avatar_url")
      .eq("id", data.user.id)
      .maybeSingle();
    return {
      email: data.user.email,
      first_name: (fan?.first_name as string | null) ?? null,
      avatar_url: (fan?.avatar_url as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUserSafe();
  // Unread inbox count only matters for signed-in fans. Wrapped in a try so a
  // transient DB error never breaks the header.
  let unread = 0;
  if (user) {
    try {
      unread = await getUnreadCount();
    } catch {
      unread = 0;
    }
  }

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-midnight text-white">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-midnight/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-aurora to-ember text-sm font-bold">
                FE
              </span>
              <span
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Fan Engage
              </span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm text-white/70 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/inbox"
                  aria-label={
                    unread > 0 ? `Inbox — ${unread} unread` : "Inbox"
                  }
                  title={
                    unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Inbox"
                  }
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 hover:bg-white/10"
                >
                  <span aria-hidden>🔔</span>
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-aurora to-ember px-1 text-[10px] font-semibold text-white shadow">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <Link
                  href="/rewards"
                  className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/80 hover:bg-white/10 sm:inline-flex"
                  title={user.email ?? undefined}
                >
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-aurora to-ember text-[10px] font-bold">
                      {(user.first_name?.[0] ?? user.email?.[0] ?? "F").toUpperCase()}
                    </span>
                  )}
                  <span>
                    {user.first_name ?? user.email?.split("@")[0] ?? "Signed in"}
                  </span>
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/onboarding"
                  className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </header>
        {children}
        <Footer />
        <CookieBanner />
        <InstallPrompt />
      </body>
    </html>
  );
}
