// 地獄模式：彩蛋進入、首次設定表單、退休倒數（薪水 M4、毒雞湯 M5）
import { loadSalaryTable, getHell, saveHell, exampleHell, validateHell, retireCountdown, EDU_KEYS, MAX_ALLOWANCE } from './hell-data.js';
import { createTapCounter } from './egg.js';
import { switchMode } from './mode.js';
import { todayISO } from './dates.js';
import { el, toast } from './ui.js';
import { initSalary } from './salary-ui.js';

const renderers = new Set();
export function onHellChange(fn) { renderers.add(fn); }
const notify = () => renderers.forEach((fn) => fn(getHell()));

// 設定表單（首次進入與設定頁共用）
export async function buildHellForm(container, { allowSkip = false, onDone } = {}) {
  const table = await loadSalaryTable();
  const h = getHell() || exampleHell();
  const uidp = allowSkip ? 'hf1' : 'hf2';
  const field = (label, input) => el('p', {}, el('label', { for: input.id, text: label }), ' ', input);

  const retire = el('input', { type: 'date', id: `${uidp}-retire`, required: true, value: h.example ? '' : h.retireDate });
  const edu = el('select', { id: `${uidp}-edu` }, EDU_KEYS.map((k) => el('option', { value: k, text: table.education[k].label })));
  edu.value = h.edu;
  const level = el('select', { id: `${uidp}-level` }, table.levels.map((l) => el('option', { value: String(l.level), text: `${l.label}（${l.points} 點）` })));
  level.value = String(h.level);

  const allowance = (key, name, hintText) => {
    const on = el('input', { type: 'checkbox', id: `${uidp}-${key}-on`, checked: h.toggles[key] });
    const amt = el('input', { type: 'number', id: `${uidp}-${key}-amt`, min: '0', max: String(MAX_ALLOWANCE), step: '1', inputmode: 'numeric', placeholder: hintText });
    if (h.overrides[key] != null) amt.value = String(h.overrides[key]);
    const row = el('p', {}, on, el('label', { for: on.id, text: ` ${name}` }), ' ',
      el('label', { for: amt.id, class: 'visually-hidden', text: `${name}金額（留白＝依薪額表）` }), amt);
    return { row, on, amt };
  };
  const raise = el('input', { type: 'number', id: `${uidp}-raise`, min: '-10', max: '10', step: '0.1', inputmode: 'decimal' });
  raise.value = String(h.annualRaise ?? 0);
  const promo = el('input', { type: 'text', id: `${uidp}-promo`, inputmode: 'numeric', placeholder: '08-01', maxlength: '5', size: '5' });
  promo.value = h.promoteDate || '08-01';
  const tally = el('input', { type: 'date', id: `${uidp}-tally` });
  tally.value = h.tallyStart || `${new Date().getFullYear()}-01-01`;
  const research = allowance('research', '學術研究加給', '依薪額表');
  const homeroom = allowance('homeroom', '導師加給', String(table.homeroomAllowance.amount));
  const leader = allowance('leader', '組長加給', '依薪額表');

  const err = el('p', { class: 'error', role: 'alert' });
  const form = el('form', { class: 'hell-form' },
    allowSkip ? el('p', { text: '第一次來？填一下資料，數字只存在這台裝置。也可以先跳過，用範例看看。' }) : null,
    field('預計退休日', retire),
    field('學歷', edu),
    field('目前薪級', level),
    el('fieldset', {}, el('legend', { text: '加給（金額留白＝依薪額表）' }), research.row, homeroom.row, leader.row),
    field('假設年調薪率（%）', raise),
    field('每年晉級日（月-日）', promo),
    field('已領累計起算日', tally),
    el('p', {},
      el('button', { type: 'submit', text: '儲存' }),
      allowSkip ? el('button', { type: 'button', text: '先跳過，用範例', onclick: () => {
        if (saveHell(exampleHell())) { container.replaceChildren(); notify(); onDone?.(); }
      } }) : null),
    err,
  );

  const amount = (inp) => (inp.value.trim() === '' ? null : Number(inp.value));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = {
      ...h,
      example: false,
      retireDate: retire.value,
      edu: edu.value,
      level: Number(level.value),
      toggles: { research: research.on.checked, homeroom: homeroom.on.checked, leader: leader.on.checked },
      overrides: { research: amount(research.amt), homeroom: amount(homeroom.amt), leader: amount(leader.amt) },
      annualRaise: raise.value.trim() === '' ? 0 : Number(raise.value),
      promoteDate: promo.value.trim(),
      tallyStart: tally.value,
    };
    const msg = validateHell(next);
    if (msg) { err.textContent = `${msg}。`; return; }
    if (saveHell(next)) {
      toast('已儲存。');
      if (allowSkip) container.replaceChildren();
      notify();
      onDone?.();
    }
  });
  container.replaceChildren(form);
}

function renderRetire(box, h) {
  const c = retireCountdown(h.retireDate, todayISO());
  const parts = [];
  if (h.example) parts.push(el('p', { class: 'badge', text: '範例' }));
  if (c.retired) parts.push(el('p', { class: 'hell-big', text: '已退休，恭喜' }));
  else {
    parts.push(el('p', { class: 'hell-big', text: `離退休還有 ${c.days} 天` }));
    if (c.years || c.months) parts.push(el('p', { text: `約 ${c.years} 年 ${c.months} 個月` }));
  }
  parts.push(el('p', { class: 'muted', text: `預計退休日：${h.retireDate}` }));
  box.replaceChildren(...parts);
}

export function initHell() {
  const view = document.getElementById('view-hell');
  const setup = el('div', { id: 'hell-setup' });
  const retire = el('section', { id: 'hell-retire', 'aria-label': '退休倒數' });
  const salary = el('section', { id: 'hell-salary', 'aria-label': '薪水' });
  const soup = el('section', { id: 'hell-soup', 'aria-label': '毒雞湯' });
  const editBox = el('div');
  const editBtn = el('button', { type: 'button', text: '修改資料' });
  const tired = el('button', { type: 'button', id: 'btn-tired', class: 'mode-btn', text: '我真的累了' });
  view.append(setup, retire, salary, soup, el('p', {}, editBtn), editBox, el('p', {}, tired));

  let salaryUI = null;
  const render = async (h) => {
    const has = !!h;
    retire.hidden = !has; salary.hidden = !has; soup.hidden = !has;
    if (!has) return;
    renderRetire(retire, h);
    if (!salaryUI) salaryUI = await initSalary(salary, { onToggle: notify });
    else salaryUI.render();
  };
  onHellChange(render);

  editBtn.addEventListener('click', () => {
    if (editBox.childNodes.length) { editBox.replaceChildren(); return; }
    buildHellForm(editBox, { onDone: () => editBox.replaceChildren() });
  });
  tired.addEventListener('click', () => switchMode('quiet', () => document.getElementById('btn-happy').focus()));

  // 寧靜模式的【我很快樂】按鈕
  const happy = document.getElementById('btn-happy');
  const counter = createTapCounter();
  let hintTimer;
  happy.addEventListener('click', () => {
    const r = counter.tap();
    happy.classList.remove('hint');
    clearTimeout(hintTimer);
    if (r.hint) {
      void happy.offsetWidth; // 重新觸發抖動動畫
      happy.classList.add('hint');
      hintTimer = setTimeout(() => happy.classList.remove('hint'), 3000);
    }
    if (r.triggered) {
      switchMode('hell', async () => {
        editBox.replaceChildren();
        const h = getHell();
        render(h);
        if (!h) await buildHellForm(setup, { allowSkip: true });
        else setup.replaceChildren();
        tired.focus();
      });
    }
  });
}

export { notify as refreshHell };
