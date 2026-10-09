# 資料儲存規格（M1）

全部存在本機，鍵名前綴 `tcalm:`。不連後端。

| 鍵 | 內容 |
|---|---|
| tcalm:settings | { countdown:{start,end}, audio:{mixEnabled,volume,lastTrack}, version } |
| tcalm:quotes | [{id, text, author, book, page}]（使用者匯入） |
| tcalm:quoteState | { order:[id...], pos, round, today:{date,id} } |
| tcalm:soupState | 同 quoteState，用於毒雞湯 |
| tcalm:notes | [{id, date, tag, text, done}] |
| tcalm:hell | { retireDate, edu, level, toggles:{research,homeroom,leader}, overrides:{homeroom,...}, annualRaise, promoteDate, tallyStart } |

模式（寧靜或地獄）不存。

## 備份
- 設定頁【匯出備份】下載單一 JSON（所有 `tcalm:` 鍵加匯出時間、schema 版本）。
- 【匯入備份】先驗證 schema 版本與欄位，顯示摘要，確認後覆蓋。壞檔不得破壞現有資料。
- 提醒使用者：清除瀏覽器資料會遺失內容，請定期匯出。

## CSV 格式（句庫）
- 編碼 UTF-8（含 BOM 以便 Excel 開啟），首列標題：`句子,作者,書名,頁碼`。
- 欄位含逗號、換行或雙引號時，以雙引號包住，內部雙引號寫成兩個。
- 書名、頁碼可空白。原創句作者欄為「原創」。
- 範本：seed/quotes-template.csv。

驗收：
- [ ] 匯出再匯入後資料完全一致
- [ ] 匯入損壞或舊版 JSON 時提示錯誤且不改動現有資料
- [ ] 儲存空間不足時有明確提示
- [ ] CSV 解析通過含逗號、換行、雙引號的測試列
