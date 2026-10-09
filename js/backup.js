// 備份匯出與匯入：單一 JSON，包含所有 tcalm: 鍵、匯出時間與 schema 版本。
import { KEYS, ALL_KEYS, snapshot, replaceAll } from './storage.js';

export const APP_ID = 'teacher-calm-app';
export const SCHEMA_VERSION = 1;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const NOTE_TAGS = ['教學', '行政', '網管'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const optStr = (v) => v == null || isStr(v);

function checkRotation(v) {
  return isObj(v) && Array.isArray(v.order) && v.order.every(isStr)
    && Number.isInteger(v.pos) && Number.isInteger(v.round)
    && (v.today == null || (isObj(v.today) && isDate(v.today.date) && isStr(v.today.id)));
}

// 每個鍵的欄位檢查；回傳錯誤訊息或 null
const validators = {
  [KEYS.settings]: (v) => {
    if (!isObj(v)) return '設定不是物件';
    if (v.countdown != null && (!isObj(v.countdown) || !isDate(v.countdown.start) || !isDate(v.countdown.end))) return '倒數日期格式錯誤';
    if (v.audio != null && !isObj(v.audio)) return '音訊設定格式錯誤';
    return null;
  },
  [KEYS.quotes]: (v) => {
    if (!Array.isArray(v)) return '句庫不是陣列';
    const bad = v.findIndex((q) => !isObj(q) || !isStr(q.id) || !isStr(q.text) || !q.text || !isStr(q.author) || !optStr(q.book) || !optStr(q.page));
    return bad >= 0 ? `句庫第 ${bad + 1} 筆欄位錯誤` : null;
  },
  [KEYS.quoteState]: (v) => (checkRotation(v) ? null : '一日一句輪替狀態格式錯誤'),
  [KEYS.soupState]: (v) => (checkRotation(v) ? null : '毒雞湯輪替狀態格式錯誤'),
  [KEYS.notes]: (v) => {
    if (!Array.isArray(v)) return '工作紀要不是陣列';
    const bad = v.findIndex((x) => !isObj(x) || !isStr(x.id) || !isDate(x.date) || !NOTE_TAGS.includes(x.tag) || !isStr(x.text) || !x.text || typeof x.done !== 'boolean');
    return bad >= 0 ? `工作紀要第 ${bad + 1} 筆欄位錯誤` : null;
  },
  [KEYS.hell]: (v) => (isObj(v) ? null : '地獄模式設定格式錯誤'),
};

export function buildBackup(now = new Date()) {
  const raw = snapshot();
  const data = {};
  for (const [k, s] of Object.entries(raw)) {
    try { data[k] = JSON.parse(s); } catch { /* 壞掉的鍵不匯出 */ }
  }
  return { app: APP_ID, schema: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

// 驗證備份內容；全部通過才回傳 ok
export function validateBackup(obj) {
  if (!isObj(obj) || obj.app !== APP_ID) return { ok: false, error: '這不是教師寧靜 app 的備份檔。' };
  if (!Number.isInteger(obj.schema)) return { ok: false, error: '備份檔缺少版本資訊。' };
  if (obj.schema < SCHEMA_VERSION) return { ok: false, error: `備份檔版本太舊（第 ${obj.schema} 版），目前只接受第 ${SCHEMA_VERSION} 版。` };
  if (obj.schema > SCHEMA_VERSION) return { ok: false, error: `備份檔來自較新的版本（第 ${obj.schema} 版），請先更新 app。` };
  if (!isObj(obj.data)) return { ok: false, error: '備份檔缺少資料內容。' };
  for (const [k, v] of Object.entries(obj.data)) {
    if (!ALL_KEYS.includes(k)) return { ok: false, error: `備份檔含有未知的資料項目「${k}」。` };
    const err = validators[k](v);
    if (err) return { ok: false, error: `備份檔內容有誤：${err}。` };
  }
  const d = obj.data;
  return {
    ok: true,
    summary: {
      exportedAt: isStr(obj.exportedAt) ? obj.exportedAt : '',
      quotes: Array.isArray(d[KEYS.quotes]) ? d[KEYS.quotes].length : 0,
      notes: Array.isArray(d[KEYS.notes]) ? d[KEYS.notes].length : 0,
      hasSettings: KEYS.settings in d,
      hasHell: KEYS.hell in d,
    },
  };
}

// 解析檔案文字並驗證；不會動到現有資料
export function parseBackupText(text) {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: '檔案太大，不像是本 app 的備份檔。' };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: '檔案損壞，無法讀取 JSON。' }; }
  const res = validateBackup(obj);
  return res.ok ? { ...res, backup: obj } : res;
}

// 已驗證的備份才可呼叫；失敗時自動還原
export function applyBackup(backup) {
  const raw = {};
  for (const [k, v] of Object.entries(backup.data)) raw[k] = JSON.stringify(v);
  const res = replaceAll(raw);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.quota ? '儲存空間不足，匯入已取消，現有資料沒有變動。' : '匯入失敗，現有資料沒有變動。' };
}
