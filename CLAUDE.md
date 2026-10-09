# CLAUDE.md：教師寧靜 app

## 專案
自用 PWA。寧靜模式（時光倒數、一日一句、工作紀要、白噪音）與地獄模式（退休倒數、薪水跳表、毒雞湯）。
點【我很快樂】5 秒內連點 3 次進入地獄模式，點【我真的累了】回到寧靜模式。

## 工作規則（省 token）
1. 一次只做一個里程碑（見 PRD.md）。完成後請使用者清空對話，再開下一個。
2. 只讀要做的功能對應的 docs/ 檔，不要一次讀完整個 docs/。
3. seed/ 只在實作匯入功能或驗證時才讀，不要整檔貼進對話。
4. UI 圖片與互動提示詞由使用者另外直接提供。未提供前只做功能骨架（語意化 HTML 加最少 CSS），不要自行設計視覺。
5. 驗收標準逐條勾選，全部通過才算完成該里程碑。
6. 資訊不足時先指出缺口與假設，不要腦補。

## 技術約定
- 純 HTML／CSS／JavaScript（ES modules），無框架、無打包工具、無 npm 依賴。
- PWA：manifest.json 加 service worker，離線可用。部署 GitHub Pages，一律使用相對路徑。
- 資料只存 localStorage 或 IndexedDB，鍵名前綴 `tcalm:`。不連後端、不上傳任何資料。
- 不寫死 API Key、Token、密碼。不放使用者實際薪資、薪級、退休日期，測試一律用示意數字。
- 模式不持久化：每次啟動都從寧靜模式開始。
- 介面文字：繁體中文（台灣用語）。中英文與半形數字間加半形空格，使用全形標點與「」引號。

## 目錄
```
index.html  manifest.json  sw.js
css/  js/（modules：countdown, quote, notes, audio, salary, hell, storage）
assets/audio/（使用者自備 mp3，見 docs/audio.md）
docs/  seed/
```

## 規格索引
| 要做 | 讀這份 |
|---|---|
| 倒數、一日一句、工作紀要 | docs/quiet-mode.md |
| 彩蛋、退休倒數、毒雞湯 | docs/hell-mode.md |
| 薪水跳表與晉級模擬 | docs/salary.md |
| 白噪音與混音 | docs/audio.md |
| 儲存結構、備份、CSV | docs/data-storage.md |
