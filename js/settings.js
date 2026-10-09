// 設定頁：備份匯出匯入、儲存用量
import { buildBackup, parseBackupText, applyBackup, MAX_FILE_BYTES } from './backup.js';
import { snapshot } from './storage.js';
import { el, toast, download } from './ui.js';

const pad = (n) => String(n).padStart(2, '0');

function backupFilename(d = new Date()) {
  return `tcalm-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export function renderUsage() {
  const bytes = Object.values(snapshot()).reduce((s, v) => s + v.length * 2, 0);
  document.getElementById('storage-usage').textContent = `目前約使用 ${(bytes / 1024).toFixed(1)} KB 本機儲存空間。`;
}

export function initSettings({ onImported } = {}) {
  document.getElementById('btn-export').addEventListener('click', () => {
    download(backupFilename(), JSON.stringify(buildBackup(), null, 1));
    toast('已匯出備份檔，請存放在安全的地方。');
  });

  const input = document.getElementById('file-import');
  const dlg = document.getElementById('dlg-import');
  const list = document.getElementById('import-summary');
  let pending = null;

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast('檔案太大，不像是本 app 的備份檔。'); return; }
    const res = parseBackupText(await file.text());
    if (!res.ok) { toast(`${res.error}現有資料沒有變動。`, 6000); return; }
    pending = res.backup;
    const s = res.summary;
    list.replaceChildren(
      el('li', { text: `匯出時間：${s.exportedAt ? new Date(s.exportedAt).toLocaleString('zh-TW') : '未知'}` }),
      el('li', { text: `作家句：${s.quotes} 筆` }),
      el('li', { text: `工作紀要：${s.notes} 筆` }),
      el('li', { text: `設定：${s.hasSettings ? '有' : '無'}；地獄模式資料：${s.hasHell ? '有' : '無'}` }),
    );
    dlg.showModal();
  });

  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'ok' && pending) {
      const r = applyBackup(pending);
      toast(r.ok ? '已匯入備份。' : r.error, 6000);
      if (r.ok) onImported?.();
    }
    pending = null;
    renderUsage();
  });

  renderUsage();
}
