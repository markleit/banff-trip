// Offline service worker for the Seattle -> Banff itinerary.
// Strategy: network-first (with a short timeout), falling back to cache.
// Online with decent signal  -> always the latest (edits show on the first open).
// Offline OR crawling signal  -> the cached copy, so the page never hangs or blanks.
const CACHE = 'banff-trip-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];
const NET_TIMEOUT = 3000;

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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    // Fetch fresh and update the cache in the background.
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });

    if (cached) {
      // Network-first, but don't let a slow/spotty connection stall the page:
      // take the network if it answers within NET_TIMEOUT, else serve cache.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT));
      const winner = await Promise.race([network.catch(() => null), timeout]);
      return winner || cached;
    }

    // Nothing cached yet — wait for the network; if it fails, fall back to the itinerary.
    try {
      return await network;
    } catch (_) {
      return (req.mode === 'navigate') ? cache.match('./index.html') : Response.error();
    }
  })());
});
