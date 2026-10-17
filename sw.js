// MapGame service worker — cache-first app shell so the game works in
// road-trip dead zones. Bump CACHE whenever shipped files change, otherwise
// phones keep serving the old version.

const CACHE = 'mapgame-v4';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './store.js',
  './facts.js',
  './manifest.json',
  './maps/us.svg',
  './maps/ca.svg',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        // Cache successful same-origin responses for next time.
        if (res.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => {
        // Offline and not cached: fall back to the app shell for navigations.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    })
  );
});
