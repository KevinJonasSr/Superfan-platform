import { createAdminClient } from "@/lib/supabase/admin";

export type ApplicationStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "waitlisted";

export interface ArtistApplication {
  id: string;
  status: ApplicationStatus;
  display_name: string;
  slug_suggestion: string | null;
  tagline: string | null;
  bio: string | null;
  hero_image: string | null;
  social: { label: string; href: string }[];
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  genres: string[] | null;
  manager_name: string | null;
  manager_email: string | null;
  distribution: string | null;
  monthly_listeners: number | null;
  upcoming_tour: string | null;
  founder_tier_interest: boolean | null;
  expected_launch_date: string | null;
  referral_source: string | null;
  community_pitch: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_slug: string | null;
  approved_artist_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listApplications(): Promise<ArtistApplication[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ArtistApplication[];
  } catch {
    return [];
  }
}

export async function getApplication(
  id: string,
): Promise<ArtistApplication | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ArtistApplication | null) ?? null;
  } catch {
    return null;
  }
}
