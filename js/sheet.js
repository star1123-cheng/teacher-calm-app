// 共用面板（原生 <dialog>）：一次只開一個；手機由下升起、電腦置中；Esc 或點遮罩關閉
import { prefersReducedMotion } from './ui.js';

const TITLES = { ring: '時光倒數', quote: '一日一句', notes: '工作紀要', noise: '白噪音', settings: '設定', salary: '薪水明細', draw: '毒雞湯', setup: '退休與薪資資料' };
const dlg = () => document.getElementById('sheet');
const openHandlers = new Map();
const closeHandlers = new Map();
let current = null;
let closeTimer;

export function onSheetOpen(name, fn) { openHandlers.set(name, fn); }
export function onSheetClose(name, fn) { closeHandlers.set(name, fn); }
export const currentSheet = () => current;

export function openSheet(name) {
  const d = dlg();
  clearTimeout(closeTimer);
  if (current && current !== name) closeHandlers.get(current)?.();
  current = name;
  for (const p of d.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  document.getElementById('sheet-title').textContent = TITLES[name] || '';
  d.classList.toggle('wide', name === 'draw');
  if (!d.open) {
    d.showModal();
    void d.offsetWidth; // 先套用起始位置，升起動畫才會出現
  }
  d.classList.add('is-open');
  d.scrollTop = 0;
  openHandlers.get(name)?.();
}

export function closeSheet() {
  const d = dlg();
  if (!d.open) return;
  const name = current;
  d.classList.remove('is-open');
  closeHandlers.get(name)?.();
  closeTimer = setTimeout(() => { d.close(); current = null; }, prefersReducedMotion() ? 0 : 350);
}

export function initSheet() {
  const d = dlg();
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  // 點到面板外的遮罩（事件目標是 dialog 本身）就關閉
  d.addEventListener('click', (e) => { if (e.target === d) closeSheet(); });
}

// 讓 role="button" 的卡片也能用 Enter／空白鍵開啟
export function clickable(el, fn) {
  el.addEventListener('click', fn);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  });
}
