import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes a signed-in user must be able to reach.
 * Everything else under /app that's not here or public is open.
 */
const PROTECTED_PREFIXES = ["/rewards", "/marketplace", "/referrals"] as const;

/**
 * Refreshes the Supabase session on every request and redirects unauthenticated
 * users away from protected routes to /login.
 *
 * If Supabase env vars aren't set yet (e.g. on a PR preview before keys are
 * wired) the middleware becomes a no-op instead of crashing the whole app —
 * so previews of non-protected routes still work end-to-end.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets / image optimization / favicon.
    "/((?!_next/static|_next/image|favicon.ico|api/fan-engage).*)",
  ],
};
