// 工作紀要：新增、編輯、刪除、勾選、篩選、複製成文字
import { KEYS, load, save, uid } from './storage.js';
import { todayISO, isISODate } from './dates.js';
import { el, toast } from './ui.js';
import { openSheet, onSheetOpen } from './sheet.js';

// 預設分類；也可以自己輸入，輸入過的分類會自動出現在選單與篩選裡
export const TAGS = ['教學', '行政'];
export const MAX_TEXT = 1000;
export const MAX_TAG = 10;
const CUSTOM = '__custom__';

// 去掉前後空白、控制字元與 [ ]（複製成文字時用 [分類] 標示）
export function cleanTag(tag) {
  return typeof tag === 'string' ? tag.replace(/[\u0000-\u001f[\]]/g, '').trim() : '';
}

// 預設分類＋紀要裡用過的分類，不重複
export function allTags(notes) {
  return [...new Set([...TAGS, ...notes.map((n) => cleanTag(n.tag)).filter(Boolean)])];
}

// 依日期倒序；同一天保留原本順序（新增的排在前面）
export function sortNotes(notes) {
  return notes.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function filterNotes(notes, { tag = 'all', status = 'all' } = {}) {
  return notes.filter((n) => (tag === 'all' || n.tag === tag)
    && (status === 'all' || (status === 'done' ? n.done : !n.done)));
}

export function notesToText(notes) {
  return notes.map((n) => `${n.date} [${n.tag}] ${n.text.replace(/\s*\n\s*/g, ' ')}${n.done ? ' ✓' : ''}`).join('\n');
}

export function validateNote({ date, tag, text }) {
  if (!text || !text.trim()) return '請輸入內容。';
  if (text.length > MAX_TEXT) return `內容請在 ${MAX_TEXT} 字以內。`;
  if (!isISODate(date)) return '請選擇日期。';
  const t = cleanTag(tag);
  if (!t) return '請選擇或輸入分類。';
  if (t.length > MAX_TAG) return `分類請在 ${MAX_TAG} 字以內。`;
  return null;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { readonly: true });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// 首頁卡片：今日（日期為今天）未完成的筆數
export function pendingToday(notes, today) {
  return notes.filter((n) => n.date === today && !n.done).length;
}

export function initNotes(root = document.getElementById('view-notes')) {
  let editingId = null;
  const dateIn = el('input', { type: 'date', id: 'note-date', required: true });
  const tagIn = el('select', { id: 'note-tag' });
  const customIn = el('input', { type: 'text', id: 'note-tag-custom', maxlength: String(MAX_TAG), placeholder: '例如：社團、研習' });
  const textIn = el('textarea', { id: 'note-text', rows: 3, maxlength: String(MAX_TEXT), required: true });
  const submit = el('button', { type: 'submit', class: 'btn', text: '新增', disabled: true });
  const cancel = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消編輯', hidden: true });
  const err = el('p', { class: 'error', role: 'alert' });
  const field = (label, input, full) => el('p', { class: full ? 'field field-full' : 'field' }, el('label', { for: input.id, text: label }), input);
  const form = el('form', { class: 'note-form' },
    field('日期', dateIn), field('分類', tagIn), field('自訂分類', customIn), field('內容', textIn, true),
    el('p', { class: 'btn-row' }, submit, cancel), err,
  );

  const fTag = el('select', { id: 'filter-tag' });
  const fStatus = el('select', { id: 'filter-status' },
    el('option', { value: 'all', text: '全部狀態' }), el('option', { value: 'todo', text: '未完成' }), el('option', { value: 'done', text: '已完成' }));
  const copyBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '複製成文字' });
  const list = el('ul', { class: 'note-list' });
  const empty = el('p', { class: 'small' });

  root.append(form,
    el('div', { class: 'note-filters' },
      field('篩選分類', fTag), field('篩選狀態', fStatus), el('p', { class: 'field' }, copyBtn)),
    empty, list);

  const getAll = () => load(KEYS.notes, []);
  const currentFilter = () => ({ tag: fTag.value, status: fStatus.value });
  const visible = () => sortNotes(filterNotes(getAll(), currentFilter()));
  const tileCount = document.getElementById('notes-pending');
  const customField = customIn.parentElement;

  // 重建分類選單，盡量保留原本選的值
  function fillTags() {
    const tags = allTags(getAll());
    const keep = tagIn.value;
    tagIn.replaceChildren(...tags.map((t) => el('option', { value: t, text: t })), el('option', { value: CUSTOM, text: '＋ 自己輸入…' }));
    tagIn.value = keep && (keep === CUSTOM || tags.includes(keep)) ? keep : TAGS[0];
    const fKeep = fTag.value;
    fTag.replaceChildren(el('option', { value: 'all', text: '全部分類' }), ...tags.map((t) => el('option', { value: t, text: t })));
    fTag.value = tags.includes(fKeep) ? fKeep : 'all';
    showCustom();
  }

  function showCustom() { customField.hidden = tagIn.value !== CUSTOM; }

  function resetForm() {
    editingId = null;
    dateIn.value = todayISO();
    tagIn.value = TAGS[0];
    customIn.value = '';
    showCustom();
    textIn.value = '';
    submit.textContent = '新增';
    submit.disabled = true;
    cancel.hidden = true;
    err.textContent = '';
  }

  function render() {
    if (tileCount) tileCount.textContent = String(pendingToday(getAll(), todayISO()));
    fillTags();
    const items = visible();
    empty.textContent = items.length ? '' : '沒有符合的紀要。';
    list.replaceChildren(...items.map((n) => {
      const cb = el('input', { type: 'checkbox', checked: n.done, 'aria-label': `標示完成：${n.text.slice(0, 20)}` });
      cb.addEventListener('change', () => update(n.id, { done: cb.checked }));
      return el('li', { class: n.done ? 'done' : null },
        cb,
        el('span', { class: 'note-main' },
          el('span', { class: 'note-sub', text: `${n.date}　[${n.tag}]` }),
          el('span', { class: 'note-text', text: n.text })),
        el('span', { class: 'note-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '編輯', onclick: () => startEdit(n) }),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '刪除', onclick: () => remove(n) })),
      );
    }));
  }

  function update(id, patch) {
    const all = getAll().map((n) => (n.id === id ? { ...n, ...patch } : n));
    if (save(KEYS.notes, all)) render();
  }

  function remove(n) {
    if (!confirm(`確定刪除這筆紀要？
${n.date} [${n.tag}] ${n.text.slice(0, 40)}`)) return;
    if (save(KEYS.notes, getAll().filter((x) => x.id !== n.id))) {
      if (editingId === n.id) resetForm();
      render();
    }
  }

  function startEdit(n) {
    editingId = n.id;
    dateIn.value = n.date;
    tagIn.value = n.tag;
    showCustom();
    textIn.value = n.text;
    submit.textContent = '儲存修改';
    submit.disabled = false;
    cancel.hidden = false;
    textIn.focus();
  }

  textIn.addEventListener('input', () => { submit.disabled = !textIn.value.trim(); });
  tagIn.addEventListener('change', () => { showCustom(); if (tagIn.value === CUSTOM) customIn.focus(); });
  cancel.addEventListener('click', resetForm);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tag = cleanTag(tagIn.value === CUSTOM ? customIn.value : tagIn.value);
    const data = { date: dateIn.value, tag, text: textIn.value.trim() };
    const msg = validateNote(data);
    if (msg) { err.textContent = msg; return; }
    const all = getAll();
    const next = editingId
      ? all.map((n) => (n.id === editingId ? { ...n, ...data } : n))
      : [{ id: uid(), ...data, done: false }, ...all];
    if (save(KEYS.notes, next)) { resetForm(); render(); }
  });
  fTag.addEventListener('change', render);
  fStatus.addEventListener('change', render);
  copyBtn.addEventListener('click', async () => {
    const items = visible();
    if (!items.length) { toast('沒有可複製的紀要。'); return; }
    toast((await copyText(notesToText(items))) ? `已複製 ${items.length} 筆紀要。` : '複製失敗，請手動選取。');
  });

  document.getElementById('tile-notes').addEventListener('click', () => openSheet('notes'));
  onSheetOpen('notes', () => { if (!editingId) dateIn.value = todayISO(); render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  resetForm();
  render();
}
