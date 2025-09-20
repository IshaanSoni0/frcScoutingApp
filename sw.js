const CACHE_NAME = 'frc-scout-v1';
// Use relative paths so the service worker works under a sub-path (e.g. GitHub Pages)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Cache core files on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Network-first: try the network, fall back to cache. This avoids serving
// stale/incorrect cached asset paths that don't match the deployed base path.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Optionally update the cache for navigation requests
        try {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        } catch (e) {
          // ignore cache update errors
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});