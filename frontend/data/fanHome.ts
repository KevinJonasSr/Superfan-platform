export type FanHomeData = {
  slug: string;
  heroLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadge?: string;
  supportNote?: string;
  kpis: { label: string; value: string; delta: string }[];
  journeyCards: { title: string; points: string; cta?: string }[];
  events: { title: string; detail: string; date: string }[];
  offers: { title: string; tier: string; points: string }[];
  quickActions: string[];
  tiers: { label: string; status: string; icon: string }[];
  mobileNote?: string;
};

export const fanHomeData: Record<string, FanHomeData> = {
  raelynn: {
    slug: "raelynn",
    heroLabel: "Fan Momentum · Preview",
    heroTitle: "RaeLynn Inner Circle Preview",
    heroSubtitle:
      "Founding members unlock early listening rooms, exclusive merch drops, and VIP meetups.",
    heroBadge: "First 100 members receive a signed Polaroid",
    supportNote:
      "This artist surface is a preview. Use the footer links for help, contact, privacy, and terms whenever you need support.",
    kpis: [
      { label: "Total Points", value: "12,450", delta: "+320 today" },
      { label: "Referrals", value: "38", delta: "+4 this week" },
      { label: "Badges", value: "12", delta: "2 new" },
      { label: "Next Reward", value: "VIP Soundcheck", delta: "Unlocks at 15k" },
    ],
    journeyCards: [
      { title: "Complete backstage challenge", points: "+250 pts" },
      { title: "Share your listening story", points: "+150 pts" },
      { title: "Vote in today’s poll", points: "+75 pts" },
    ],
    events: [
      { title: "Austin Listening Party", detail: "RSVP closes in 12h", date: "Apr 02" },
      { title: "NYC Soundcheck", detail: "VIP access only", date: "Apr 07" },
    ],
    offers: [
      { title: "Signed Vinyl + Poster", tier: "Gold Exclusive", points: "4,500 pts" },
      { title: "Backstage Experience", tier: "Platinum Drop", points: "10,000 pts" },
      { title: "Limited Hoodie", tier: "Silver Priority", points: "3,200 pts" },
    ],
    quickActions: [
      "Share referral link",
      "Complete daily check-in",
      "Submit fan moment",
      "Vote in poll",
    ],
    tiers: [
      { label: "Bronze", status: "Complete", icon: "🥉" },
      { label: "Silver", status: "68%", icon: "🥈" },
      { label: "Gold", status: "Locked", icon: "🥇" },
      { label: "Platinum", status: "Locked", icon: "👑" },
    ],
    mobileNote: "Mobile view mirrors the preview with stacked cards and a persistent CTA.",
  },
  default: {
    slug: "fan-home",
    heroLabel: "Fan Momentum · Preview",
    heroTitle: "Fan Engage · Fan Home Preview",
    heroSubtitle:
      "Track fan streaks, tier progress, and the next listening rooms, drops, and challenge rewards.",
    heroBadge: "Preview state: some actions are wired as demos",
    supportNote:
      "This is a preview of the live dashboard. Support, contact, privacy, and terms belong in the footer so fans can get help without hunting for it.",
    kpis: [
      { label: "Total Points", value: "9,215", delta: "+142 today" },
      { label: "Referrals", value: "21", delta: "+2 this week" },
      { label: "Badges", value: "7", delta: "+1 new" },
      { label: "Next Reward", value: "VIP Soundcheck", delta: "Unlocks at 12k" },
    ],
    journeyCards: [
      { title: "Complete creator challenge", points: "+180 pts" },
      { title: "Boost favorite track", points: "+120 pts" },
      { title: "Drop a tour memory", points: "+90 pts" },
    ],
    events: [
      { title: "LA Listening Room", detail: "RSVP closes in 8h", date: "Apr 04" },
      { title: "VIP Soundcheck", detail: "Gold+ tier", date: "Apr 09" },
    ],
    offers: [
      { title: "Signed Set List", tier: "Gold Exclusive", points: "3,800 pts" },
      { title: "Backstage Hang", tier: "Platinum Drop", points: "9,500 pts" },
      { title: "Crew Hoodie", tier: "Silver Priority", points: "2,900 pts" },
    ],
    quickActions: [
      "Share referral link",
      "Record daily check-in",
      "Submit fan moment",
      "Vote in poll",
    ],
    tiers: [
      { label: "Bronze", status: "Complete", icon: "🥉" },
      { label: "Silver", status: "54%", icon: "🥈" },
      { label: "Gold", status: "Locked", icon: "🥇" },
      { label: "Platinum", status: "Locked", icon: "👑" },
    ],
    mobileNote: "Mobile cards collapse into a stacked preview with the CTA always in view.",
  },
};
