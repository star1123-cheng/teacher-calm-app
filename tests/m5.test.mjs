// M5 驗收：毒雞湯輪播、混音上限
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMockStorage, installMockAudio, TEST_TRACKS } from './helpers.mjs';
installMockStorage();
installMockAudio();
const { parseCSV } = await import('../js/csv.js');
const { pickToday, advance } = await import('../js/rotation.js');
const { AudioEngine, MAX_MIX } = await import('../js/audio.js');

test('毒雞湯：240 句、同日同句、再來一句整輪不重複', () => {
  const soups = parseCSV(readFileSync('seed/toxic-soup.csv', 'utf8')).records.slice(1).map((r) => r.fields[0].trim());
  assert.equal(soups.length, 240);
  assert.equal(new Set(soups).size, 240);
  const groups = [soups.map((_, i) => 's' + i)];
  let s = pickToday(null, groups, '2026-10-09');
  assert.equal(pickToday(s, groups, '2026-10-09'), s);
  const seen = [s.today.id];
  for (let i = 0; i < 239; i++) { s = advance(s, groups, '2026-10-09'); seen.push(s.today.id); }
  assert.equal(new Set(seen).size, 240);
  const next = advance(s, groups, '2026-10-09');
  assert.notEqual(next.today.id, s.today.id, '新一輪第一句不和上一句相同');
});

test('混音：關閉時只能單軌；開啟後第 3 軌被拒絕並提示', async () => {
  const e = new AudioEngine();
  await e.play(TEST_TRACKS[0], { replace: false });
  const r1 = await e.play(TEST_TRACKS[1], { replace: false });
  assert.equal(r1.ok, false);
  assert.equal(e.channels.size, 1);
  e.stopAll();
  e.maxChannels = MAX_MIX;
  assert.equal((await e.play(TEST_TRACKS[0], { replace: false })).ok, true);
  assert.equal((await e.play(TEST_TRACKS[1], { replace: false })).ok, true);
  const r3 = await e.play(TEST_TRACKS[2], { replace: false });
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /最多同時播放 2 軌/);
  assert.deepEqual(e.activeIds, ['file:rain.mp3', 'file:sea.mp3']);
  e.setChannelVolume('file:sea.mp3', 0.3);
  assert.equal(e.channels.get('file:sea.mp3').volume, 0.3);
});
