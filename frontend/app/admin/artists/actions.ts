"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Forbidden");
  return admin;
}

export async function createArtistAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
  const name = String(formData.get("name") ?? "").trim();
  if (!slug || !name) return;
  const supa = createAdminClient();
  await supa.from("artists").insert({ slug, name, sort_order: 99 });
  revalidatePath("/admin/artists");
  redirect(`/admin/artists/${slug}`);
}

export async function updateArtistAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;

  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const heroImage = String(formData.get("hero_image") ?? "").trim();
  const accentFrom = String(formData.get("accent_from") ?? "#7c3aed").trim();
  const accentTo = String(formData.get("accent_to") ?? "#f97316").trim();
  const genresRaw = String(formData.get("genres") ?? "").trim();
  const socialRaw = String(formData.get("social") ?? "").trim();
  const active = String(formData.get("active") ?? "true") === "true";
  const sortOrder = parseInt(String(formData.get("sort_order") ?? "99"), 10);

  const genres = genresRaw
    ? genresRaw
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];

  // Social is two parallel text areas in the form: one per "label|href" line.
  const social = socialRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: (label ?? "").trim(), href: rest.join("|").trim() };
    })
    .filter((s) => s.label && s.href);

  const supa = createAdminClient();
  await supa
    .from("artists")
    .update({
      name,
      tagline: tagline || null,
      bio: bio || null,
      hero_image: heroImage || null,
      accent_from: accentFrom,
      accent_to: accentTo,
      genres,
      social,
      active,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 99,
    })
    .eq("slug", slug);

  revalidatePath("/admin/artists");
  revalidatePath(`/admin/artists/${slug}`);
  revalidatePath(`/artists/${slug}`);
  revalidatePath(`/artists`);
}

export async function createEventAction(formData: FormData) {
  await requireAdmin();
  const artistSlug = String(formData.get("artist_slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!artistSlug || !title) return;
  const detail = String(formData.get("detail") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const sortOrder = parseInt(String(formData.get("sort_order") ?? "0"), 10) || 0;

  const supa = createAdminClient();
  await supa.from("artist_events").insert({
    artist_slug: artistSlug,
    title,
    detail: detail || null,
    event_date: eventDate || null,
    url: url || null,
    sort_order: sortOrder,
  });
  revalidatePath(`/admin/artists/${artistSlug}`);
  revalidatePath(`/artists/${artistSlug}`);
}

export async function deleteEventAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("event_id") ?? "");
  const artistSlug = String(formData.get("artist_slug") ?? "");
  if (!id) return;
  const supa = createAdminClient();
  await supa.from("artist_events").delete().eq("id", id);
  revalidatePath(`/admin/artists/${artistSlug}`);
  revalidatePath(`/artists/${artistSlug}`);
}
