// Ticket pages open with no signal once they've been opened once. Network first so a
// revoked or used ticket is shown correctly whenever a connection exists.
const CACHE = "y2k-tickets-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isTicket = url.origin === location.origin && url.pathname.startsWith("/t/");
  const isStatic = url.origin === location.origin && url.pathname.startsWith("/_next/static/");
  if (req.method !== "GET" || !(isTicket || isStatic)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error("offline and not cached");
      }
    })(),
  );
});
