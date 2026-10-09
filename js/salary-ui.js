// 地獄模式薪水區：本月應領明細、即時跳表、到退休總額、加給快速開關
import { salarySummary } from './salary.js';
import { loadSalaryTable, getHell, saveHell } from './hell-data.js';
import { el } from './ui.js';

export const DISCLAIMER = '不含年終、考績獎金與扣款，僅供娛樂';
const fmt = (n, digits = 0) => n.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export async function initSalary(root, { onToggle } = {}) {
  const table = await loadSalaryTable();
  const badge = el('p', { class: 'badge', text: '範例', hidden: true });
  const earned = el('p', { class: 'hell-big', 'aria-live': 'off' });
  const rate = el('p', { class: 'muted' });
  const detail = el('ul');
  const toRetire = el('p');
  const toggles = el('fieldset', {}, el('legend', { text: '加給開關' }));
  const boxes = {};
  for (const [k, name] of [['research', '學術研究加給'], ['homeroom', '導師加給'], ['leader', '組長加給']]) {
    boxes[k] = el('input', { type: 'checkbox', id: `sal-${k}` });
    boxes[k].addEventListener('change', () => {
      const h = getHell();
      h.toggles[k] = boxes[k].checked;
      if (saveHell(h)) { onToggle?.(); render(); }
    });
    toggles.append(el('label', {}, boxes[k], ` ${name}`), ' ');
  }
  root.replaceChildren(
    el('h3', { text: '薪水跳表' }), badge, earned, rate, detail, toRetire, toggles,
    el('p', { class: 'disclaimer', text: DISCLAIMER }),
  );

  function render() {
    const h = getHell();
    if (!h) return;
    const s = salarySummary(table, h);
    const c = s.current;
    badge.hidden = !h.example;
    const since = h.tallyStart || `${new Date().getFullYear()}-01-01`;
    earned.textContent = `${since} 起已領 NT$ ${fmt(s.earned, 2)}`;
    rate.textContent = s.retired ? '已退休，跳表停止。' : `每秒約 NT$ ${fmt(s.perSecond, 4)}（本月應領 ÷ 本月總秒數）`;
    const lv = table.levels.find((l) => l.level === c.level);
    detail.replaceChildren(
      el('li', { text: `目前薪級：${lv.label}（${c.points} 點）` }),
      el('li', { text: `本薪 ${fmt(c.base)} 元` }),
      el('li', { text: `學術研究加給 ${fmt(c.research)} 元` }),
      el('li', { text: `導師加給 ${fmt(c.homeroom)} 元` }),
      el('li', { text: `組長加給 ${fmt(c.leader)} 元` }),
      el('li', { text: `本月應領 ${fmt(c.total)} 元` }),
    );
    toRetire.textContent = s.retired ? '已退休，恭喜。' : `從現在到退休還會領 NT$ ${fmt(s.toRetire)}（含晉級與年調薪率 ${h.annualRaise || 0}%）`;
    for (const k of Object.keys(boxes)) boxes[k].checked = !!h.toggles[k];
  }

  // 每秒更新；頁面隱藏或不在地獄模式時暫停，回來時直接用系統時間重算，不累積誤差
  setInterval(() => { if (!document.hidden && !root.hidden && !root.closest('[hidden]')) render(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  return { render };
}
