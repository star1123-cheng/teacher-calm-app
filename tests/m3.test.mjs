// M3 驗收：彩蛋計數、退休倒數、地獄設定驗證、噪音接縫、定時關閉、缺音檔
import test from 'node:test';
import assert from 'node:assert/strict';
import { installMockStorage, installMockAudio } from './helpers.mjs';
installMockStorage();
installMockAudio();
const { createTapCounter } = await import('../js/egg.js');
const { retireCountdown, validateHell, exampleHell } = await import('../js/hell-data.js');
const { makeNoise, sanitizeManifest, AudioEngine, SYNTH_TRACKS, FADE_SECONDS } = await import('../js/audio.js');

test('彩蛋：3 秒內 5 下必定切換，第 4 秒才點第 5 下不切換', () => {
  const c = createTapCounter();
  const r = [0, 500, 1000, 1500, 2000].map((t) => c.tap(t));
  assert.deepEqual(r.map((x) => x.hint), [false, false, true, true, false]);
  assert.equal(r[4].triggered, true);
  const c2 = createTapCounter();
  const r2 = [0, 700, 1400, 2100, 3500].map((t) => c2.tap(t));
  assert.equal(r2[4].triggered, false);
  assert.equal(r2[4].count, 1, '超過 3 秒後重新計數');
  assert.equal(r2[4].hint, false);
  // 剛好 3 秒內（含 3000ms）仍算
  const c3 = createTapCounter();
  assert.equal([0, 1000, 2000, 2500, 3000].map((t) => c3.tap(t)).at(-1).triggered, true);
});

test('退休倒數：剩餘天數、年月、已退休不為負', () => {
  assert.deepEqual(retireCountdown('2026-10-10', '2026-10-09'), { retired: false, days: 1, years: 0, months: 0 });
  assert.deepEqual(retireCountdown('2028-12-09', '2026-10-09'), { retired: false, days: 792, years: 2, months: 2 });
  assert.deepEqual(retireCountdown('2020-01-01', '2026-10-09'), { retired: true, days: 0, years: 0, months: 0 });
});

test('地獄設定：範例值合法、錯誤值擋下', () => {
  const ex = exampleHell(new Date(2026, 9, 9));
  assert.equal(validateHell(ex), null);
  assert.equal(ex.example, true);
  assert.ok(validateHell({ ...ex, level: 37 }));
  assert.ok(validateHell({ ...ex, retireDate: '2026-02-30' }));
  assert.ok(validateHell({ ...ex, overrides: { ...ex.overrides, homeroom: -1 } }));
  assert.ok(validateHell({ ...ex, edu: 'x' }));
});

test('噪音接縫：循環頭尾相接時沒有跳點', () => {
  let seed = 1; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const type of ['white', 'pink', 'brown']) {
    const out = makeNoise(type, 8000, 2000, rng);
    assert.equal(out.length, 8000);
    const jump = Math.abs(out[0] - out[out.length - 1]);
    const typical = out.slice(1).reduce((s, v, i) => s + Math.abs(v - out[i]), 0) / (out.length - 1);
    assert.ok(jump < typical * 6 + 0.05, `${type} 接縫跳動 ${jump} 對比平均 ${typical}`);
  }
});

test('音檔清單：過濾不安全的檔名，缺清單時只有合成', () => {
  const t = sanitizeManifest({ tracks: [{ name: '雨', file: 'rain.mp3' }, { name: 'x', file: '../evil.mp3' }, { name: 'y', file: 'a/b.mp3' }, { name: 'z', file: 'x.js' }] });
  assert.deepEqual(t.map((x) => x.file), ['rain.mp3']);
  assert.deepEqual(sanitizeManifest(null), []);
});

test('定時關閉：到時前 3 秒淡出，時間到停止', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const e = new AudioEngine();
  await e.play(SYNTH_TRACKS[0]);
  assert.equal(e.channels.size, 1);
  e.setTimer(15 * 60000);
  t.mock.timers.tick(15 * 60000 - FADE_SECONDS * 1000 - 1);
  assert.equal(e.master.gain.events.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(e.master.gain.events.at(-1).slice(0, 2), ['ramp', 0]);
  assert.equal(e.channels.size, 1);
  t.mock.timers.tick(FADE_SECONDS * 1000);
  assert.equal(e.channels.size, 0);
  // 單軌：換音源會替換
  await e.play(SYNTH_TRACKS[0]);
  await e.play(SYNTH_TRACKS[1]);
  assert.deepEqual(e.activeIds, ['synth:pink']);
});
