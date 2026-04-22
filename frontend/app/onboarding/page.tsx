"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Star, Users } from "lucide-react";

const steps = [
  {
    title: "Fan Profile",
    description: "Capture the basics so the experience can personalize immediately.",
    fields: [
      { label: "Preferred name", name: "firstName", placeholder: "Taylor", type: "text" },
      { label: "Email", name: "email", placeholder: "taylor@email.com", type: "email" },
      { label: "City", name: "city", placeholder: "Austin, TX", type: "text" },
    ],
  },
  {
    title: "Interests",
    description: "Fans choose what they care about—rewards, marketplace drops, live moments.",
    fields: [
      { label: "Pick a lane", name: "interest", placeholder: "Rewards, VIP, Marketplace", type: "text" },
      { label: "Favorite song", name: "favoriteSong", placeholder: "Keep Up", type: "text" },
    ],
  },
  {
    title: "Access & Loyalty",
    description: "Tie their phone and socials to automate points + referrals.",
    fields: [
      { label: "Phone number", name: "phone", placeholder: "+1 (615) 555-0123", type: "tel" },
      { label: "TikTok or Instagram handle", name: "handle", placeholder: "@superfan", type: "text" },
    ],
  },
];

const checklist = [
  { label: "Preferences saved", value: "Ready" },
  { label: "SMS double opt-in", value: "Auto" },
  { label: "Referral code", value: "Generated" },
  { label: "Community badge", value: "Unlocked" },
];

const experiences = [
  { title: "Supernova Weekend", detail: "3-day VIP itinerary + challenge roadmap" },
  { title: "Marketplace Passport", detail: "Auto grants Bronze badge + merch credits" },
  { title: "Text-to-stage", detail: "SMS prompts that turn into instant point bursts" },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [smsStatus, setSmsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [smsMessage, setSmsMessage] = useState("Ready to send the confirmation text.");
  const [finishStatus, setFinishStatus] = useState<"idle" | "saving" | "error">("idle");

  const currentStep = steps[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  const handleInput = (name: string, value: string) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const nextStep = () => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStepIndex((prev) => Math.max(prev - 1, 0));

  const handleSmsOptIn = async () => {
    if (!formState.phone) {
      setSmsStatus("error");
      setSmsMessage("Add a phone number to trigger the confirmation message.");
      return;
    }

    try {
      setSmsStatus("loading");
      setSmsMessage("Sending confirmation text...");
      const response = await fetch("/api/fan-engage/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formState.phone,
          firstName: formState.firstName,
          interest: formState.interest,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send SMS");
      }

      setSmsStatus("success");
      setSmsMessage("Confirmation text delivered. Fan is live in the journey.");

      // Fire-and-forget Mailchimp subscribe — don't block the SMS success path
      // if Mailchimp isn't configured yet or the audience ID is missing.
      if (formState.email) {
        fetch("/api/fan-engage/mailchimp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formState.email,
            firstName: formState.firstName,
            tags: formState.interest ? [formState.interest] : undefined,
          }),
        }).catch((err) => {
          console.warn("Mailchimp subscribe did not complete:", err);
        });
      }

      // Fire-and-forget backend onboarding completion. Requires a Supabase
      // session — if the user isn't signed in, the endpoint returns 401 and
      // we ignore it (preview flow still works).
      const refCode =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("ref") ?? undefined
          : undefined;
      fetch("/api/fan-engage/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formState.firstName,
          city: formState.city,
          phone: formState.phone,
          handle: formState.handle,
          favoriteSong: formState.favoriteSong,
          interest: formState.interest,
          referralCode: refCode,
          smsOptedIn: true,
          emailOptedIn: Boolean(formState.email),
        }),
      }).catch((err) => {
        console.warn("Onboarding completion did not persist:", err);
      });
    } catch (error) {
      console.error(error);
      setSmsStatus("error");
      setSmsMessage("Twilio did not accept the request. Double-check the number and try again.");
    }
  };

  /**
   * Final-step submit: persists the profile, awards the signup bonus, sends
   * the Twilio SMS (if a phone is provided), fires Mailchimp, and routes
   * home. Doesn't require a phone — the wizard shouldn't dead-end on an
   * optional field.
   */
  const handleFinish = async () => {
    try {
      setFinishStatus("saving");

      // 1. Persist the profile + award signup bonus + record any ?ref= code.
      // Fallback to the fanengage_ref cookie that /invite/[code] sets so the
      // attribution survives the auth round-trip.
      const refFromUrl =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("ref") ?? undefined
          : undefined;
      const refFromCookie =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((c) => c.startsWith("fanengage_ref="))
              ?.split("=")[1]
          : undefined;
      const refCode = refFromUrl ?? refFromCookie;
      const onboardRes = await fetch("/api/fan-engage/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formState.firstName,
          city: formState.city,
          phone: formState.phone,
          handle: formState.handle,
          favoriteSong: formState.favoriteSong,
          interest: formState.interest,
          referralCode: refCode,
          smsOptedIn: Boolean(formState.phone),
          emailOptedIn: Boolean(formState.email),
        }),
      });

      if (!onboardRes.ok) {
        throw new Error(`Onboarding save failed (${onboardRes.status})`);
      }

      // Clear the referral cookie — attribution is now recorded in the DB.
      if (refFromCookie && typeof document !== "undefined") {
        document.cookie = "fanengage_ref=; path=/; max-age=0";
      }

      // 2. Mailchimp subscribe (fire-and-forget)
      if (formState.email) {
        fetch("/api/fan-engage/mailchimp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formState.email,
            firstName: formState.firstName,
            tags: formState.interest ? [formState.interest] : undefined,
          }),
        }).catch((err) => console.warn("Mailchimp subscribe did not complete:", err));
      }

      // 3. Twilio SMS confirmation (fire-and-forget; only if phone given)
      if (formState.phone) {
        fetch("/api/fan-engage/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formState.phone,
            firstName: formState.firstName,
            interest: formState.interest,
          }),
        }).catch((err) => console.warn("Twilio SMS did not complete:", err));
      }

      // 4. Route home so the updated profile renders with real data
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setFinishStatus("error");
    }
  };

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:flex-row">
        <section className="w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40 p-8">
          <div className="flex items-center justify-between text-sm uppercase tracking-[0.3em] text-white/60">
            <span>Onboarding wizard</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/60">Step {stepIndex + 1}</p>
              <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {currentStep.title}
              </h1>
              <p className="mt-2 text-white/70">{currentStep.description}</p>
            </div>

            <div className="space-y-4">
              {currentStep.fields.map((field) => (
                <label key={field.name} className="block text-sm text-white/80">
                  {field.label}
                  <input
                    type={field.type}
                    value={formState[field.name] ?? ""}
                    onChange={(event) => handleInput(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <button
                className="text-sm text-white/60 disabled:opacity-30"
                disabled={stepIndex === 0}
                onClick={prevStep}
              >
                Back
              </button>
              {isLastStep ? (
                <button
                  onClick={handleFinish}
                  disabled={finishStatus === "saving"}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110 disabled:opacity-50"
                >
                  {finishStatus === "saving" ? "Saving…" : "Finish onboarding"}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900"
                >
                  Continue <ArrowRight size={16} />
                </button>
              )}
            </div>
            {finishStatus === "error" && (
              <p className="text-sm text-rose-300">
                Could not save your profile. Are you still signed in? Try{" "}
                <a href="/login" className="underline">signing in</a> and retrying.
              </p>
            )}
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <Star className="text-amber-300" size={18} />
              <p>SMS double opt-in</p>
            </div>
            <p className="mt-3 text-sm text-white/60">{smsMessage}</p>
            <button
              onClick={handleSmsOptIn}
              className="mt-4 rounded-full border border-white/30 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
              disabled={smsStatus === "loading"}
            >
              {smsStatus === "loading" ? "Sending..." : "Send confirmation text"}
            </button>
            {smsStatus === "success" && (
              <p className="mt-2 text-sm text-emerald-300">Opt-in confirmed via Twilio.</p>
            )}
            {smsStatus === "error" && (
              <p className="mt-2 text-sm text-rose-300">Issue sending SMS. Try again.</p>
            )}
          </div>
        </section>

        <aside className="flex-1 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-700/20 via-slate-900 to-black p-6">
            <div className="flex items-center gap-3 text-white/70">
              <Users size={20} className="text-cyan-300" />
              <p className="text-xs uppercase tracking-wide">Experience preview</p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Plan the first 72 hours</h2>
            <div className="mt-4 space-y-4">
              {experiences.map((experience) => (
                <div key={experience.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-sm font-semibold">{experience.title}</p>
                  <p className="text-xs text-white/60">{experience.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wide text-white/60">Launch checklist</p>
            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="text-xs text-white/60">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
