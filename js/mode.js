// 寧靜／地獄模式整頁翻面（不保存模式，重新整理一律回寧靜模式）
import { prefersReducedMotion } from './ui.js';
import { applyTheme } from './theme.js';
import { closeSheet } from './sheet.js';

export const FLIP_MS = 800;
let busy = false;
export const isBusy = () => busy;

export function switchMode(mode, afterSwitch) {
  const root = document.documentElement;
  if (busy || root.dataset.mode === mode) return;
  closeSheet();
  const calm = document.getElementById('view-home');
  const hell = document.getElementById('view-hell');
  const toHell = mode === 'hell';
  root.dataset.mode = mode;
  // 看不到的那一面設為 inert，避免鍵盤焦點與讀屏誤入
  calm.inert = toHell; calm.setAttribute('aria-hidden', String(toHell));
  hell.inert = !toHell; hell.setAttribute('aria-hidden', String(!toHell));
  applyTheme();
  if (prefersReducedMotion()) { afterSwitch?.(); return; }
  busy = true;
  setTimeout(() => { busy = false; afterSwitch?.(); }, FLIP_MS);
}
