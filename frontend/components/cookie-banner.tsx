"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";

const STORAGE_KEY = "fanengage_cookie_consent";

// Read-only external store: any tab can dismiss via the button below; we
// return the stored string (or null) and let the component decide what to
// show. A no-op subscribe suffices — this is a once-per-mount read.
function subscribe() {
  return () => {};
}
function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function getServerSnapshot(): string | null {
  return null;
}

export default function CookieBanner() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const shown = stored === null && !dismissed;

  function save(choice: "accept" | "decline") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!shown) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-xl backdrop-blur md:inset-x-auto md:right-4 md:max-w-sm">
      <p className="text-sm text-white/90">
        Fan Engage uses cookies for sign-in and basic platform features. See our{" "}
        <Link href="/cookie-policy" className="text-aurora underline">
          Cookie Policy
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-aurora underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={() => save("decline")}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Decline
        </button>
        <button
          onClick={() => save("accept")}
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-3 py-1 text-xs font-semibold text-white"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
