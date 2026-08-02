// Offline service worker for the Seattle -> Banff itinerary.
// The page is a single self-contained HTML file, so caching that document
// makes the whole itinerary work offline once it has loaded once online.
const CACHE = 'banff-trip-v1';
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
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;                 // cache-first: instant + offline
      return fetch(req)
        .then((res) => {
          // opportunistically cache same-origin responses as they load
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // offline and not cached: for a page navigation, fall back to the itinerary
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
