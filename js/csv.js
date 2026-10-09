// CSV 解析與輸出（RFC 4180）：支援雙引號包住的逗號、換行，以及 "" 代表一個雙引號。

// 回傳 { records: [{ line, fields }], error }；line 為該筆資料在檔案中的起始行號（從 1 起算）
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 去掉 BOM
  const records = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;
  const n = text.length;

  const endField = () => { fields.push(field); field = ''; };
  const endRecord = () => {
    endField();
    // 整列空白（例如檔尾空行）不算資料
    if (!(fields.length === 1 && fields[0] === '')) records.push({ line: recordLine, fields });
    fields = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      if (c === '\r' && text[i + 1] === '\n') { field += '\n'; line++; i += 2; continue; }
      if (c === '\n' || c === '\r') line++;
      field += c === '\r' ? '\n' : c;
      i++;
      continue;
    }
    if (c === '"' && field === '') { inQuotes = true; i++; continue; }
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r' || c === '\n') {
      endRecord();
      i += (c === '\r' && text[i + 1] === '\n') ? 2 : 1;
      line++;
      recordLine = line;
      continue;
    }
    field += c;
    i++;
  }
  if (inQuotes) return { records, error: { line: recordLine, message: `第 ${recordLine} 行的雙引號沒有成對結束` } };
  if (field !== '' || fields.length) endRecord();
  return { records, error: null };
}

function escapeField(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// rows 為二維陣列；預設加 BOM 讓 Excel 正確辨識 UTF-8
export function toCSV(rows, { bom = true } = {}) {
  const body = rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
  return (bom ? '﻿' : '') + body;
}
