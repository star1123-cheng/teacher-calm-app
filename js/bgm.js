// 背景音樂：從 assets/audio/manifest.json 的 bgm 清單隨機挑一首，不分寧靜或地獄模式
// 開場動畫期間先把整首下載進記憶體，動畫結束才開始播：播放時不再依賴網路，第一次開啟也不會卡
// 開場結束時先嘗試自動播放；瀏覽器擋下時（多數手機與 iPhone 一定會擋），改在第一次點畫面時開始
// 同一首循環播放；切換模式時才隨機換曲；播白噪音時暫停，白噪音停了再接著播
import { SAFE_FILE } from './audio.js';
import { engine } from './audio-ui.js';
import { getSettings, saveSettings } from './storage.js';

const BGM_VOLUME = 0.4;

export function sanitizeBgm(json) {
  const list = Array.isArray(json?.bgm) ? json.bgm : [];
  return [...new Set(list.filter((f) => typeof f === 'string' && SAFE_FILE.test(f)))].slice(0, 20);
}

// 隨機挑曲；有兩首以上時避免連續播同一首
export function pickRandom(list, current, rand = Math.random) {
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter((f) => f !== current) : list;
  return pool[Math.floor(rand() * pool.length)];
}

// 0.1 秒無聲 WAV，用來在點擊當下「解鎖」播放器（iPhone 規定）
function silentWav() {
  const n = 800;
  const buf = new DataView(new ArrayBuffer(44 + n));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) buf.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); buf.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, 8000, true); buf.setUint32(28, 8000, true); buf.setUint16(32, 1, true); buf.setUint16(34, 8, true);
  str(36, 'data'); buf.setUint32(40, n, true);
  for (let i = 0; i < n; i++) buf.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// 回傳 { ready }：目前這首下載完成（或確定不用播）時 resolve，給開場動畫等待
export function initBgm() {
  const audio = new Audio();
  audio.loop = true;
  audio.volume = BGM_VOLUME;
  let files = [];
  let current = null;
  let started = !document.getElementById('splash'); // 開場動畫結束後才開始播
  let unlocked = false;
  const loading = new Map(); // 檔名 → Promise<blob 網址>
  const ready = new Map(); // 檔名 → 已下載好的 blob 網址

  const enabled = () => getSettings().audio.bgmEnabled;

  function load(file) {
    if (!loading.has(file)) {
      const p = fetch(`assets/audio/${file}`)
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.blob(); })
        .then((b) => { const url = URL.createObjectURL(b); ready.set(file, url); return url; });
      p.catch(() => loading.delete(file));
      loading.set(file, p);
    }
    return loading.get(file);
  }

  // 已下載好就同步執行，點擊當下呼叫時才算是使用者觸發的播放
  function sync() {
    if (!current) current = pickRandom(files, null);
    if (!started || !enabled() || engine.playing || !current) { audio.pause(); return; }
    const url = ready.get(current);
    if (!url) { load(current).then(sync, () => {}); return; } // 還沒下載好：舊的那首先繼續播
    if (audio.src !== url) audio.src = url;
    if (audio.paused) audio.play().catch(() => {}); // 被擋下就等下一次點擊
  }

  function next() {
    current = pickRandom(files, current);
    sync();
  }

  // 第一次點擊：若音樂還沒準備好，先播一小段無聲音訊，讓這個播放器之後可以自己開始播
  const onGesture = () => {
    if (!unlocked) {
      unlocked = true;
      if (!audio.src) {
        const silent = silentWav();
        audio.src = silent;
        audio.play().then(() => { if (audio.src === silent) audio.pause(); }).catch(() => {});
      }
    }
    sync();
  };
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);
  document.addEventListener('tcalm:splash-done', () => { started = true; sync(); });

  // 切換模式就隨機換曲；白噪音開始或停止時暫停或恢復
  new MutationObserver(next).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  document.addEventListener('tcalm:noise', sync);

  const toggle = document.getElementById('bgm-enabled');
  if (toggle) {
    toggle.checked = enabled();
    toggle.addEventListener('change', () => {
      const s = getSettings();
      s.audio = { ...s.audio, bgmEnabled: toggle.checked };
      saveSettings(s);
      sync();
    });
  }

  const first = fetch('assets/audio/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then(async (json) => {
      files = sanitizeBgm(json);
      current = pickRandom(files, null);
      if (!current || !enabled()) return;
      await load(current);
      // 第一首好了之後，其他曲目在背景下載，之後切換模式時不用等
      for (const f of files) load(f).catch(() => {});
    })
    .catch(() => {});
  return { ready: first };
}
