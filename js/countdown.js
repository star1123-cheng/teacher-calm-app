// 時光倒數：固定終點日為主、進度條為輔
import { getSettings, saveSettings, defaultSettings } from './storage.js';
import { isISODate, daysBetween, todayISO } from './dates.js';
import { el } from './ui.js';

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

export function initCountdown(root = document.getElementById('countdown')) {
  const days = el('p', { class: 'cd-days' });
  const bar = el('progress', { max: 100, value: 0, 'aria-label': '已過進度' });
  const pct = el('p', { class: 'muted' });
  const doneBox = el('div', { hidden: true },
    el('p', { class: 'cd-days', text: '已完成' }),
    el('p', { text: '這一段路走完了，辛苦了。好好休息，再出發。' }),
  );
  const startIn = el('input', { type: 'date', id: 'cd-start', required: true });
  const endIn = el('input', { type: 'date', id: 'cd-end', required: true });
  const err = el('p', { class: 'error', role: 'alert' });
  const form = el('form', { class: 'cd-form', hidden: true },
    el('label', { for: 'cd-start', text: '起點日' }), startIn,
    el('label', { for: 'cd-end', text: '終點日' }), endIn,
    el('button', { type: 'submit', text: '儲存' }),
    el('button', { type: 'button', text: '取消', onclick: () => { form.hidden = true; err.textContent = ''; } }),
    err,
  );
  const editBtn = el('button', { type: 'button', text: '修改日期' });
  const renewBtn = el('button', { type: 'button', text: '設定新的倒數' });
  doneBox.append(renewBtn);
  const live = el('div', {}, days, bar, pct);
  root.append(live, doneBox, editBtn, form);

  const openForm = (fresh) => {
    const s = getSettings().countdown;
    const d = defaultSettings().countdown;
    startIn.value = fresh ? d.start : s.start;
    endIn.value = fresh ? d.end : s.end;
    err.textContent = '';
    form.hidden = false;
    startIn.focus();
  };
  editBtn.addEventListener('click', () => openForm(false));
  renewBtn.addEventListener('click', () => openForm(true));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = validateRange(startIn.value, endIn.value);
    if (msg) { err.textContent = msg; return; }
    const s = getSettings();
    s.countdown = { start: startIn.value, end: endIn.value };
    if (saveSettings(s)) { form.hidden = true; render(); }
  });

  function render() {
    const { start, end } = getSettings().countdown;
    const c = computeCountdown(start, end, todayISO());
    live.hidden = c.done;
    doneBox.hidden = !c.done;
    days.textContent = `還有 ${c.remaining} 天`;
    bar.value = Math.round(c.progress * 100);
    pct.textContent = `${start} 到 ${end}，已過 ${Math.round(c.progress * 100)}%`;
  }

  // 跨日時自動更新
  let last = todayISO();
  setInterval(() => { if (todayISO() !== last) { last = todayISO(); render(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  return { render };
}
