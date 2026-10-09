// Service worker：快取所有靜態檔，斷網可完整使用。
// 修改任何檔案後請把 VERSION 加 1，讓使用者裝置更新快取。
const VERSION = 'tcalm-v7';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './js/app.js',
  './js/router.js',
  './js/storage.js',
  './js/csv.js',
  './js/backup.js',
  './js/settings.js',
  './js/ui.js',
  './js/dates.js',
  './js/countdown.js',
  './js/rotation.js',
  './js/quote.js',
  './js/notes.js',
  './js/audio.js',
  './js/audio-ui.js',
  './js/egg.js',
  './js/mode.js',
  './js/hell.js',
  './js/hell-data.js',
  './js/salary.js',
  './js/salary-ui.js',
  './js/soup.js',
  './seed/hell-soup.csv',
  './seed/salary-table.json',
  './assets/audio/manifest.json',
  './seed/quotes-original.csv',
  './seed/quotes-template.csv',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 先用快取立即回應，同時在背景向網路更新（stale-while-revalidate）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    // 略過瀏覽器 HTTP 快取，確保背景更新拿到最新檔案
    const network = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then((res) => {
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return new Response('', { status: 504, statusText: 'offline' });
  })());
});
