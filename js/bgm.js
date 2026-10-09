// 背景音樂：從 assets/audio/manifest.json 的 bgm 清單隨機挑一首，不分寧靜或地獄模式
// 用 <audio> 邊下載邊播：開場動畫期間先緩衝開頭，不必等整首下載完
// 開場結束時先嘗試自動播放；瀏覽器擋下時（多數手機與 iPhone 一定會擋），在第一次點畫面的「當下」開始播
// 音量經過 Web Audio 調整（iPhone 不理會 audio.volume）
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

// 回傳 { ready }：目前這首可以開始播（或確定不用播）時 resolve，給開場動畫等待
export function initBgm() {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  let routed = false;
  let files = [];
  let current = null;
  let started = !document.getElementById('splash'); // 開場動畫結束後才開始播

  const enabled = () => getSettings().audio.bgmEnabled;

  // 第一次要出聲前才接上 Web Audio（之後就一直接著）
  function route() {
    if (routed) return;
    routed = true;
    try { engine.connect(audio, engine.context().destination, BGM_VOLUME); } catch { audio.volume = BGM_VOLUME; }
  }

  // 同步執行：在點擊當下呼叫時，播放才算是使用者觸發的
  function sync() {
    if (!current || !enabled()) { audio.pause(); return; }
    if (audio.dataset.file !== current) {
      audio.dataset.file = current;
      audio.src = `assets/audio/${current}`; // 換了網址瀏覽器就會開始緩衝
    }
    if (!started || engine.playing) { audio.pause(); return; }
    route();
    engine.unlock();
    if (audio.paused) audio.play().catch(() => {}); // 被擋下就等下一次點擊
  }

  function next() {
    current = pickRandom(files, current);
    sync();
  }

  document.addEventListener('pointerdown', sync, true);
  document.addEventListener('keydown', sync, true);
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
    .then((json) => {
      files = sanitizeBgm(json);
      current = pickRandom(files, null);
      if (!current || !enabled()) return null;
      sync();
      // 緩衝到可以開始播（或載入失敗）就算準備好；iPhone 點擊前不會緩衝，所以最多等 2.5 秒
      return new Promise((resolve) => {
        if (audio.readyState >= 3) { resolve(); return; }
        setTimeout(resolve, 2500);
        audio.addEventListener('canplay', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });
      });
    })
    .catch(() => {});
  return { ready: first };
}
