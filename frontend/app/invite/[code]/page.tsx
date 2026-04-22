import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "You're invited · Fan Engage",
};

const REF_COOKIE = "fanengage_ref";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function getInviter(code: string): Promise<{
  firstName: string | null;
  referrerId: string;
} | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("fans")
      .select("id, first_name")
      .eq("referral_code", code)
      .maybeSingle();
    if (!data) return null;
    return { firstName: (data.first_name as string | null) ?? null, referrerId: data.id as string };
  } catch {
    return null;
  }
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const inviter = await getInviter(code);
  if (!inviter) notFound();

  // Store the referral code in a cookie so onboarding can attribute the
  // signup back to the referrer after the auth round-trip. Not HttpOnly —
  // the client wizard reads it, and it's not sensitive data.
  const cookieStore = await cookies();
  cookieStore.set(REF_COOKIE, code, {
    maxAge: REF_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });

  const inviterName = inviter.firstName ?? "A Fan Engage fan";

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-aurora/30 via-slate-900 to-ember/20 p-8 shadow-glass">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">You&apos;re invited</p>
        <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {inviterName} invited you to Fan Engage
        </h1>
        <p className="mt-4 text-sm text-white/75">
          Join in under a minute — rewards, early drops, VIP experiences, and 150 bonus points
          for you and {inviterName} once you finish signup.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            I already have an account
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/50">
          Invite code: <code className="font-mono">{code}</code>
        </p>
      </section>
    </main>
  );
}
