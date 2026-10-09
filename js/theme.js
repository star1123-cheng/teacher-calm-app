// 寧靜模式日夜：裝置本地時間 07:00（含）到 18:00（不含）為白天，其餘為夜晚
export function themeAt(date = new Date()) {
  const h = date.getHours();
  return h >= 7 && h < 18 ? 'day' : 'night';
}

const THEME_COLOR = { day: '#e9eef6', night: '#141a36', hell: '#0e0c10' };

export function applyTheme() {
  const root = document.documentElement;
  const theme = themeAt();
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = root.dataset.mode === 'hell' ? THEME_COLOR.hell : THEME_COLOR[theme];
}

export function initTheme() {
  applyTheme();
  setInterval(applyTheme, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyTheme(); });
}
