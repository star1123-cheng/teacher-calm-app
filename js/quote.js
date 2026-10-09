// 一日一句：作家句（使用者匯入）優先，原創句（內建）補位
import { KEYS, load, save, uid } from './storage.js';
import { parseCSV } from './csv.js';
import { pickToday } from './rotation.js';
import { todayISO } from './dates.js';
import { el, toast } from './ui.js';

export const ORIGINAL = '原創';
const LIMITS = { text: 500, author: 100, book: 200, page: 20 };

// 字串雜湊，讓內建原創句有穩定的 id
export function hashId(prefix, s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return prefix + (h >>> 0).toString(36);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// 解析使用者的句庫 CSV；existing 為已存在的句子（用來略過重複）
export function parseQuotesCSV(text, existing = [], makeId = uid) {
  const { records, error } = parseCSV(text);
  const result = { items: [], duplicates: 0, errors: [] };
  if (error) { result.errors.push(error); return result; }
  if (!records.length || norm(records[0].fields[0] || '') !== '句子') {
    result.errors.push({ line: 1, message: '第 1 行必須是標題列：句子,作者,書名,頁碼' });
    return result;
  }
  const seen = new Set(existing.map((q) => norm(q.text)));
  for (const { line, fields } of records.slice(1)) {
    const [text = '', author = '', book = '', page = '', ...extra] = fields.map((f) => f.trim());
    if (extra.some((x) => x !== '')) { result.errors.push({ line, message: `第 ${line} 行欄位超過 4 欄（句中有逗號時請用雙引號包住）` }); continue; }
    if (!text) { result.errors.push({ line, message: `第 ${line} 行缺少句子` }); continue; }
    if (!author) { result.errors.push({ line, message: `第 ${line} 行缺少作者（原創句請填「原創」）` }); continue; }
    const tooLong = Object.entries({ text, author, book, page }).find(([k, v]) => v.length > LIMITS[k]);
    if (tooLong) { result.errors.push({ line, message: `第 ${line} 行內容太長` }); continue; }
    const key = norm(text);
    if (seen.has(key)) { result.duplicates++; continue; }
    seen.add(key);
    result.items.push({ id: makeId(), text, author, book, page });
  }
  return result;
}

export function toGroups(userQuotes, originals) {
  const all = [...userQuotes, ...originals];
  return [
    all.filter((q) => q.author !== ORIGINAL).map((q) => q.id),
    all.filter((q) => q.author === ORIGINAL).map((q) => q.id),
  ];
}

let originalsCache = null;
export async function loadOriginals() {
  if (originalsCache) return originalsCache;
  try {
    const res = await fetch('seed/quotes-original.csv');
    const { records } = parseCSV(await res.text());
    originalsCache = records.slice(1)
      .filter((r) => r.fields[0]?.trim())
      .map((r) => ({ id: hashId('o:', r.fields[0].trim()), text: r.fields[0].trim(), author: ORIGINAL, book: '', page: '' }));
  } catch {
    originalsCache = [];
  }
  return originalsCache;
}

export function renderQuoteCard(box, q) {
  if (!q) { box.replaceChildren(el('p', { class: 'muted', text: '句庫是空的。' })); return; }
  const meta = [q.author, q.book ? `《${q.book}》` : null, q.page ? `第 ${q.page} 頁` : null].filter(Boolean).join('　');
  box.replaceChildren(
    el('blockquote', {}, el('p', { class: 'q-text', text: q.text })),
    el('p', { class: 'q-meta', text: `—— ${meta}` }),
  );
}

export async function initQuote(root = document.getElementById('quote')) {
  const box = el('div', { 'aria-live': 'polite' });
  root.append(box);

  async function render() {
    const user = load(KEYS.quotes, []);
    const originals = await loadOriginals();
    const groups = toGroups(user, originals);
    const prev = load(KEYS.quoteState, null);
    const state = pickToday(prev, groups, todayISO());
    if (state !== prev) save(KEYS.quoteState, state);
    const byId = new Map([...user, ...originals].map((q) => [q.id, q]));
    renderQuoteCard(box, state.today && byId.get(state.today.id));
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  await render();
  initQuoteImport(render);
}

// 設定頁：匯入作家句 CSV（先預覽，確認才寫入）
function initQuoteImport(onChange) {
  const sec = document.getElementById('quote-import');
  if (!sec) return;
  const count = el('p');
  const input = el('input', { type: 'file', accept: '.csv,text/csv' });
  const preview = el('div', { 'aria-live': 'polite' });
  sec.append(
    el('p', { text: '欄位：句子,作者,書名,頁碼（UTF-8）。書名與頁碼可空白；句中有逗號、換行時整格用雙引號包住。' }),
    el('p', {}, el('a', { href: 'seed/quotes-template.csv', download: 'quotes-template.csv', text: '下載 CSV 範本' })),
    count,
    el('label', { class: 'file-btn' }, '選擇 CSV 檔', input),
    preview,
  );
  const refreshCount = () => { count.textContent = `目前已匯入 ${load(KEYS.quotes, []).length} 句。`; };
  refreshCount();

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('CSV 檔太大（上限 2 MB）。'); return; }
    const existing = load(KEYS.quotes, []);
    const r = parseQuotesCSV(await file.text(), existing);
    const parts = [
      el('p', { text: `可匯入 ${r.items.length} 筆，重複略過 ${r.duplicates} 筆，錯誤 ${r.errors.length} 筆。` }),
    ];
    if (r.items.length) {
      parts.push(el('p', { text: '前 3 筆預覽：' }), el('ol', {}, r.items.slice(0, 3).map((q) => el('li', { text: `${q.text}（${[q.author, q.book, q.page].filter(Boolean).join('，')}）` }))));
    }
    if (r.errors.length) parts.push(el('ul', { class: 'error' }, r.errors.slice(0, 20).map((e) => el('li', { text: e.message }))));
    const actions = el('p');
    if (r.items.length) {
      actions.append(
        el('button', { type: 'button', text: `確認匯入 ${r.items.length} 筆`, onclick: () => {
          if (save(KEYS.quotes, [...existing, ...r.items])) {
            toast(`已匯入 ${r.items.length} 句。`);
            preview.replaceChildren();
            refreshCount();
            onChange();
          }
        } }),
      );
    }
    actions.append(el('button', { type: 'button', text: '取消', onclick: () => preview.replaceChildren() }));
    preview.replaceChildren(...parts, actions);
  });
}
