// 開場動畫：至少播滿 7 秒，並等背景音樂整首下載好才淡出（網路太慢時最多等到 12 秒）
// 點一下畫面或按任意鍵可以略過；結束時送出 tcalm:splash-done，背景音樂收到後才開始播
import { prefersReducedMotion } from './ui.js';

export const SPLASH_MS = 7000;
export const SPLASH_MAX_MS = 12000;
const OUT_MS = 800;

export function initSplash(ready = Promise.resolve()) {
  const el = document.getElementById('splash');
  if (!el) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.classList.add('splash-out');
    document.removeEventListener('keydown', finish);
    document.dispatchEvent(new CustomEvent('tcalm:splash-done'));
    setTimeout(() => el.remove(), OUT_MS);
  };
  // 動畫在 HTML 一出現就開始了，所以用「開啟網頁到現在」的時間來算還要等多久
  const left = (ms) => Math.max(0, ms - performance.now());
  const minMs = prefersReducedMotion() ? 1500 : SPLASH_MS;
  const minWait = new Promise((r) => setTimeout(r, left(minMs)));
  Promise.all([minWait, ready.catch(() => {})]).then(finish);
  setTimeout(finish, left(SPLASH_MAX_MS));
  el.addEventListener('pointerdown', finish);
  document.addEventListener('keydown', finish);
}
