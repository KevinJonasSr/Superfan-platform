"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getAdminContext,
  ACTIVE_ADMIN_COMMUNITY_COOKIE,
} from "@/lib/admin";

/**
 * Server action fired by the switcher cards. Sets the active-community
 * cookie after verifying the caller actually has admin rights in that
 * community — super-admins can pick any; single-community admins are
 * locked to their own.
 */
export async function setActiveCommunityAction(formData: FormData) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin/communities");

  const target = String(formData.get("community_id") ?? "").trim();
  if (!target) return;

  const allowed =
    ctx.isSuperAdmin || ctx.communities.includes(target);
  if (!allowed) return;

  const jar = await cookies();
  jar.set(ACTIVE_ADMIN_COMMUNITY_COOKIE, target, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // 30 days — long enough that admins don't re-pick every day; short
    // enough that a revoked super-admin eventually loses context.
    maxAge: 60 * 60 * 24 * 30,
    path: "/admin",
  });

  revalidatePath("/admin", "layout");
  redirect("/admin");
}
