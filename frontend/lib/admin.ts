import { createClient } from "@/lib/supabase/server";

/**
 * Returns the current user if they are in the ADMIN_EMAILS allowlist.
 * Returns null otherwise. Case-insensitive match.
 */
export async function getAdminUser() {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    if (!allowlist.includes(user.email.toLowerCase())) return null;
    return user;
  } catch {
    return null;
  }
}
