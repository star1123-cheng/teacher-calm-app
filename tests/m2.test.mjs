// M2 驗收：倒數、一日一句、工作紀要（純邏輯部分）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMockStorage } from './helpers.mjs';
installMockStorage();
const { computeCountdown, validateRange } = await import('../js/countdown.js');
const { pickToday, advance } = await import('../js/rotation.js');
const { parseQuotesCSV, toGroups, ORIGINAL } = await import('../js/quote.js');
const { sortNotes, filterNotes, notesToText, validateNote } = await import('../js/notes.js');
const { defaultSettings } = await import('../js/storage.js');
const { parseCSV } = await import('../js/csv.js');

test('倒數：預設值、驗證、到期、進度條', () => {
  const d = defaultSettings(new Date(2026, 9, 9));
  assert.deepEqual(d.countdown, { start: '2026-10-09', end: '2026-12-31' });
  assert.match(validateRange('2026-12-01', '2026-11-01'), /不能晚於/);
  assert.equal(validateRange('2026-11-01', '2026-11-01'), null);
  assert.deepEqual(computeCountdown('2026-01-01', '2026-12-31', '2026-12-31'), { remaining: 0, progress: 1, done: false });
  const after = computeCountdown('2026-01-01', '2026-12-31', '2027-01-01');
  assert.equal(after.done, true); assert.equal(after.remaining, 0);
  assert.equal(computeCountdown('2026-10-09', '2026-12-31', '2026-10-09').progress, 0);
  assert.equal(computeCountdown('2026-10-09', '2026-12-31', '2026-01-01').progress, 0); // 起點之前不為負
  assert.equal(computeCountdown('2026-10-09', '2026-12-31', '2026-10-09').remaining, 83);
  // 跨日光節約／閏年也是整數天
  assert.equal(computeCountdown('2024-01-01', '2024-12-31', '2024-03-01').remaining, 305);
});

const ids = (p, n) => Array.from({ length: n }, (_, i) => p + i);

test('一日一句：一輪不重複、作家句優先、重新洗牌', () => {
  const groups = [ids('a', 5), ids('o', 7)];
  let s = null; const seen = [];
  for (let day = 0; day < 12; day++) { s = advance(s || {}, groups, `d${day}`); seen.push(s.today.id); }
  assert.equal(new Set(seen).size, 12);
  assert.ok(seen.slice(0, 5).every((x) => x.startsWith('a')), '作家句先出完');
  assert.ok(seen.slice(5).every((x) => x.startsWith('o')));
  s = advance(s, groups, 'd12');
  assert.equal(s.round, 1); assert.ok(s.today.id.startsWith('a'));
});

test('一日一句：同日同句、隔日換句、只有原創句、句庫變動', () => {
  const groups = [[], ids('o', 3)];
  const s1 = pickToday(null, groups, '2026-10-09');
  assert.equal(pickToday(s1, groups, '2026-10-09'), s1);
  const s2 = pickToday(s1, groups, '2026-10-10');
  assert.notEqual(s2.today.id, s1.today.id);
  assert.ok(s2.today.id.startsWith('o'));
  // 輪到一半新匯入作家句：下一句就是作家句
  const s3 = pickToday(s2, [['a0'], ids('o', 3)], '2026-10-11');
  assert.equal(s3.today.id, 'a0');
  // 空句庫不報錯
  assert.equal(pickToday(null, [[], []], '2026-10-09').today, null);
});

test('句庫 CSV：範本筆數、逗號與換行、重複與錯誤行號', () => {
  const tpl = parseQuotesCSV(readFileSync('seed/quotes-template.csv', 'utf8'));
  assert.equal(tpl.items.length, 3); assert.equal(tpl.errors.length, 0);
  assert.equal(tpl.items[1].book, ''); assert.equal(tpl.items[1].page, '');
  const csv = '句子,作者,書名,頁碼\n"甲,乙\n丙",作者,,\n重複,作者,,\n重複,作者,,\n,作者,,\n只有句子,,,\n原創一句,原創,,\n';
  const r = parseQuotesCSV(csv, [{ text: '已存在' }]);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].text, '甲,乙\n丙');
  assert.equal(r.duplicates, 1);
  assert.deepEqual(r.errors.map((e) => e.line), [6, 7]);
  const g = toGroups(r.items, [{ id: 'o', author: ORIGINAL }]);
  assert.equal(g[0].length, 2); assert.equal(g[1].length, 2);
  assert.equal(parseQuotesCSV('a,b\n1,2').errors[0].line, 1);
  const builtin = parseCSV(readFileSync('seed/daily-quotes.csv', 'utf8'));
  assert.equal(builtin.error, null);
  assert.equal(builtin.records.length - 1, 301);
});

test('工作紀要：排序、篩選、文字格式、空白不可新增', () => {
  const notes = [
    { id: '1', date: '2026-10-01', tag: '教學', text: '備課', done: false },
    { id: '2', date: '2026-10-09', tag: '網管', text: '更新\n交換器', done: true },
    { id: '3', date: '2026-10-09', tag: '行政', text: '公文', done: false },
  ];
  assert.deepEqual(sortNotes(notes).map((n) => n.id), ['2', '3', '1']);
  assert.deepEqual(filterNotes(notes, { tag: '網管' }).map((n) => n.id), ['2']);
  assert.deepEqual(filterNotes(notes, { status: 'todo' }).map((n) => n.id), ['1', '3']);
  assert.equal(notesToText(sortNotes(notes)), '2026-10-09 [網管] 更新 交換器 ✓\n2026-10-09 [行政] 公文\n2026-10-01 [教學] 備課');
  assert.ok(validateNote({ date: '2026-10-09', tag: '教學', text: '   ' }));
  assert.equal(validateNote({ date: '2026-10-09', tag: '教學', text: 'ok' }), null);
});

test('工作紀要分類：預設教學、行政，可自訂（最多 10 字）', async () => {
  const { TAGS, allTags, cleanTag, validateNote } = await import('../js/notes.js');
  assert.deepEqual(TAGS, ['教學', '行政']);
  assert.deepEqual(allTags([{ tag: '社團' }, { tag: '教學' }, { tag: ' 社團 ' }]), ['教學', '行政', '社團']);
  assert.equal(cleanTag(' [研習]\n'), '研習');
  assert.equal(validateNote({ date: '2026-10-09', tag: '社團', text: 'ok' }), null);
  assert.ok(validateNote({ date: '2026-10-09', tag: '  ', text: 'ok' }));
  assert.ok(validateNote({ date: '2026-10-09', tag: '一二三四五六七八九十一', text: 'ok' }));
});
