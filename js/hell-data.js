// 地獄模式資料：薪額表載入、示意預設值、欄位驗證
import { KEYS, load, save } from './storage.js';
import { isISODate, daysBetween } from './dates.js';

export const EDU_KEYS = ['phd', 'master', 'credits40', 'bachelor'];
export const MAX_ALLOWANCE = 200000;

let tableCache = null;
export async function loadSalaryTable() {
  if (!tableCache) tableCache = fetch('seed/salary-table.json').then((r) => r.json());
  return tableCache;
}
export function setSalaryTable(t) { tableCache = Promise.resolve(t); }

// 示意預設值（不是任何人的真實資料），跳過設定時使用並標示「範例」
export function exampleHell(today = new Date()) {
  return {
    example: true,
    retireDate: `${today.getFullYear() + 15}-07-31`,
    edu: 'master',
    level: 20,
    toggles: { research: true, homeroom: true, leader: false },
    overrides: { research: null, homeroom: null, leader: null },
    annualRaise: 0,
    promoteDate: '08-01',
    tallyStart: `${today.getFullYear()}-01-01`,
  };
}

export function getHell() {
  const h = load(KEYS.hell, null);
  if (!h) return null;
  const d = exampleHell();
  return {
    ...d, ...h,
    toggles: { ...d.toggles, ...(h.toggles || {}) },
    overrides: { ...d.overrides, ...(h.overrides || {}) },
  };
}

export function saveHell(h) { return save(KEYS.hell, h); }

const okAmount = (v) => v == null || (Number.isInteger(v) && v >= 0 && v <= MAX_ALLOWANCE);

// 回傳錯誤訊息或 null（也用於備份匯入檢查）
export function validateHell(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return '地獄模式設定格式錯誤';
  if (!isISODate(h.retireDate)) return '請輸入正確的退休日期';
  if (!EDU_KEYS.includes(h.edu)) return '請選擇學歷';
  if (!Number.isInteger(h.level) || h.level < 1 || h.level > 36) return '薪級必須在一到三十六級之間';
  const t = h.toggles || {};
  if (!['research', 'homeroom', 'leader'].every((k) => typeof t[k] === 'boolean')) return '加給開關格式錯誤';
  const o = h.overrides || {};
  if (!['research', 'homeroom', 'leader'].every((k) => okAmount(o[k]))) return `加給金額必須是 0 到 ${MAX_ALLOWANCE} 的整數`;
  if (h.annualRaise != null && !(typeof h.annualRaise === 'number' && h.annualRaise >= -10 && h.annualRaise <= 10)) return '年調薪率必須在 -10% 到 10% 之間';
  if (h.promoteDate != null && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(h.promoteDate)) return '晉級日期格式錯誤';
  if (h.tallyStart != null && !isISODate(h.tallyStart)) return '已領累計起算日格式錯誤';
  return null;
}

// 退休倒數：已退休不顯示負數；回傳 { retired, days, years, months }
export function retireCountdown(retireDate, today) {
  const days = daysBetween(today, retireDate);
  if (days < 0) return { retired: true, days: 0, years: 0, months: 0 };
  const [ty, tm, td] = today.split('-').map(Number);
  const [ry, rm, rd] = retireDate.split('-').map(Number);
  let months = (ry - ty) * 12 + (rm - tm) - (rd < td ? 1 : 0);
  months = Math.max(0, months);
  return { retired: false, days, years: Math.floor(months / 12), months: months % 12 };
}
