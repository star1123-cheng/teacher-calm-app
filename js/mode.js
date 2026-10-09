// 寧靜／地獄模式切換（不保存模式，重新整理一律回寧靜模式）
import { showView } from './router.js';
import { prefersReducedMotion } from './ui.js';

export const TRANSITION_MS = 1000;
let busy = false;

export function switchMode(mode, afterSwitch) {
  if (busy) return;
  const apply = () => {
    document.body.classList.toggle('mode-hell', mode === 'hell');
    showView(mode === 'hell' ? 'hell' : 'home');
    afterSwitch?.();
  };
  if (prefersReducedMotion()) { apply(); return; }
  // 約 1 秒轉場：前半段畫面變暗變紅，切換後再淡出
  busy = true;
  const overlay = document.getElementById('transition');
  overlay.className = mode === 'hell' ? 'to-hell' : 'to-quiet';
  overlay.hidden = false;
  void overlay.offsetWidth; // 先讓瀏覽器套用初始透明度，淡入動畫才會出現
  overlay.classList.add('on');
  setTimeout(() => {
    apply();
    overlay.classList.remove('on');
    setTimeout(() => { overlay.hidden = true; busy = false; }, TRANSITION_MS / 2);
  }, TRANSITION_MS / 2);
}
