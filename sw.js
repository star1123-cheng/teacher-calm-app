// Service worker：快取所有靜態檔，斷網可完整使用。
// 修改任何檔案後請把 VERSION 加 1，讓使用者裝置更新快取。
const VERSION = 'tcalm-v21';
// 音檔另外放一個快取，改版時不會被清掉（名稱要和 js/audio.js 的 AUDIO_CACHE 一致）
// 音檔內容要更換時請改檔名，舊檔會在下次開啟時自動從快取刪除
const AUDIO_CACHE = 'tcalm-audio-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/splash.css',
  './css/base.css',
  './css/burn.css',
  './assets/fonts/brush-subset.woff2',
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
  './js/splash.js',
  './js/egg.js',
  './js/mode.js',
  './js/burn.js',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== AUDIO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isAudio = (url) => url.pathname.includes('/assets/audio/') && url.pathname.endsWith('.mp3');

// 播放器會「分段」要音檔（Range 請求），必須回 206 和對應的那一段，iPhone 才播得出來
async function sliceRange(res, range) {
  const blob = await res.blob();
  const size = blob.size;
  const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(blob, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
  }
  let start;
  let end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; } // bytes=-500：最後 500 bytes
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  });
}

// 音檔：快取有就從快取切段回應；沒有就直接交給網路串流（存進快取由 js/audio.js 在背景處理）
async function audioResponse(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req.url, { ignoreSearch: true });
  if (cached) return sliceRange(cached, req.headers.get('range'));
  try {
    return await fetch(req);
  } catch {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

// 其他檔案：先用快取立即回應，同時在背景向網路更新（stale-while-revalidate）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (isAudio(url)) { e.respondWith(audioResponse(req)); return; }
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
