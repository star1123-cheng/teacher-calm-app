// 背景音樂：從 assets/audio/manifest.json 的 bgm 清單隨機挑一首，不分寧靜或地獄模式
// 瀏覽器規定要先有使用者點擊才能出聲，所以第一次點畫面才開始；切換模式時隨機換曲，一首播完接著隨機下一首
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
  audio.preload = 'none';
  audio.volume = BGM_VOLUME;
  let files = [];
  let current = null;
  let unlocked = false;

  const enabled = () => getSettings().audio.bgmEnabled;

  function sync() {
    if (!current) current = pickRandom(files, null);
    if (!unlocked || !enabled() || engine.playing || !current) { audio.pause(); return; }
    const src = new URL(`assets/audio/${current}`, location.href).href;
    if (audio.src !== src) audio.src = src;
    if (audio.paused) audio.play().catch(() => {});
  }

  function next() {
    current = pickRandom(files, current);
    sync();
  }

  // 每次點擊都檢查一次：若還沒在播，就在點擊當下補播（iPhone 只在點擊時允許開始播放）
  const onGesture = () => { unlocked = true; sync(); };
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);

  audio.addEventListener('ended', next);
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
