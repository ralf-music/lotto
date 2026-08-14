const VERSION = "1.4.0";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  // Lotto Zentrale intentionally remains online-first/network-only.
  // Current draws, jackpots and statistics must not silently fall back
  // to stale cached data.
  event.respondWith(fetch(event.request));
});
