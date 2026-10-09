// 畫面切換（模式不保存，重新整理一律回首頁）
const views = ['home', 'notes', 'settings', 'hell'];
const listeners = new Set();
export function onViewChange(fn) { listeners.add(fn); }

export function showView(name) {
  for (const v of views) document.getElementById(`view-${v}`).hidden = v !== name;
  const nav = document.getElementById('nav');
  nav.hidden = name === 'hell';
  for (const b of nav.querySelectorAll('button')) {
    if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  listeners.forEach((fn) => fn(name));
}

export function initRouter() {
  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) showView(b.dataset.view);
  });
}
