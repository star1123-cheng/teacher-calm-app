// 地獄模式：彩蛋進入、首次設定表單、退休倒數、薪水與毒雞湯
import { loadSalaryTable, getHell, saveHell, exampleHell, validateHell, retireCountdown, EDU_KEYS, MAX_ALLOWANCE } from './hell-data.js';
import { createTapCounter, TAPS } from './egg.js';
import { switchMode, isBusy } from './mode.js';
import { openSheet, closeSheet, onSheetOpen, onSheetClose } from './sheet.js';
import { todayISO } from './dates.js';
import { el, toast, prefersReducedMotion } from './ui.js';
import { playBurn } from './burn.js';
import { initSalary } from './salary-ui.js';
import { initSoup } from './soup.js';

const renderers = new Set();
export function onHellChange(fn) { renderers.add(fn); }
const notify = () => renderers.forEach((fn) => fn(getHell()));

// 設定表單（首次進入、薪水明細、設定頁共用）
export async function buildHellForm(container, { allowSkip = false, onDone, idPrefix = 'hf' } = {}) {
  const table = await loadSalaryTable();
  const h = getHell() || exampleHell();
  const field = (label, input) => el('p', { class: 'field' }, el('label', { for: input.id, text: label }), input);

  const retire = el('input', { type: 'date', id: `${idPrefix}-retire`, required: true, value: h.example ? '' : h.retireDate });
  const edu = el('select', { id: `${idPrefix}-edu` }, EDU_KEYS.map((k) => el('option', { value: k, text: table.education[k].label })));
  edu.value = h.edu;
  const level = el('select', { id: `${idPrefix}-level` }, table.levels.map((l) => el('option', { value: String(l.level), text: `${l.label}（${l.points} 點）` })));
  level.value = String(h.level);

  const allowance = (key, name, hintText) => {
    const on = el('input', { type: 'checkbox', id: `${idPrefix}-${key}-on`, checked: h.toggles[key] });
    const amt = el('input', { type: 'number', id: `${idPrefix}-${key}-amt`, min: '0', max: String(MAX_ALLOWANCE), step: '1', inputmode: 'numeric', placeholder: hintText });
    if (h.overrides[key] != null) amt.value = String(h.overrides[key]);
    const row = el('div', { class: 'allowance-row' },
      el('label', { class: 'check', for: on.id }, on, name),
      el('label', { for: amt.id, class: 'small', text: '金額' }), amt);
    return { row, on, amt };
  };
  const raise = el('input', { type: 'number', id: `${idPrefix}-raise`, min: '-10', max: '10', step: '0.1', inputmode: 'decimal' });
  raise.value = String(h.annualRaise ?? 0);
  const promo = el('input', { type: 'text', id: `${idPrefix}-promo`, inputmode: 'numeric', placeholder: '08-01', maxlength: '5' });
  promo.value = h.promoteDate || '08-01';
  const tally = el('input', { type: 'date', id: `${idPrefix}-tally` });
  tally.value = h.tallyStart || `${new Date().getFullYear()}-01-01`;
  const research = allowance('research', '學術研究加給', '依薪額表');
  const homeroom = allowance('homeroom', '導師加給', String(table.homeroomAllowance.amount));
  const leader = allowance('leader', '組長加給', '依薪額表');

  const err = el('p', { class: 'error', role: 'alert' });
  const form = el('form', { class: 'form hell-form' },
    allowSkip ? el('p', { class: 'small', text: '第一次來？填一下資料，數字只存在這台裝置。也可以先跳過，用範例看看。' }) : null,
    field('預計退休日', retire),
    field('學歷', edu),
    field('目前薪級', level),
    el('fieldset', {}, el('legend', { text: '加給（金額留白＝依薪額表）' }), research.row, homeroom.row, leader.row),
    field('假設年調薪率（%）', raise),
    field('每年晉級日（月-日）', promo),
    field('已領累計起算日', tally),
    err,
    el('p', { class: 'btn-row' },
      el('button', { type: 'submit', class: 'btn btn-fill', text: '儲存' }),
      allowSkip ? el('button', { type: 'button', class: 'btn btn-ghost', text: '先跳過，用範例', onclick: () => {
        if (saveHell(exampleHell())) { notify(); onDone?.(); }
      } }) : null),
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
      notify();
      onDone?.();
    }
  });
  container.replaceChildren(form);
}

function renderRetire(h) {
  const $ = (id) => document.getElementById(id);
  const c = retireCountdown(h.retireDate, todayISO());
  $('retire-badge').hidden = !h.example;
  $('hell-retire').classList.toggle('is-retired', c.retired);
  $('retire-days').textContent = c.retired ? '已退休，恭喜' : c.days.toLocaleString('zh-TW');
  $('retire-unit').hidden = c.retired;
  $('retire-ym').textContent = c.retired ? `退休日：${h.retireDate}` : `約 ${c.years} 年 ${c.months} 個月・${h.retireDate}`;
}

const HAPPY_TOASTS = { 1: '辛苦了，好好休息', 2: '嗯，真的辛苦了' };

export function initHell() {
  const tired = document.getElementById('btn-tired');
  const happy = document.getElementById('btn-happy');
  let salaryUI = null;
  let soupUI = null;

  const render = async (h) => {
    if (!h) return;
    renderRetire(h);
    if (!salaryUI) salaryUI = await initSalary({ onEdit: openEdit });
    else salaryUI.render();
    if (!soupUI) soupUI = await initSoup();
  };
  onHellChange(render);

  // 薪水明細面板裡的「修改資料」
  function openEdit(container) {
    buildHellForm(container, { idPrefix: 'hf-edit', onDone: () => salaryUI?.closeEdit() });
  }

  onSheetOpen('setup', () => buildHellForm(document.getElementById('hell-setup'), {
    allowSkip: true, idPrefix: 'hf-setup', onDone: () => closeSheet(),
  }));

  // 關掉首次設定但沒選擇時，視同跳過，以範例顯示
  onSheetClose('setup', () => {
    if (!getHell() && saveHell(exampleHell())) notify();
  });

  tired.addEventListener('click', () => switchMode('calm', () => happy.focus()));

  // 【我很快樂】：5 秒內連點 3 次翻到地獄模式；第 2 次起微提示
  const counter = createTapCounter();
  let hintTimer;
  let burning = false;

  // 進入地獄模式：播燒幕轉場，布幕蓋住時在底下換面並準備好資料；減少動態時直接切換
  async function enterHell() {
    const h = getHell();
    const done = () => { if (!getHell()) openSheet('setup'); else tired.focus(); };
    if (prefersReducedMotion()) {
      switchMode('hell', async () => { if (h) await render(h); done(); });
      return;
    }
    burning = true;
    try {
      await playBurn({ onCovered: () => { switchMode('hell', null, { instant: true }); if (h) render(h); } });
    } finally {
      burning = false;
    }
    if (document.documentElement.dataset.mode !== 'hell') switchMode('hell', null, { instant: true });
    done();
  }

  happy.addEventListener('click', () => {
    if (isBusy() || burning) return;
    const r = counter.tap();
    happy.classList.remove('hint', 'hint-strong');
    if (r.hint) {
      void happy.offsetWidth; // 重新觸發抖動動畫
      happy.classList.add(r.count >= TAPS - 1 ? 'hint-strong' : 'hint');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => happy.classList.remove('hint', 'hint-strong'), 3000);
    }
    if (r.triggered) {
      enterHell();
      return;
    }
    toast(HAPPY_TOASTS[r.count] || `再點 ${TAPS - r.count} 下⋯`, 1600);
  });
  happy.addEventListener('animationend', () => happy.classList.remove('hint', 'hint-strong'));

  // 已有資料時先準備好地獄模式畫面（翻面時不會空白）
  const h = getHell();
  if (h) render(h);
}

export { notify as refreshHell };
