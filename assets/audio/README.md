# 自備白噪音音檔

1. 把 mp3 放在這個資料夾，檔名只用英文、數字、`-`、`_`，例如 `rain.mp3`。
2. 在 `manifest.json` 登記顯示名稱與檔名：

```json
{
  "tracks": [
    { "name": "雨聲", "file": "rain.mp3" },
    { "name": "海浪", "file": "sea.mp3" }
  ]
}
```

- 背景音樂登記在 `bgm` 清單，只寫檔名，例如 `"bgm": ["ai_similar_01_cafe_bossa.mp3", "ai_similar_02_forest_fantasy.mp3"]`。不分模式，開啟與切換模式時隨機挑一首，同一首循環播放，要加歌就往清單後面加。
- 白噪音單檔 1 到 2 分鐘（會自動循環），全部加起來盡量不超過 20 MB；太長的檔案會佔用大量手機記憶體。
- 只用可商用或 CC0 授權的素材，請自行確認授權。
- 白噪音要先轉檔（頭尾交叉淡入 0.5 秒，循環才不會爆音，順便降到 96 kbps）。在這個資料夾執行，把 `原始.mp3`、`輸出.mp3` 換成實際檔名，`L` 換成原始檔長度（秒）：

```bash
F=0.5; L=90; E=$(python -c "print($L-$F)")
ffmpeg -i 原始.mp3 -filter_complex "[0:a]asplit=3[a][b][c];[a]atrim=$F:$E,asetpts=PTS-STARTPTS[mid];[b]atrim=$E,asetpts=PTS-STARTPTS,afade=t=out:d=$F:curve=qsin[t];[c]atrim=0:$F,asetpts=PTS-STARTPTS,afade=t=in:d=$F:curve=qsin[h];[t][h]amix=inputs=2:normalize=0[x];[mid][x]concat=n=2:v=0:a=1[o]" -map "[o]" -map_metadata -1 -codec:a libmp3lame -b:a 96k 輸出.mp3
```

- 背景音樂建議轉成 128 kbps：`ffmpeg -i 原始.mp3 -map_metadata -1 -codec:a libmp3lame -b:a 128k 輸出.mp3`
- 換掉同名檔案時，已安裝的裝置會繼續用快取裡的舊檔；要更新請改檔名並同步修改 manifest.json。
- 目前沒有內建的合成噪音，沒放音檔時白噪音面板只會顯示說明。
- 登記了但檔案不存在時，那一項不會出現在選單，也不會報錯。
