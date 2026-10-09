// 日期工具：一律以「本地日期」的 YYYY-MM-DD 字串運算，用 UTC 計算天數以避開日光節約時間
import { toISODate } from './storage.js';

export { toISODate };
export const todayISO = () => toISODate(new Date());

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };

// b 減 a 的天數
export function daysBetween(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}
