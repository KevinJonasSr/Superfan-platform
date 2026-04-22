"use client";

import { useEffect } from "react";

/**
 * Writes the fanengage_ref cookie on mount. Has to be a client component
 * because Next.js only permits cookie mutation inside Server Actions and
 * Route Handlers — not page components.
 */
export default function SetRefCookie({ code }: { code: string }) {
  useEffect(() => {
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `fanengage_ref=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [code]);
  return null;
}
