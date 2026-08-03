// Offline service worker for the Seattle -> Banff itinerary.
// Strategy: stale-while-revalidate. The page loads instantly from cache (and
// works fully offline), and every online visit quietly re-fetches in the
// background and updates the cache — so edits you push reach travelers on their
// next online open WITHOUT any version bump here.
const CACHE = 'banff-trip-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only manage our own files; let the external map/trail links hit the network normally.
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        // Kick off a background refresh regardless of a cache hit.
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);           // offline: fall back to whatever we have
        // Serve cache immediately if we have it; otherwise wait for the network.
        return cached || network;
      })
    )
  );
});
