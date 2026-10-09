// 背景音樂：從 assets/audio/manifest.json 的 bgm 清單隨機挑一首，不分寧靜或地獄模式
// 開啟時先嘗試自動播放；瀏覽器擋下時（多數手機與 iPhone 一定會擋），改在第一次點畫面時開始。
// 同一首循環播放；切換模式時才隨機換曲
// 播白噪音時暫停，白噪音停了再接著播
import { SAFE_FILE } from './audio.js';
import { engine } from './audio-ui.js';
import { getSettings, saveSettings } from './storage.js';

const BGM_VOLUME = 0.4;

export function sanitizeBgm(json) {
  const list = Array.isArray(json?.bgm) ? json.bgm : [];
  return [...new Set(list.filter((f) => typeof f === 'string' && SAFE_FILE.test(f)))].slice(0, 20);
}

// 隨機挑一首；有兩首以上時避免連續播同一首
export function pickRandom(list, current, rand = Math.random) {
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter((f) => f !== current) : list;
  return pool[Math.floor(rand() * pool.length)];
}

export function initBgm() {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.loop = true;
  audio.volume = BGM_VOLUME;
  let files = [];
  let current = null;

  const enabled = () => getSettings().audio.bgmEnabled;

  function sync() {
    if (!current) current = pickRandom(files, null);
    if (!enabled() || engine.playing || !current) { audio.pause(); return; }
    const src = new URL(`assets/audio/${current}`, location.href).href;
    if (audio.src !== src) audio.src = src;
    if (audio.paused) audio.play().catch(() => {}); // 被擋下就等下一次點擊
  }

  function next() {
    current = pickRandom(files, current);
    sync();
  }

  // 每次點擊都檢查一次：若還沒在播，就在點擊當下補播（iPhone 只在點擊時允許開始播放）
  const onGesture = () => sync();
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);

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

  fetch('assets/audio/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((json) => { files = sanitizeBgm(json); sync(); })
    .catch(() => {});
}
