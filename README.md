# 教師寧靜 app

自用 PWA，純 HTML／CSS／JavaScript，資料只存本機。規格見 `PRD.md` 與 `docs/`。

## 本機預覽
```
python -m http.server 8765 --bind 127.0.0.1
```
開啟 http://localhost:8765 。（service worker 需要 http(s)，直接雙擊 index.html 不會啟用離線功能。）

## 自動測試（Node.js 內建，不需安裝套件）
```
node --test tests/*.test.mjs
```

## 修改後記得
`sw.js` 的 `VERSION` 加 1，並把新檔案加進 `PRECACHE`，使用者裝置才會更新快取。
