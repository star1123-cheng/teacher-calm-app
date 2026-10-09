// 本機儲存層：所有資料只存在 localStorage，鍵名前綴 tcalm:
// 模式（寧靜／地獄）刻意不存，每次啟動都從寧靜模式開始。

export const PREFIX = 'tcalm:';
export const KEYS = {
  settings: 'tcalm:settings',
  quotes: 'tcalm:quotes',
  quoteState: 'tcalm:quoteState',
  soupState: 'tcalm:soupState',
  notes: 'tcalm:notes',
  hell: 'tcalm:hell',
};
export const ALL_KEYS = Object.values(KEYS);

// 儲存失敗時通知介面（由 app.js 設定），避免各模組各自處理
let onError = () => {};
export function setErrorHandler(fn) { onError = fn; }

function backend() { return globalThis.localStorage; }

export function isQuotaError(err) {
  return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
}

export function load(key, fallback = null) {
  try {
    const raw = backend().getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// 回傳 true 表示寫入成功；失敗時通知介面並回傳 false
export function save(key, value) {
  try {
    backend().setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    onError(isQuotaError(err)
      ? '儲存空間不足，資料沒有存進去。請先匯出備份，再刪除不需要的紀要或句子。'
      : '資料儲存失敗，瀏覽器可能封鎖了本機儲存（例如無痕模式）。');
    return false;
  }
}

export function remove(key) {
  try { backend().removeItem(key); } catch { /* 忽略 */ }
}

// 讀出目前所有 tcalm: 鍵（原始字串），供備份與回復使用
export function snapshot() {
  const out = {};
  for (const key of ALL_KEYS) {
    try {
      const raw = backend().getItem(key);
      if (raw != null) out[key] = raw;
    } catch { /* 忽略 */ }
  }
  return out;
}

// 以原始字串整批覆蓋；任何一筆失敗就還原成原本的快照
export function replaceAll(rawMap) {
  const before = snapshot();
  try {
    for (const key of ALL_KEYS) {
      if (key in rawMap) backend().setItem(key, rawMap[key]);
      else backend().removeItem(key);
    }
    return { ok: true };
  } catch (err) {
    for (const key of ALL_KEYS) {
      try {
        if (key in before) backend().setItem(key, before[key]);
        else backend().removeItem(key);
      } catch { /* 盡力還原 */ }
    }
    return { ok: false, quota: isQuotaError(err) };
  }
}

// 預設設定
export function defaultSettings(today = new Date()) {
  const y = today.getFullYear();
  return {
    version: 1,
    countdown: { start: toISODate(today), end: `${y}-12-31` },
    audio: { mixEnabled: false, volume: 0.5, lastTrack: null },
  };
}

export function getSettings() {
  const s = load(KEYS.settings, null);
  const d = defaultSettings();
  if (!s || typeof s !== 'object') return d;
  return {
    version: d.version,
    countdown: { ...d.countdown, ...(s.countdown || {}) },
    audio: { ...d.audio, ...(s.audio || {}) },
  };
}

export function saveSettings(s) { return save(KEYS.settings, s); }

export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
