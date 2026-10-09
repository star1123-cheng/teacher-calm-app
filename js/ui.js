// 共用介面小工具：一律用 textContent，不把資料放進 innerHTML

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

let toastTimer;
export function toast(msg, ms = 4000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  // 用 popover 放到最上層，彈窗開著時也看得到
  try { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } catch { /* 舊瀏覽器不支援 popover */ }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    toastTimer = setTimeout(() => { try { t.hidePopover(); } catch { /* 忽略 */ } }, 300);
  }, ms);
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file) {
  return file.text();
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
