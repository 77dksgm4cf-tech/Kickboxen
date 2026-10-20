// Nur wirksam, wenn die App über http(s):// geladen wird. Netzwerk-first:
// immer die aktuelle Version vom Server holen, der Cache dient nur als
// Fallback, wenn kein Netz verfügbar ist (Offline-Nutzung).
const CACHE_NAME = 'kickbox-online-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './store.js',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/techniques.json',
  './data/trainingsplan-kind.json',
  './data/trainingsplan-erwachsener.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
