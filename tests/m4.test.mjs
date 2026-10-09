// M4 驗收：規格中的測試案例、晉級、加給切換、調薪、跳表與系統時間一致
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthlyPay, levelAt, payAt, earningsBetween, salarySummary, perSecondAt } from '../js/salary.js';

const table = JSON.parse(readFileSync('seed/salary-table.json', 'utf8'));
const base = { edu: 'master', toggles: { research: true, homeroom: true, leader: false }, overrides: {}, annualRaise: 0, promoteDate: '08-01', retireDate: '2045-07-31', tallyStart: '2026-01-01' };

test('規格測試案例：月應領', () => {
  assert.equal(monthlyPay(table, base, 24).total, 58170);
  assert.equal(monthlyPay(table, base, 10).total, 85320);
});

test('碩士五級（650 點）已達上限，晉級日後仍為五級', () => {
  const h = { ...base, level: 5 };
  const today = new Date(2026, 6, 1);
  assert.equal(levelAt(table, h, new Date(2030, 8, 1), today), 5);
  // 碩士二四級：每年 8/1 晉一級，到五級為止
  const h2 = { ...base, level: 24 };
  assert.equal(levelAt(table, h2, new Date(2026, 6, 31), today), 24);
  assert.equal(levelAt(table, h2, new Date(2026, 7, 1), today), 23);
  assert.equal(levelAt(table, h2, new Date(2060, 0, 1), today), 5);
  // 大學上限 625 點＝六級
  assert.equal(levelAt(table, { ...h2, edu: 'bachelor' }, new Date(2070, 0, 1), today), 6);
});

test('跨晉級日的月份，加給分段隨薪點切換', () => {
  // 一九級 330 點 → 一八級 350 點：學術研究加給 25,780 → 29,260
  const h = { ...base, level: 19 };
  const today = new Date(2026, 6, 15);
  assert.equal(payAt(table, h, new Date(2026, 6, 31), today).research, 25780);
  assert.equal(payAt(table, h, new Date(2026, 7, 1), today).research, 29260);
  // 晉級日在月中（8/16）：8 月分段計算
  const hm = { ...h, promoteDate: '08-16' };
  const aug = earningsBetween(table, hm, new Date(2026, 7, 1), new Date(2026, 8, 1), today);
  const before = monthlyPay(table, hm, 19).total, after = monthlyPay(table, hm, 18).total;
  assert.ok(Math.abs(aug - (before * 15 / 31 + after * 16 / 31)) < 1e-6);
});

test('關閉加給立即反映；年調薪率 0% 與無調薪一致', () => {
  const h = { ...base, level: 24 };
  assert.equal(monthlyPay(table, { ...h, toggles: { ...h.toggles, homeroom: false } }, 24).total, 54170);
  assert.equal(monthlyPay(table, { ...h, overrides: { homeroom: 3000 } }, 24).total, 57170);
  const now = new Date(2026, 9, 9, 12);
  const a = salarySummary(table, { ...h, annualRaise: 0 }, now);
  const b = salarySummary(table, { ...h, annualRaise: undefined }, now);
  assert.equal(a.toRetire, b.toRetire);
  const c = salarySummary(table, { ...h, annualRaise: 1 }, now);
  assert.ok(c.toRetire > a.toRetire);
});

test('已領累計：整月等於月應領；背景一小時後與系統時間一致', () => {
  const h = { ...base, level: 24, tallyStart: '2026-01-01' };
  const now = new Date(2026, 2, 1); // 3/1 00:00 → 剛好領完 1、2 月
  assert.ok(Math.abs(salarySummary(table, h, now).earned - 58170 * 2) < 1e-6);
  const t0 = new Date(2026, 9, 9, 10, 0, 0);
  const t1 = new Date(2026, 9, 9, 11, 0, 0);
  const diff = salarySummary(table, h, t1).earned - salarySummary(table, h, t0).earned;
  assert.ok(Math.abs(diff - perSecondAt(table, h, t0, t0) * 3600) < 1e-6);
  assert.ok(Math.abs(perSecondAt(table, h, t0, t0) - 58170 / (31 * 86400)) < 1e-12);
});

test('退休日早於今天：已退休，無負數', () => {
  const s = salarySummary(table, { ...base, level: 24, retireDate: '2020-07-31' }, new Date(2026, 9, 9));
  assert.equal(s.retired, true);
  assert.equal(s.toRetire, 0);
  assert.equal(s.perSecond, 0);
  assert.ok(s.earned >= 0);
});
