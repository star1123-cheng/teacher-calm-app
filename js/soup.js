// 毒雞湯：輪替規則同一日一句（隨機、一輪不重複、同日同句），抽卡面板可【再抽一張】
import { KEYS, load, save } from './storage.js';
import { parseCSV } from './csv.js';
import { pickToday, advance } from './rotation.js';
import { hashId } from './quote.js';
import { todayISO } from './dates.js';
import { prefersReducedMotion } from './ui.js';
import { openSheet, closeSheet, onSheetOpen, onSheetClose, clickable } from './sheet.js';

let soupsCache = null;
async function loadSoups() {
  if (soupsCache) return soupsCache;
  try {
    const { records } = parseCSV(await (await fetch('seed/toxic-soup.csv')).text());
    soupsCache = records.slice(1).map((r) => (r.fields[0] || '').trim()).filter(Boolean)
      .map((text) => ({ id: hashId('s:', text), text }));
  } catch {
    soupsCache = [];
  }
  return soupsCache;
}

export async function initSoup() {
  const soups = await loadSoups();
  const index = new Map(soups.map((s, i) => [s.id, i]));
  const groups = [soups.map((s) => s.id)];
  const $ = (id) => document.getElementById(id);
  const card = $('draw-card');
  let timer;

  const show = (state) => {
    const i = state.today ? index.get(state.today.id) : undefined;
    $('draw-text').textContent = i == null ? '雞湯熬乾了。' : soups[i].text;
    $('draw-no').textContent = i == null ? '毒雞湯' : `毒雞湯 No.${String(i + 1).padStart(2, '0')}`;
  };
  const today = () => {
    const prev = load(KEYS.soupState, null);
    const state = pickToday(prev, groups, todayISO());
    if (state !== prev) save(KEYS.soupState, state);
    return state;
  };

  // 開啟：先顯示牌背，0.5 秒後翻開今天那一句
  onSheetOpen('draw', () => {
    clearTimeout(timer);
    card.classList.remove('flipped');
    show(today());
    timer = setTimeout(() => card.classList.add('flipped'), prefersReducedMotion() ? 0 : 500);
  });
  onSheetClose('draw', () => clearTimeout(timer));

  // 再抽一張：翻回牌背、換句再翻開（一輪內不重複）
  $('draw-again').addEventListener('click', () => {
    const next = () => {
      const state = advance(load(KEYS.soupState, null) || {}, groups, todayISO());
      save(KEYS.soupState, state);
      show(state);
    };
    clearTimeout(timer);
    if (prefersReducedMotion()) { next(); return; }
    card.classList.remove('flipped');
    timer = setTimeout(() => { next(); card.classList.add('flipped'); }, 650);
  });
  $('draw-close').addEventListener('click', closeSheet);
  clickable($('hell-deck'), () => openSheet('draw'));
  return { render: () => show(today()) };
}
