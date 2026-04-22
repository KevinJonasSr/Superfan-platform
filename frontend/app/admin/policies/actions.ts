"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Forbidden");
  return admin;
}

export async function updatePolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;

  const title = String(formData.get("title") ?? "").trim();
  const contentMd = String(formData.get("content_md") ?? "");
  const effectiveDateRaw = String(formData.get("effective_date") ?? "").trim();
  const isDraft = String(formData.get("is_draft") ?? "false") === "true";

  const supa = createAdminClient();
  await supa
    .from("policy_pages")
    .update({
      title,
      content_md: contentMd,
      effective_date: effectiveDateRaw || null,
      is_draft: isDraft,
      updated_by: admin.id,
    })
    .eq("slug", slug);

  revalidatePath("/admin/policies");
  revalidatePath(`/admin/policies/${slug}`);
  revalidatePath(`/${slug === "cookie_policy" ? "cookie-policy" : slug}`);
}
