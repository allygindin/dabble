// Offline support: keeps a copy of every file the game needs, so it runs from
// the home screen with no network. Online, files are always fetched fresh, so
// updates show up on their own. Add any new file to FILES.
const VERSION = 'dabble-v1';
const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/registry.js',
  'artworks/flower.js',
  'artworks/landscape.js',
  'artworks/reef.js',
  'artworks/harbor.js',
  'artworks/balloons.js',
  'artworks/mandala.js',
  'js/shapes.js',
  'js/store.js',
  'js/ui.js',
  'js/labels.js',
  'js/sound.js',
  'js/panzoom.js',
  'js/celebrate.js',
  'js/game.js',
  'js/gallery.js',
  'js/myart.js',
  'js/db.js',
  'js/convert.js',
  'js/convert-worker.js',
  'js/upload.js',
  'js/app.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache, so a new version never mixes in stale files.
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Online: use the latest file and refresh the saved copy. Offline, or the
  // network is slow (3 s): use the saved copy.
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const net = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    });
    net.catch(() => {}); // offline is expected; don't log it as an error
    const slow = new Promise((r) => setTimeout(r, 3000));
    const res = await Promise.race([net.catch(() => null), slow]);
    if (res) return res;
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && await c.match('index.html'));
    return hit || net; // nothing saved: keep waiting for the network
  }));
});
