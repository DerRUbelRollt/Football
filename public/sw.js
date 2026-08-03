// Minimal service worker: satisfies PWA installability criteria (Chrome/Android)
// without caching or intercepting any requests. Content stays fully live —
// safe for the app's authenticated/personalized routes.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No respondWith(): every request falls through to normal network handling.
});
