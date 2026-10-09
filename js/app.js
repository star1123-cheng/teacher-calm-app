// 進入點：註冊 service worker、初始化各模組
import { setErrorHandler } from './storage.js';
import { toast } from './ui.js';
import { initRouter, showView, onViewChange } from './router.js';
import { initSettings, renderUsage } from './settings.js';

setErrorHandler((msg) => toast(msg, 8000));
initRouter();
onViewChange((v) => { if (v === 'settings') renderUsage(); });

// 匯入備份後重新整理，讓所有模組讀到新資料
initSettings({ onImported: () => setTimeout(() => location.reload(), 800) });

showView('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
