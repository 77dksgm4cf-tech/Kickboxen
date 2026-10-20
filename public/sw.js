// Nur wirksam, wenn die App über http(s):// geladen wird (z.B. künftige Server-Lösung).
// Über file:// registriert der Browser Service Worker gar nicht erst - die App
// funktioniert dort trotzdem normal, nur ohne diesen Offline-Cache.
const CACHE_NAME = 'kickbox-online-v1';
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
