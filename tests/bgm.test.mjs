// 背景音樂：清單過濾與隨機挑曲
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMockStorage } from './helpers.mjs';

installMockStorage();
const { sanitizeBgm, pickRandom } = await import('../js/bgm.js');

test('bgm 清單只留安全檔名、去除重複', () => {
  const list = sanitizeBgm({ bgm: ['a.mp3', 'a.mp3', '../x.mp3', 'b.mp3', 3, 'c.wav'] });
  assert.deepEqual(list, ['a.mp3', 'b.mp3']);
  assert.deepEqual(sanitizeBgm({ bgm: { calm: 'a.mp3' } }), []);
  assert.deepEqual(sanitizeBgm(null), []);
});

test('隨機挑曲：有兩首以上不會連續同一首', () => {
  const list = ['a.mp3', 'b.mp3', 'c.mp3'];
  for (const r of [0, 0.5, 0.99]) assert.notEqual(pickRandom(list, 'b.mp3', () => r), 'b.mp3');
  assert.equal(pickRandom(['a.mp3'], 'a.mp3'), 'a.mp3');
  assert.equal(pickRandom([], null), null);
});
