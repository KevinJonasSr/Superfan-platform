"use client";

import {
  Activity,
  ArrowRight,
  Crown,
  Gift,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

const fanJourney = [
  { title: "Join the Inner Circle", subtitle: "Fan onboarding wizard captures preferences, social accounts, and city" },
  { title: "Unlock Rewards", subtitle: "Points, badges, tiers, and marketplace offers keep fans moving" },
  { title: "Refer & Amplify", subtitle: "Referral engine rewards fans for bringing new superfans" },
];

const adminModules = [
  { title: "Rewards Manager", description: "Configure tiers, point rules, badges, unlocks, and reward campaigns." },
  { title: "Marketplace Manager", description: "Launch merch drops, VIP experiences, ticket presales, or digital collectibles." },
  { title: "Community & Referrals", description: "Run fan challenges, polls, Q&A, and referral competitions." },
  { title: "Fan CRM & Analytics", description: "See top fans, retention, conversion, and superfan score insights." },
];

const marketplaceHighlights = [
  { title: "Signed Merch Drops", detail: "Limited-run items gated by tier" },
  { title: "VIP Access & Meetups", detail: "Fan experiences and backstage upgrades" },
  { title: "Ticket Presale Upgrades", detail: "Give superfans first access" },
  { title: "Digital Collectibles", detail: "Reward ownership for superfans" },
];

const analyticsCallouts = [
  { label: "Fan Retention", value: "78%" },
  { label: "Referral Conversion", value: "24%" },
  { label: "Merch Conversion", value: "3.4x" },
  { label: "Avg. Superfan Spend", value: "$162" },
];

const tiers = [
  { label: "Bronze", perks: ["Unlock fan dashboard", "Earn starter badge"] },
  { label: "Silver", perks: ["Merch presales", "Community challenges"] },
  { label: "Gold", perks: ["Ticket presales", "VIP livestreams"] },
  { label: "Platinum", perks: ["Backstage experiences", "Collector drops"] },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-800/40 via-black to-slate-950 px-6 py-24">
        <div className="mx-auto max-w-5xl space-y-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-white/80">
            <Sparkles size={16} /> Superfan Operating System
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Turn casual listeners into superfans.
          </h1>
          <p className="max-w-3xl text-lg text-white/80">
            Launch a branded fan experience with rewards, marketplace, referrals, and analytics in days—not months. Fans get access and status. You get data, monetization, and loyalty.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-lg font-semibold text-slate-900">
              Book a Demo <ArrowRight size={18} />
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-lg font-semibold text-white/80">
              See the Fan Journey
            </button>
          </div>
          <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {analyticsCallouts.map((item) => (
              <div key={item.label}>
                <p className="text-sm uppercase tracking-wide text-white/60">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3 text-white/70">
            <Star size={20} className="text-yellow-300" />
            <p className="text-sm uppercase tracking-wide">Fan Journey</p>
          </div>
          <h2 className="text-3xl font-semibold text-white">How fans experience the platform</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {fanJourney.map((step, idx) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
                <p className="text-sm font-semibold text-purple-400">Step 0{idx + 1}</p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-white/70">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/40 px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="flex items-center gap-3 text-white/70">
            <Users size={20} className="text-cyan-300" />
            <p className="text-sm uppercase tracking-wide">Artist Control</p>
          </div>
          <h2 className="text-3xl font-semibold text-white">Admin command center</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {adminModules.map((module) => (
              <div key={module.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
                <h3 className="text-xl font-semibold">{module.title}</h3>
                <p className="mt-3 text-white/70">{module.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="flex items-center gap-3 text-white/70">
            <Gift size={20} className="text-rose-300" />
            <p className="text-sm uppercase tracking-wide">Marketplace & Rewards</p>
          </div>
          <h2 className="text-3xl font-semibold text-white">Offer playbook</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {marketplaceHighlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-white/70">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/30 px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center gap-3 text-white/70">
            <Crown size={20} className="text-amber-300" />
            <p className="text-sm uppercase tracking-wide">Tier Progression</p>
          </div>
          <h2 className="text-3xl font-semibold text-white">Bronze → Platinum</h2>
          <div className="grid gap-6 sm:grid-cols-4">
            {tiers.map((tier) => (
              <div key={tier.label} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm font-semibold text-purple-300">{tier.label}</p>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  {tier.perks.map((perk) => (
                    <li key={perk}>• {perk}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-sm uppercase tracking-wide text-white/60">Superfan Platform</p>
          <h2 className="mt-4 text-3xl font-semibold text-white">Ready to launch your fan operating system?</h2>
          <p className="mt-3 text-white/70">
            Build an ecosystem fans love: onboarding, rewards, marketplace, community, and analytics—built for artists from day one.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-lg font-semibold text-slate-900">
              Request Access <ArrowRight size={18} />
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-lg font-semibold text-white/80">
              Explore Fan Experience
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
