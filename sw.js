// Service worker：快取所有靜態檔，斷網可完整使用。
// 修改任何檔案後請把 VERSION 加 1，讓使用者裝置更新快取。
const VERSION = 'tcalm-v16';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './js/app.js',
  './js/sheet.js',
  './js/theme.js',
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
  './js/bgm.js',
  './js/egg.js',
  './js/mode.js',
  './js/hell.js',
  './js/hell-data.js',
  './js/salary.js',
  './js/salary-ui.js',
  './js/soup.js',
  './seed/toxic-soup.csv',
  './seed/salary-table.json',
  './assets/audio/manifest.json',
  './seed/daily-quotes.csv',
  './seed/quotes-template.csv',
  './assets/icons/icon-32.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/img/calm-bg-mobile-day.webp',
  './assets/img/calm-bg-mobile-night.webp',
  './assets/img/calm-bg-desktop-day.webp',
  './assets/img/calm-bg-desktop-night.webp',
  './assets/img/hell-bg-mobile.webp',
  './assets/img/hell-bg-desktop.webp',
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
  if (req.headers.has('range')) { e.respondWith(rangeResponse(req, e)); return; }
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

// 背景音樂用 <audio> 播放，瀏覽器會分段（Range）讀取；iPhone 一定要收到 206 分段回應才肯播。
// 還沒快取時直接交給網路串流（邊下載邊播，不用等整檔），同時在背景下載整檔存進快取；
// 之後從快取切出要的那一段，離線也能播。整檔只讀進記憶體一次，避免每段都重讀造成卡頓。
const audioBuffers = new Map(); // url → Promise<{ buf, type }>
const downloading = new Map(); // url → Promise

function cacheInBackground(url) {
  if (downloading.has(url)) return downloading.get(url);
  const p = (async () => {
    const res = await fetch(url);
    if (res.ok && res.status === 200) await (await caches.open(VERSION)).put(url, res);
  })().catch(() => {}).finally(() => downloading.delete(url));
  downloading.set(url, p);
  return p;
}

function loadBuffer(url, res) {
  if (!audioBuffers.has(url)) {
    const p = res.arrayBuffer().then((buf) => ({ buf, type: res.headers.get('Content-Type') || 'audio/mpeg' }));
    p.catch(() => audioBuffers.delete(url));
    audioBuffers.set(url, p);
  }
  return audioBuffers.get(url);
}

async function rangeResponse(req, e) {
  const url = new URL(req.url);
  url.search = '';
  const key = url.href;
  const cache = await caches.open(VERSION);
  const res = audioBuffers.has(key) ? null : await cache.match(key);
  if (!audioBuffers.has(key) && !res) {
    e.waitUntil(cacheInBackground(key));
    try {
      return await fetch(req);
    } catch {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  }
  const { buf, type } = await loadBuffer(key, res);
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = 0;
  let end = size - 1;
  if (m && m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(Number(m[2]), size - 1); }
  else if (m && m[2]) start = Math.max(0, size - Number(m[2]));
  if (start >= size) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
