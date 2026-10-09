// 工作紀要：新增、編輯、刪除、勾選、篩選、複製成文字
import { KEYS, load, save, uid } from './storage.js';
import { todayISO, isISODate } from './dates.js';
import { el, toast } from './ui.js';

export const TAGS = ['教學', '行政', '網管'];
export const MAX_TEXT = 1000;

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
  if (!TAGS.includes(tag)) return '請選擇分類。';
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

export function initNotes(root = document.getElementById('view-notes')) {
  let editingId = null;
  const dateIn = el('input', { type: 'date', id: 'note-date', required: true });
  const tagIn = el('select', { id: 'note-tag' }, TAGS.map((t) => el('option', { value: t, text: t })));
  const textIn = el('textarea', { id: 'note-text', rows: 3, maxlength: String(MAX_TEXT), required: true });
  const submit = el('button', { type: 'submit', text: '新增', disabled: true });
  const cancel = el('button', { type: 'button', text: '取消編輯', hidden: true });
  const err = el('p', { class: 'error', role: 'alert' });
  const form = el('form', { class: 'note-form' },
    el('label', { for: 'note-date', text: '日期' }), dateIn,
    el('label', { for: 'note-tag', text: '分類' }), tagIn,
    el('label', { for: 'note-text', text: '內容' }), textIn,
    el('p', {}, submit, cancel), err,
  );

  const fTag = el('select', { id: 'filter-tag' }, el('option', { value: 'all', text: '全部分類' }), TAGS.map((t) => el('option', { value: t, text: t })));
  const fStatus = el('select', { id: 'filter-status' },
    el('option', { value: 'all', text: '全部狀態' }), el('option', { value: 'todo', text: '未完成' }), el('option', { value: 'done', text: '已完成' }));
  const copyBtn = el('button', { type: 'button', text: '複製成文字' });
  const list = el('ul', { class: 'note-list' });
  const empty = el('p', { class: 'muted' });

  root.append(form,
    el('div', { class: 'note-filters' },
      el('label', { for: 'filter-tag', text: '篩選分類' }), fTag,
      el('label', { for: 'filter-status', text: '篩選狀態' }), fStatus, copyBtn),
    empty, list);

  const getAll = () => load(KEYS.notes, []);
  const currentFilter = () => ({ tag: fTag.value, status: fStatus.value });
  const visible = () => sortNotes(filterNotes(getAll(), currentFilter()));

  function resetForm() {
    editingId = null;
    dateIn.value = todayISO();
    tagIn.value = TAGS[0];
    textIn.value = '';
    submit.textContent = '新增';
    submit.disabled = true;
    cancel.hidden = true;
    err.textContent = '';
  }

  function render() {
    const items = visible();
    empty.textContent = items.length ? '' : '沒有符合的紀要。';
    list.replaceChildren(...items.map((n) => {
      const cb = el('input', { type: 'checkbox', checked: n.done, 'aria-label': `標示完成：${n.text.slice(0, 20)}` });
      cb.addEventListener('change', () => update(n.id, { done: cb.checked }));
      return el('li', { class: n.done ? 'done' : null },
        cb,
        el('span', { class: 'note-date', text: n.date }), ' ',
        el('span', { class: 'note-tag', text: `[${n.tag}]` }), ' ',
        el('span', { class: 'note-text', text: n.text }), ' ',
        el('button', { type: 'button', text: '編輯', onclick: () => startEdit(n) }),
        el('button', { type: 'button', text: '刪除', onclick: () => remove(n) }),
      );
    }));
  }

  function update(id, patch) {
    const all = getAll().map((n) => (n.id === id ? { ...n, ...patch } : n));
    if (save(KEYS.notes, all)) render();
  }

  function remove(n) {
    if (!confirm(`確定刪除這筆紀要？\n${n.date} [${n.tag}] ${n.text.slice(0, 40)}`)) return;
    if (save(KEYS.notes, getAll().filter((x) => x.id !== n.id))) {
      if (editingId === n.id) resetForm();
      render();
    }
  }

  function startEdit(n) {
    editingId = n.id;
    dateIn.value = n.date;
    tagIn.value = n.tag;
    textIn.value = n.text;
    submit.textContent = '儲存修改';
    submit.disabled = false;
    cancel.hidden = false;
    textIn.focus();
  }

  textIn.addEventListener('input', () => { submit.disabled = !textIn.value.trim(); });
  cancel.addEventListener('click', resetForm);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = { date: dateIn.value, tag: tagIn.value, text: textIn.value.trim() };
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

  resetForm();
  render();
}
