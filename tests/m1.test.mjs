// M1 驗收：備份、壞檔、儲存空間不足、CSV
import test from 'node:test';
import assert from 'node:assert/strict';
import { installMockStorage } from './helpers.mjs';
import { save, load, KEYS, setErrorHandler } from '../js/storage.js';
import { buildBackup, parseBackupText, applyBackup } from '../js/backup.js';
import { parseCSV, toCSV } from '../js/csv.js';

function seedData() {
  save(KEYS.settings, { version: 1, countdown: { start: '2026-01-01', end: '2026-12-31' }, audio: { mixEnabled: false, volume: 0.5, lastTrack: null } });
  save(KEYS.quotes, [{ id: 'q1', text: '含,逗號\n與"引號"', author: '作者甲', book: '', page: '' }]);
  save(KEYS.notes, [{ id: 'n1', date: '2026-10-09', tag: '網管', text: '更新交換器', done: true }]);
  save(KEYS.hell, { retireDate: '2040-07-31', edu: 'master', level: 20, toggles: { research: true, homeroom: true, leader: false }, overrides: { research: null, homeroom: 4000, leader: null }, annualRaise: 0, promoteDate: '08-01', tallyStart: '2026-01-01' });
}

test('匯出再匯入後資料完全一致', () => {
  const s = installMockStorage();
  seedData();
  const before = new Map(s._map);
  const text = JSON.stringify(buildBackup());
  s.clear();
  save(KEYS.notes, [{ id: 'x', date: '2020-01-01', tag: '教學', text: '會被覆蓋', done: false }]);
  const res = parseBackupText(text);
  assert.equal(res.ok, true);
  assert.equal(applyBackup(res.backup).ok, true);
  assert.deepEqual(new Map(s._map), before);
});

test('損壞或舊版 JSON 提示錯誤且不改動現有資料', () => {
  const s = installMockStorage();
  seedData();
  const before = new Map(s._map);
  const good = buildBackup();
  const cases = [
    '{ 壞掉的 json',
    JSON.stringify({ ...good, schema: 0 }),
    JSON.stringify({ ...good, schema: 99 }),
    JSON.stringify({ ...good, app: 'other' }),
    JSON.stringify({ ...good, data: { ...good.data, 'tcalm:evil': 1 } }),
    JSON.stringify({ ...good, data: { ...good.data, [KEYS.notes]: [{ id: 'n', date: 'bad', tag: '教學', text: 'a', done: false }] } }),
    JSON.stringify({ ...good, data: { ...good.data, [KEYS.quotes]: 'not array' } }),
  ];
  for (const c of cases) {
    const r = parseBackupText(c);
    assert.equal(r.ok, false, c.slice(0, 60));
    assert.ok(r.error.length > 0);
  }
  assert.deepEqual(new Map(s._map), before);
});

test('儲存空間不足時有明確提示，匯入失敗會還原', () => {
  const s = installMockStorage();
  seedData();
  const before = new Map(s._map);
  const big = buildBackup();
  big.data[KEYS.quotes] = Array.from({ length: 50 }, (_, i) => ({ id: 'q' + i, text: 'x'.repeat(100), author: 'a' }));
  s.limit = [...s._map.values()].reduce((a, v) => a + v.length, 0) + 100;
  const r = parseBackupText(JSON.stringify(big));
  assert.equal(r.ok, true);
  const ar = applyBackup(r.backup);
  assert.equal(ar.ok, false);
  assert.match(ar.error, /儲存空間不足/);
  assert.deepEqual(new Map(s._map), before);

  let msg = '';
  setErrorHandler((m) => { msg = m; });
  assert.equal(save(KEYS.notes, big.data[KEYS.quotes]), false);
  assert.match(msg, /儲存空間不足/);
  assert.deepEqual(load(KEYS.notes), before.has(KEYS.notes) ? JSON.parse(before.get(KEYS.notes)) : null);
});

test('CSV 解析含逗號、換行、雙引號的測試列', () => {
  const text = '\ufeff句子,作者,書名,頁碼\r\n"甲，乙, 丙",作者一,,\r\n"第一行\r\n第二行",作者二,書,12\n"他說：""好""",作者三,"書,名",\n\n';
  const { records, error } = parseCSV(text);
  assert.equal(error, null);
  assert.equal(records.length, 4);
  assert.deepEqual(records[1].fields, ['甲，乙, 丙', '作者一', '', '']);
  assert.deepEqual(records[2].fields, ['第一行\n第二行', '作者二', '書', '12']);
  assert.equal(records[2].line, 3);
  assert.equal(records[3].line, 5);
  assert.deepEqual(records[3].fields, ['他說："好"', '作者三', '書,名', '']);
  // 輸出後再解析應相同
  const rows = records.map((r) => r.fields);
  assert.deepEqual(parseCSV(toCSV(rows)).records.map((r) => r.fields), rows);
  // 未結束的雙引號回報行號
  assert.equal(parseCSV('a,b\n"未結束,c\n').error.line, 2);
});
