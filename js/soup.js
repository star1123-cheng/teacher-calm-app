// 毒雞湯：輪替規則同一日一句（隨機、一輪不重複、同日同句），另可【再來一句】
import { KEYS, load, save } from './storage.js';
import { parseCSV } from './csv.js';
import { pickToday, advance } from './rotation.js';
import { hashId } from './quote.js';
import { todayISO } from './dates.js';
import { el } from './ui.js';

let soupsCache = null;
async function loadSoups() {
  if (soupsCache) return soupsCache;
  try {
    const { records } = parseCSV(await (await fetch('seed/hell-soup.csv')).text());
    soupsCache = records.slice(1).map((r) => (r.fields[0] || '').trim()).filter(Boolean)
      .map((text) => ({ id: hashId('s:', text), text }));
  } catch {
    soupsCache = [];
  }
  return soupsCache;
}

export async function initSoup(root) {
  const soups = await loadSoups();
  const byId = new Map(soups.map((s) => [s.id, s]));
  const groups = [soups.map((s) => s.id)];
  const text = el('p', { class: 'soup-text', 'aria-live': 'polite' });
  const more = el('button', { type: 'button', text: '再來一句' });
  root.replaceChildren(el('h3', { text: '今日毒雞湯' }), text, more);

  const show = (state) => {
    text.textContent = state.today ? byId.get(state.today.id)?.text ?? '' : '雞湯熬乾了。';
  };
  const render = () => {
    const prev = load(KEYS.soupState, null);
    const state = pickToday(prev, groups, todayISO());
    if (state !== prev) save(KEYS.soupState, state);
    show(state);
  };
  more.addEventListener('click', () => {
    const state = advance(load(KEYS.soupState, null) || {}, groups, todayISO());
    save(KEYS.soupState, state);
    show(state);
  });
  render();
  return { render };
}
