import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Fan Engage",
  description: "The superfan platform — rewards, marketplace, referrals, and more.",
};

const navItems = [
  { href: "/", label: "Fan Home" },
  { href: "/rewards", label: "Rewards" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/referrals", label: "Referrals" },
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
    return data.user;
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
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Sign out
                </button>
              </form>
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
                  className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white shadow-glass"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
