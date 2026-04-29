"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function submitArtistApplicationAction(
  formData: FormData,
): Promise<void> {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : null;
  };
  const getBool = (k: string) => formData.get(k) === "on";
  const getInt = (k: string) => {
    const v = get(k);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const display_name = get("display_name");
  const contact_name = get("contact_name");
  const contact_email = get("contact_email");
  if (!display_name || !contact_name || !contact_email) {
    redirect("/for-artists/apply?error=missing-required");
  }

  // Genres: form posts one input per chip checked, named genre_<value>.
  const genres: string[] = [];
  for (const key of formData.keys()) {
    if (key.startsWith("genre_") && formData.get(key) === "on") {
      genres.push(key.slice("genre_".length));
    }
  }

  // Social: build from individual inputs.
  const socialPairs: { label: string; href: string }[] = [];
  for (const platform of [
    "Instagram",
    "TikTok",
    "Spotify",
    "Apple Music",
    "YouTube",
    "X",
    "Facebook",
  ]) {
    const key = `social_${platform.toLowerCase().replace(/\s+/g, "")}`;
    const href = get(key);
    if (href) socialPairs.push({ label: platform, href });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("applications").insert({
    display_name,
    slug_suggestion: get("slug_suggestion"),
    tagline: get("tagline"),
    bio: get("bio"),
    hero_image: get("hero_image"),
    social: socialPairs,
    contact_name,
    contact_email,
    contact_phone: get("contact_phone"),
    genres: genres.length > 0 ? genres : null,
    manager_name: get("manager_name"),
    manager_email: get("manager_email"),
    distribution: get("distribution"),
    monthly_listeners: getInt("monthly_listeners"),
    upcoming_tour: get("upcoming_tour"),
    founder_tier_interest: getBool("founder_tier_interest"),
    expected_launch_date: get("expected_launch_date"),
    referral_source: get("referral_source"),
    community_pitch: get("community_pitch"),
  });

  if (error) {
    console.error("submitArtistApplicationAction error:", error);
    redirect("/for-artists/apply?error=submit-failed");
  }

  redirect("/for-artists/apply/thanks");
}
