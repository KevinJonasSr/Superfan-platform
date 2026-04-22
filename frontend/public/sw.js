// Fan Engage — minimal service worker.
// Intentionally does NOT cache routes. Next.js already handles caching +
// static-asset delivery well, and a too-aggressive SW causes stale-HTML
// bugs that are hard to debug. We just register so "Add to Home Screen"
// works on iOS / Android and so we have a place to add push notifications
// later without another deploy.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough fetch — never intercept.
self.addEventListener("fetch", () => {
  // No-op; browser handles the request natively.
});
