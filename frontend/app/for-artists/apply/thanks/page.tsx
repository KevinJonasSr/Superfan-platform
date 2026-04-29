import Link from "next/link";

export const metadata = { title: "Application received · Fan Engage" };

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">
        Application received
      </p>
      <h1
        className="text-4xl font-semibold leading-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Thanks — we&apos;ll be in touch within 48 hours.
      </h1>
      <p className="text-sm text-white/70">
        We review every application by hand. If you&apos;re a fit you&apos;ll
        get a follow-up email with a link to schedule onboarding. If we need
        more information first, we&apos;ll reach out at the email you provided.
      </p>
      <div className="pt-4">
        <Link
          href="/artists"
          className="rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
        >
          See active artists
        </Link>
      </div>
    </main>
  );
}
