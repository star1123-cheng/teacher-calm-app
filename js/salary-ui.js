// 地獄模式薪水：卡片顯示已領累計（每秒跳動）；點開明細看各項加給、開關與到退休總額
import { salarySummary } from './salary.js';
import { loadSalaryTable, getHell, saveHell } from './hell-data.js';
import { openSheet, onSheetOpen, onSheetClose, clickable, currentSheet } from './sheet.js';
import { el } from './ui.js';

export const DISCLAIMER = '不含年終、考績獎金與扣款，僅供娛樂';
const fmt = (n, digits = 0) => n.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const md = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`; };

export async function initSalary({ onEdit } = {}) {
  const table = await loadSalaryTable();
  const $ = (id) => document.getElementById(id);
  const card = $('hell-salary');
  const detail = $('salary-detail');

  // 明細面板
  const badge = el('p', {}, el('span', { class: 'badge', text: '範例：跳過設定時的示意數字' }));
  const list = el('ul', { class: 'pay-list' });
  const toRetire = el('p');
  const toggles = el('fieldset', {}, el('legend', { text: '加給開關（立即更新）' }));
  const boxes = {};
  for (const [k, name] of [['research', '學術研究加給'], ['homeroom', '導師加給'], ['leader', '組長加給']]) {
    boxes[k] = el('input', { type: 'checkbox', id: `sal-${k}` });
    boxes[k].addEventListener('change', () => {
      const h = getHell();
      h.toggles[k] = boxes[k].checked;
      if (saveHell(h)) render();
    });
    toggles.append(el('label', { class: 'check', for: `sal-${k}` }, boxes[k], name));
  }
  const editBox = el('div');
  const editBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '修改資料' });
  editBtn.addEventListener('click', () => {
    if (editBox.childNodes.length) { closeEdit(); return; }
    editBtn.textContent = '收起表單';
    onEdit?.(editBox);
  });
  function closeEdit() { editBox.replaceChildren(); editBtn.textContent = '修改資料'; }
  detail.replaceChildren(badge, list, toRetire, toggles, el('p', { class: 'disclaimer', text: DISCLAIMER }), el('p', { class: 'btn-row' }, editBtn), editBox);

  function render() {
    const h = getHell();
    if (!h) return;
    const s = salarySummary(table, h);
    const c = s.current;
    const since = h.tallyStart || `${new Date().getFullYear()}-01-01`;
    // 卡片
    $('salary-label').textContent = `已領累計（自 ${md(since)}）`;
    $('salary-badge').hidden = !h.example;
    $('salary-earned').textContent = fmt(s.earned, 2);
    $('salary-monthly').textContent = `本月應領 NT$${fmt(c.total)}`;
    $('salary-persec').textContent = s.retired ? '已退休，跳表停止' : `每秒 ${s.perSecond.toFixed(4)} 元`;
    // 明細（面板開著才更新，省電）
    if (currentSheet() !== 'salary') return;
    badge.hidden = !h.example;
    const lv = table.levels.find((l) => l.level === c.level);
    const row = (name, v, cls) => el('li', { class: cls }, el('span', { text: name }), el('span', { text: `${fmt(v)} 元` }));
    list.replaceChildren(
      el('li', {}, el('span', { text: '目前薪級' }), el('span', { text: `${lv.label}（${c.points} 點）` })),
      row('本薪', c.base), row('學術研究加給', c.research), row('導師加給', c.homeroom), row('組長加給', c.leader),
      row('本月應領', c.total, 'total'),
    );
    toRetire.textContent = s.retired ? '已退休，恭喜。' : `從現在到退休還會領 NT$ ${fmt(s.toRetire)}（含晉級與年調薪率 ${h.annualRaise || 0}%）`;
    for (const k of Object.keys(boxes)) boxes[k].checked = !!h.toggles[k];
  }

  clickable(card, () => openSheet('salary'));
  onSheetOpen('salary', render);
  onSheetClose('salary', closeEdit);

  // 每秒更新；頁面隱藏或不在地獄模式時暫停，回來時直接用系統時間重算，不累積誤差
  setInterval(() => { if (!document.hidden && document.documentElement.dataset.mode === 'hell') render(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  return { render, closeEdit };
}
