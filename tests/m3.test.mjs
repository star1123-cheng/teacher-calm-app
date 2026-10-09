// M3 驗收：彩蛋計數、退休倒數、地獄設定驗證、音檔接縫、定時關閉、缺音檔
import test from 'node:test';
import assert from 'node:assert/strict';
import { installMockStorage, installMockAudio, TEST_TRACKS } from './helpers.mjs';
installMockStorage();
installMockAudio();
const { createTapCounter } = await import('../js/egg.js');
const { retireCountdown, validateHell, exampleHell } = await import('../js/hell-data.js');
const { sanitizeManifest, AudioEngine, FADE_SECONDS } = await import('../js/audio.js');

test('彩蛋：5 秒內 3 下必定切換，第 6 秒才點第 3 下不切換', () => {
  const c = createTapCounter();
  const r = [0, 800, 1600].map((t) => c.tap(t));
  assert.deepEqual(r.map((x) => x.hint), [false, true, false]);
  assert.equal(r[2].triggered, true);
  const c2 = createTapCounter();
  const r2 = [0, 2000, 5500].map((t) => c2.tap(t));
  assert.equal(r2[2].triggered, false);
  assert.equal(r2[2].count, 1, '超過 5 秒後重新計數');
  assert.equal(r2[2].hint, false);
  // 剛好 5 秒內（含 5000ms）仍算
  const c3 = createTapCounter();
  assert.equal([0, 4000, 5000].map((t) => c3.tap(t)).at(-1).triggered, true);
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

test('串流播放：點擊當下同步送出播放指令，停止時暫停', () => {
  const e = new AudioEngine();
  const p = e.play(TEST_TRACKS[0]);
  const { audio } = e.channels.get('file:rain.mp3');
  assert.equal(audio.playCalls, 1, '還沒 await 就已經呼叫 play()');
  assert.equal(audio.loop, true);
  assert.equal(audio.src, 'assets/audio/rain.mp3');
  e.stop('file:rain.mp3');
  assert.equal(audio.paused, true);
  // 同一首再播，重複使用同一個播放器（Web Audio 只能接一次）
  e.play(TEST_TRACKS[0]);
  assert.equal(e.channels.get('file:rain.mp3').audio, audio);
  return p;
});

test('音檔清單：過濾不安全的檔名，缺清單時只有合成', () => {
  const t = sanitizeManifest({ tracks: [{ name: '雨', file: 'rain.mp3' }, { name: 'x', file: '../evil.mp3' }, { name: 'y', file: 'a/b.mp3' }, { name: 'z', file: 'x.js' }] });
  assert.deepEqual(t.map((x) => x.file), ['rain.mp3']);
  assert.deepEqual(sanitizeManifest(null), []);
});

test('定時關閉：到時前 3 秒淡出，時間到停止', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const e = new AudioEngine();
  await e.play(TEST_TRACKS[0]);
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
  await e.play(TEST_TRACKS[0]);
  await e.play(TEST_TRACKS[1]);
  assert.deepEqual(e.activeIds, ['file:sea.mp3']);
});
