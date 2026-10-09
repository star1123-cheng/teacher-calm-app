// 時光倒數：首頁卡片顯示剩餘天數與細進度條；點開圓環面板可修改日期
import { getSettings, saveSettings, defaultSettings } from './storage.js';
import { isISODate, daysBetween, todayISO } from './dates.js';
import { openSheet, onSheetOpen, onSheetClose, clickable } from './sheet.js';
import { prefersReducedMotion } from './ui.js';

export function validateRange(start, end) {
  if (!isISODate(start) || !isISODate(end)) return '請輸入完整的起點日與終點日。';
  if (start > end) return '起點日不能晚於終點日，請修正。';
  return null;
}

// 回傳剩餘天數（不會是負數）、進度（0 到 1）、是否已完成
export function computeCountdown(start, end, today) {
  const remaining = Math.max(0, daysBetween(today, end));
  const done = today > end;
  const total = daysBetween(start, end);
  let progress;
  if (done) progress = 1;
  else if (total <= 0) progress = today >= end ? 1 : 0;
  else progress = Math.min(1, Math.max(0, daysBetween(start, today) / total));
  return { remaining, progress, done };
}

const md = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`; };
const CIRC = 2 * Math.PI * 90;
// 與 CSS 相同的緩動曲線 cubic-bezier(.2, .7, .2, 1)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u, D = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) { const d = D(u); if (Math.abs(d) < 1e-6) break; u -= (X(u) - t) / d; }
    return Y(Math.min(1, Math.max(0, u)));
  };
}
const EASE = bezier(0.2, 0.7, 0.2, 1);

export function initCountdown() {
  const $ = (id) => document.getElementById(id);
  const card = $('countdown');
  const form = $('cd-form'), startIn = $('cd-start'), endIn = $('cd-end'), err = $('cd-error');
  const ringWrap = document.querySelector('.ring-wrap');
  const fill = $('ring-fill');
  fill.setAttribute('stroke-dasharray', CIRC.toFixed(2));
  let raf, delay;

  const state = () => {
    const { start, end } = getSettings().countdown;
    return { start, end, ...computeCountdown(start, end, todayISO()) };
  };

  function renderCard() {
    const c = state();
    card.classList.toggle('is-done', c.done);
    $('cd-days').textContent = c.done ? '已完成' : String(c.remaining);
    $('cd-unit').hidden = c.done;
    $('cd-bar').style.width = `${Math.round(c.progress * 100)}%`;
    $('cd-end-label').textContent = `到 ${md(c.end)}`;
    $('cd-start-label').textContent = `自 ${md(c.start)}・${Math.round(c.progress * 100)}%`;
    card.setAttribute('aria-label', c.done ? '時光倒數：已完成' : `時光倒數：還有 ${c.remaining} 天，已過 ${Math.round(c.progress * 100)}%`);
  }

  // 圓環：剩餘比例 = 1 − 已過進度；從 0 畫到目標值並同步滾動數字
  function drawRing(t) {
    const c = state();
    const remain = c.done ? 0 : 1 - c.progress;
    const e = EASE(t);
    fill.setAttribute('stroke-dashoffset', (CIRC - CIRC * remain * e).toFixed(2));
    $('ring-num').textContent = c.done ? '已完成' : String(Math.round(c.remaining * e));
  }

  function renderRing(animate) {
    const c = state();
    ringWrap.classList.toggle('is-done', c.done);
    $('ring-sub').textContent = c.done ? '' : `天後 ${md(c.end)}`;
    $('ring-meta').textContent = `${md(c.start)} → ${md(c.end)}・剩餘 ${Math.round((c.done ? 0 : 1 - c.progress) * 100)}%`;
    $('ring-done-text').hidden = !c.done;
    $('cd-renew').hidden = !c.done;
    cancelAnimationFrame(raf);
    clearTimeout(delay);
    if (!animate || prefersReducedMotion()) { drawRing(1); return; }
    drawRing(0);
    delay = setTimeout(() => {
      const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 1200); drawRing(p); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, 500);
  }

  const openForm = (fresh) => {
    const s = getSettings().countdown;
    const d = defaultSettings().countdown;
    startIn.value = fresh ? d.start : s.start;
    endIn.value = fresh ? d.end : s.end;
    err.textContent = '';
    form.hidden = false;
    startIn.focus();
  };

  clickable(card, () => {
    const { start, end } = getSettings().countdown;
    if (validateRange(start, end)) { openSheet('ring'); openForm(false); return; }
    openSheet('ring');
  });
  onSheetOpen('ring', () => { form.hidden = true; renderRing(true); });
  onSheetClose('ring', () => { cancelAnimationFrame(raf); clearTimeout(delay); });
  $('cd-edit').addEventListener('click', () => openForm(false));
  $('cd-renew').addEventListener('click', () => openForm(true));
  $('cd-cancel').addEventListener('click', () => { form.hidden = true; err.textContent = ''; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = validateRange(startIn.value, endIn.value);
    if (msg) { err.textContent = msg; return; }
    const s = getSettings();
    s.countdown = { start: startIn.value, end: endIn.value };
    if (saveSettings(s)) { form.hidden = true; renderCard(); renderRing(true); }
  });

  // 跨日時自動更新
  let last = todayISO();
  setInterval(() => { if (todayISO() !== last) { last = todayISO(); renderCard(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderCard(); });
  renderCard();
  return { render: renderCard };
}
