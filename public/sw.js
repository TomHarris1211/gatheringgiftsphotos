// Minimal pass-through service worker.
// Its only job is to make the app installable on Android — it does not
// cache anything, so users always get the latest version from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
