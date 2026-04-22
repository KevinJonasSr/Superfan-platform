export type Artist = {
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  heroImage: string | null; // fill when Box assets land
  accentFrom: string; // CSS color literal (e.g. "#f43f5e")
  accentTo: string; // CSS color literal (e.g. "#fbbf24")
  genres: string[];
  upcoming: {
    /** DB-backed event id. Optional for legacy hardcoded fallback entries. */
    id?: string;
    title: string;
    detail: string;
    date: string;
    capacity?: number | null;
    location?: string | null;
    url?: string | null;
  }[];
  merch: { title: string; tier: string; points: string }[];
  social: { label: string; href: string }[];
};

// Placeholder content for each artist — swap when Box assets are delivered.
// Keep keys stable; marketing can paste final copy here without touching layout.
export const ARTISTS: Record<string, Artist> = {
  raelynn: {
    slug: "raelynn",
    name: "RaeLynn",
    tagline: "Country, heart-first.",
    bio: "Placeholder bio — awaiting final copy from marketing.",
    heroImage: null,
    accentFrom: "#f43f5e",
    accentTo: "#fbbf24",
    genres: ["Country", "Americana"],
    upcoming: [
      { title: "Nashville Listening Party", detail: "Fan Engage members only", date: "Coming soon" },
    ],
    merch: [
      { title: "Signed Vinyl Variant", tier: "Silver Priority", points: "3,200 pts" },
      { title: "Tour Hoodie", tier: "Bronze+", points: "2,400 pts" },
    ],
    social: [{ label: "Instagram", href: "https://instagram.com/raelynn" }],
  },
  bailee: {
    slug: "bailee",
    name: "Bailee",
    tagline: "Rising voice, no ceiling.",
    bio: "Placeholder bio — awaiting assets from Box drop.",
    heroImage: null,
    accentFrom: "#8b5cf6",
    accentTo: "#e879f9",
    genres: ["Pop"],
    upcoming: [{ title: "TBD", detail: "Dates to come", date: "—" }],
    merch: [{ title: "Debut EP Bundle", tier: "Bronze+", points: "1,800 pts" }],
    social: [],
  },
  blake: {
    slug: "blake",
    name: "Blake",
    tagline: "Studio-raw, stadium-ready.",
    bio: "Placeholder bio — awaiting assets from Box drop.",
    heroImage: null,
    accentFrom: "#0ea5e9",
    accentTo: "#34d399",
    genres: ["Country", "Rock"],
    upcoming: [{ title: "TBD", detail: "Dates to come", date: "—" }],
    merch: [{ title: "Tour Poster Set", tier: "Bronze+", points: "1,200 pts" }],
    social: [],
  },
  konnor: {
    slug: "konnor",
    name: "Konnor",
    tagline: "New-school songwriting.",
    bio: "Placeholder bio — awaiting assets from Box drop.",
    heroImage: null,
    accentFrom: "#f59e0b",
    accentTo: "#fb923c",
    genres: ["Pop", "Indie"],
    upcoming: [{ title: "TBD", detail: "Dates to come", date: "—" }],
    merch: [{ title: "Signed Lyric Print", tier: "Silver+", points: "2,800 pts" }],
    social: [],
  },
  dan: {
    slug: "dan",
    name: "Dan",
    tagline: "Heartland heart, modern punch.",
    bio: "Placeholder bio — awaiting assets from Box drop.",
    heroImage: null,
    accentFrom: "#64748b",
    accentTo: "#60a5fa",
    genres: ["Country"],
    upcoming: [{ title: "TBD", detail: "Dates to come", date: "—" }],
    merch: [{ title: "Tour Tee", tier: "Bronze+", points: "1,400 pts" }],
    social: [],
  },
};

export function getArtist(slug: string): Artist | null {
  return ARTISTS[slug.toLowerCase()] ?? null;
}

export function listArtists(): Artist[] {
  return Object.values(ARTISTS);
}
