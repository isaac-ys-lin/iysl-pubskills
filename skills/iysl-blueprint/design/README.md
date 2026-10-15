# Blueprint 設計層

Blueprint 的視覺規格。預設使用全球藍，B′ 深藍與 clay 保留為選用設計層範例；顏色、字級、邊界、線寬與斜線填色都由設計層提供。

- `tokens.json`：預設全球藍；白封面、深藍章節，封面 48 pt、章節 39 pt。
- `tokens.blue.json`：B′ 深藍設計層範例，並非原全球藍。
- `tokens.clay.json`：clay 配色範例，不是預設。
- `spec.md`：頁面格線、字級、線寬、刻度、來源列、標註規則、資料顯示、版型與 PowerPoint 輸出對應；色碼描述預設全球藍。
- `claude-design/`：第一版在 Claude Design 製作的 8 頁版型與 13 種圖表樣張，保留原始名稱與檔名。要在 Claude Design 裡打開才看得到畫面；匯出時附帶的執行檔沒有放進來。

從 repo 根目錄執行；`BLUEPRINT_TOKENS` 可指定另一份設計層，相對路徑從目前工作目錄解析：

```sh
node scripts/pptx.js examples/story.json out/story.pptx
BLUEPRINT_TOKENS=design/tokens.blue.json node scripts/pptx.js examples/story.json out/story-blue.pptx
node scripts/check-design.js
node scripts/check-design.js design/tokens.blue.json
npm test
```

`node scripts/check-design.js [tokens.json]` 省略檔案時檢查目前生效的設計層；明確指定檔案則只檢查該檔。檢查涵蓋文字對比、標籤可讀性、焦點與類別的色差、色盲模擬，以及有序配色的明暗與色相。警告會列出需要直接標值或表格的情況；有失敗時結束碼為 1，通過為 0。`npm test` 檢查預設層及選用設計層；程式檢查不代表實際畫面已驗收。

範例資料都是虛構的「河港市共享單車」。

預設 `font.display` 為 `Cambria`、`PMingLiU`、`Songti TC`，用於封面與章節標題；PowerPoint 展示文字用 Cambria／PMingLiU，HTML 可回退 Songti TC。其餘 PowerPoint 文字仍由 `font.slide` 決定（微軟正黑體）。有 `color.cover` 時使用白封面與深藍章節；未設定的選用層維持既有深底封面與淡底章節。
