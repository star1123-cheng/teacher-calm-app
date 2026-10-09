// 進入點：註冊 service worker、初始化各模組
import { setErrorHandler, load, KEYS, getSettings, saveSettings } from './storage.js';
import { toast } from './ui.js';
import { initRouter, showView, onViewChange } from './router.js';
import { initSettings, renderUsage } from './settings.js';
import { initCountdown } from './countdown.js';
import { initQuote } from './quote.js';
import { initNotes } from './notes.js';
import { initAudio } from './audio-ui.js';
import { initHell, buildHellForm } from './hell.js';
import { getHell } from './hell-data.js';

setErrorHandler((msg) => toast(msg, 8000));
// 第一次開啟時把預設值存起來（倒數起點＝今天，之後不會每天變動）
if (load(KEYS.settings) == null) saveSettings(getSettings());

initRouter();
// 設定頁：進過地獄模式之後才出現退休與薪資資料
onViewChange((v) => {
  if (v !== 'settings') return;
  renderUsage();
  const sec = document.getElementById('hell-settings');
  sec.hidden = !getHell();
  if (!sec.hidden) buildHellForm(document.getElementById('hell-settings-form'));
});

// 匯入備份後重新整理，讓所有模組讀到新資料
initSettings({ onImported: () => setTimeout(() => location.reload(), 800) });

initCountdown();
initQuote();
initNotes();
initAudio();
initHell();

showView('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
