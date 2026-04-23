import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCommunityId } from "@/lib/community";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Admin scoping (Phase 4c)
 *
 * Admin access is now table-driven via `admin_users (user_id, community_id,
 * role)`. The legacy `ADMIN_EMAILS` env allowlist stays as a transition
 * fallback so we don't lock ourselves out if admin_users is misconfigured.
 *
 * Super-admins have a row with `community_id = '*'` and can administer
 * every community. Single-community admins only see their own community.
 *
 * The "active community" for a super-admin is persisted in a cookie
 * (`fe_admin_community`) set by the switcher page at `/admin/communities`.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const ACTIVE_ADMIN_COMMUNITY_COOKIE = "fe_admin_community";

export interface AdminContext {
  /** Supabase auth user. */
  user: User;
  /** Community slugs this admin can access. Empty for super-admins (they
   *  can access everything — use `isSuperAdmin` to check instead). */
  communities: string[];
  /** True when the admin has a `community_id = '*'` row in admin_users. */
  isSuperAdmin: boolean;
  /** The community the admin is currently administering. For single-
   *  community admins this is always their one community. For super-
   *  admins it comes from the cookie; null if they haven't picked one. */
  currentCommunityId: string | null;
  /** Highest role the admin holds in the current context. */
  role: "owner" | "admin" | "editor" | "viewer" | null;
}

/**
 * Resolve the admin context for the current request. Returns null if the
 * signed-in user isn't an admin. Used by the admin layout and every admin
 * page / server action to gate access.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  let user: User | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return null;
  }
  if (!user?.email) return null;

  // First try the admin_users table (source of truth post-4a).
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("admin_users")
    .select("community_id, role")
    .eq("user_id", user.id);

  if (error) {
    console.warn("getAdminContext: admin_users lookup failed", error.message);
  }

  const grants = (rows ?? []) as Array<{ community_id: string; role: AdminContext["role"] }>;

  // Fallback: if admin_users is empty for this user but their email is in
  // the legacy ADMIN_EMAILS allowlist, grant a super-admin session.
  // Prevents lockout while admin_users seeding is in-flight.
  if (grants.length === 0) {
    const allowlist = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.includes(user.email.toLowerCase())) {
      grants.push({ community_id: "*", role: "owner" });
    } else {
      return null;
    }
  }

  const isSuperAdmin = grants.some((g) => g.community_id === "*");
  const communities = grants
    .map((g) => g.community_id)
    .filter((c) => c !== "*");

  // Resolve the active community:
  // - Super-admin → cookie (they can switch); may be null if not set yet
  // - Single-community admin → that one community
  // - Multi-community (non-super) admin → cookie; default to first grant
  let currentCommunityId: string | null = null;
  if (isSuperAdmin) {
    const jar = await cookies();
    currentCommunityId = jar.get(ACTIVE_ADMIN_COMMUNITY_COOKIE)?.value ?? null;
  } else if (communities.length === 1) {
    currentCommunityId = communities[0];
  } else if (communities.length > 1) {
    const jar = await cookies();
    currentCommunityId =
      jar.get(ACTIVE_ADMIN_COMMUNITY_COOKIE)?.value ?? communities[0];
  }

  // Pick highest role for current community (owner > admin > editor > viewer).
  const ROLE_WEIGHT: Record<string, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1,
  };
  const applicable = grants.filter(
    (g) =>
      g.community_id === currentCommunityId ||
      g.community_id === "*" ||
      currentCommunityId === null,
  );
  const role =
    applicable.length > 0
      ? applicable.sort(
          (a, b) =>
            (ROLE_WEIGHT[b.role ?? ""] ?? 0) -
            (ROLE_WEIGHT[a.role ?? ""] ?? 0),
        )[0].role
      : null;

  return {
    user,
    communities,
    isSuperAdmin,
    currentCommunityId,
    role,
  };
}

/**
 * Backward-compat shim for pages that still call getAdminUser(). Returns
 * the Supabase user if the caller has any admin grant; returns null
 * otherwise. New code should use getAdminContext() so it can scope queries.
 */
export async function getAdminUser(): Promise<User | null> {
  const ctx = await getAdminContext();
  return ctx?.user ?? null;
}

/**
 * Returns the community the admin is currently scoped to, falling back to
 * the hostname-resolved community if the admin context hasn't picked one
 * yet. Used by server actions to avoid accidentally writing to 'raelynn'
 * on a super-admin request made from a non-fanengage hostname.
 */
export async function getAdminCommunityId(): Promise<string> {
  const ctx = await getAdminContext();
  if (ctx?.currentCommunityId) return ctx.currentCommunityId;
  return getCurrentCommunityId();
}
