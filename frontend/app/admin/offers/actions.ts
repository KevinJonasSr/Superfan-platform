"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";
import type { OfferCategory, TierSlug } from "@/lib/data/types";

const CATEGORIES: OfferCategory[] = ["merch", "experience", "collectible", "digital", "ticket"];
const TIERS: TierSlug[] = ["bronze", "silver", "gold", "platinum"];

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?next=/admin");
  return admin;
}

export async function createOfferAction(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "merch");
  const minTierRaw = String(formData.get("min_tier") ?? "bronze");
  const pricePointsRaw = formData.get("price_points");
  const inventoryRaw = formData.get("inventory");

  if (!title || !slug) return;

  const category = (CATEGORIES.includes(categoryRaw as OfferCategory)
    ? categoryRaw
    : "merch") as OfferCategory;
  const min_tier = (TIERS.includes(minTierRaw as TierSlug)
    ? minTierRaw
    : "bronze") as TierSlug;

  const admin = createAdminClient();
  await admin.from("offers").insert({
    title,
    slug,
    description: description || null,
    category,
    min_tier,
    price_points: pricePointsRaw ? Number(pricePointsRaw) : null,
    inventory: inventoryRaw ? Number(inventoryRaw) : null,
    active: true,
  });

  revalidatePath("/admin/offers");
  revalidatePath("/marketplace");
  revalidatePath("/");
}

export async function toggleOfferActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("offers").update({ active }).eq("id", id);

  revalidatePath("/admin/offers");
  revalidatePath("/marketplace");
  revalidatePath("/");
}
