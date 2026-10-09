// 進入點：註冊 service worker、初始化各模組
import { setErrorHandler, load, KEYS, getSettings, saveSettings } from './storage.js';
import { toast } from './ui.js';
import { initRouter, showView, onViewChange } from './router.js';
import { initSettings, renderUsage } from './settings.js';
import { initCountdown } from './countdown.js';
import { initQuote } from './quote.js';
import { initNotes } from './notes.js';

setErrorHandler((msg) => toast(msg, 8000));
// 第一次開啟時把預設值存起來（倒數起點＝今天，之後不會每天變動）
if (load(KEYS.settings) == null) saveSettings(getSettings());

initRouter();
onViewChange((v) => { if (v === 'settings') renderUsage(); });

// 匯入備份後重新整理，讓所有模組讀到新資料
initSettings({ onImported: () => setTimeout(() => location.reload(), 800) });

initCountdown();
initQuote();
initNotes();

showView('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
