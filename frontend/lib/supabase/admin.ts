import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. NEVER import this into client components or
 * expose the service role key. Only for server-side privileged ops (admin
 * surface, webhooks that need to bypass RLS).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
