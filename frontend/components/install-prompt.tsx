"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Tasteful "Install Fan Engage" prompt that appears after a fan engages for
 * a bit (not immediately on first visit). Registers the service worker and
 * listens for the browser's `beforeinstallprompt` event so we can offer our
 * own button instead of relying on the browser's mini-infobar.
 *
 * Works on Chromium browsers and Android Chrome. iOS Safari has no
 * programmatic install event — we show a text tip there instead.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "fanengage_install_dismissed";

// External-store reader so we can short-circuit without a setState-in-effect.
function subscribe() { return () => {}; }
function getSnapshot(): string | null {
  try { return window.localStorage.getItem(DISMISSED_KEY); } catch { return null; }
}
function getServerSnapshot(): string | null { return null; }

export default function InstallPrompt() {
  const storedDismissal = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const dismissed = storedDismissal !== null || sessionDismissed;

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // Read userAgent via a store so we can use it in render without
  // triggering setState-in-effect lint.
  const ua = useSyncExternalStore(
    () => () => {},
    () => (typeof window !== "undefined" ? window.navigator.userAgent : ""),
    () => "",
  );
  const isIos = /iPad|iPhone|iPod/.test(ua);

  useEffect(() => {
    if (dismissed) return;

    // Register SW — ignored on http: (localhost works because it's treated
    // as secure).
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* don't crash — SW is optional */
      });
    }

    // Already installed? standalone display-mode detection.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 15000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS has no install event — surface the tip after 20s.
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (isIos) {
      iosTimer = setTimeout(() => setShow(true), 20000);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [dismissed, isIos]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        DISMISSED_KEY,
        JSON.stringify({ at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setSessionDismissed(true);
    setShow(false);
  }

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      dismiss();
    }
  }

  if (dismissed || !show) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-xl backdrop-blur md:inset-x-auto md:right-4 md:max-w-sm">
      <p className="text-sm font-semibold">Install Fan Engage</p>
      {isIos ? (
        <p className="mt-1 text-xs text-white/70">
          Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span> to install.
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/70">
          Add Fan Engage to your home screen for quick access to your artists, events, and rewards.
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={dismiss}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Not now
        </button>
        {!isIos && deferred && (
          <button
            onClick={handleInstall}
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-3 py-1 text-xs font-semibold text-white"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
