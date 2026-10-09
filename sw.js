// Service worker: a játék offline is fut, és a kezdőképernyőre telepíthető.
// Frissítéskor a VERSION-t érdemes növelni; a fájlokat a háttérben is frissíti
// (stale-while-revalidate), így a következő indításkor már az új verzió fut.
const VERSION = 'b5dts-v1';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/i18n.js', 'js/data.js', 'js/audio.js', 'js/render.js', 'js/game.js', 'js/ui.js', 'js/main.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
