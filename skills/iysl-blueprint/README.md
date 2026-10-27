# Blueprint

把文字稿、會議紀錄與大綱整理成 PowerPoint 簡報、HTML 報告和 SVG 圖表的 AI skill。支援 Codex 與 Claude Code，也可直接執行 Node.js 程式。

先寫清楚每頁的判斷，再選版型與圖表；保留原始數據、來源與缺值，不補造資料。

## 可以做什麼

- **PowerPoint 簡報**：可重用的版型、來源列與講稿；8 類原生圖表可在 PowerPoint 編輯數據，其餘圖種以 SVG 搭配 PNG 後備呈現。
- **閱讀型簡報**：會前寄出、沒有人講解時，在 `story.json` 填 `"mode": "read"`，改用較小字級、雙格與註腳，要說的話寫在頁面上。
- **HTML 報告與 PDF**：從 `report.json` 產生可閱讀、轉寄的 HTML，再用 Chrome、Edge 等瀏覽器印成 A4／Letter PDF 並逐頁檢查。
- **SVG／PNG 圖表**：23 種圖表與 1 種表格，包含長條、折線、瀑布、散佈、熱圖等。
- **既有檔案改版**：在副本上替既有 PowerPoint、Word、Excel、HTML 的指定圖表或圖片換樣式；實際修改由 agent 依來源檔執行，並非一鍵轉換所有 Office 格式。
- **自訂外觀**：調整色彩、字型與版面設定，保留數據與意義。

## 安裝 skill

先安裝 **Node.js 22 以上**（含 npm）與 Git，再在終端機執行：

```sh
npx --yes skills@1.5.16 add isaac-ys-lin/iysl-pubskills --skill iysl-blueprint --agent codex claude-code --global --yes
```

只用其中一個工具時，將 `--agent codex claude-code` 改成 `--agent codex` 或 `--agent claude-code`。這個指令安裝公開 repo 的目前預設分支快照；重新執行可更新，但不會自動同步後續修改。安裝後開啟新對話。

Windows PowerShell 若阻擋 npm／npx 的 `.ps1` 啟動檔，可使用 `npm.cmd`／`npx.cmd` 執行相同指令，不必變更系統執行原則。

在 Codex 輸入：

```text
使用 $iysl-blueprint，把這份文字稿做成給主管看的簡報。
先整理每頁一句結論，保留所有數字與來源，標示缺資料的地方。
```

在 Claude Code 可用 `/iysl-blueprint`，並附上文字稿或檔案。第一次製作 PPTX／PNG 時，需要在已安裝的 skill 目錄執行 `npm ci`；可請 agent 依 SKILL.md 完成。SVG 產生器本身只需 Node.js。

## 直接執行範例

不透過 agent 也能建立範例。以下指令在 Windows PowerShell、macOS 與 Linux 的終端機均可執行：

```sh
git clone https://github.com/isaac-ys-lin/iysl-pubskills.git
cd iysl-pubskills/skills/iysl-blueprint
npm ci
node -e "require('node:fs').mkdirSync('out', {recursive:true})"
node evals/check.mjs examples/story.json evals/fixtures/example-script.md
node scripts/pptx.js examples/story.json out/deck.pptx
node scripts/svg.js examples/rank.json out/rank.svg
node scripts/png.js out/rank.svg out/rank.png
node scripts/report.js examples/report.json out/report.html
```

開啟 `out/deck.pptx` 查看簡報；以瀏覽器開啟 `out/report.html` 查看完整 HTML 報告。閱讀型簡報範例見 `examples/story-read.json`。範例及驗收稿為虛構示意資料，不代表真實公司或機構。

## 預覽與限制

製作 PPTX 不需要安裝 Office。正式交付前，仍應以 PowerPoint 檢查每頁外觀，並實際修改一個原生圖表數值，確認「編輯資料」功能。

自動逐頁預覽指令：

```sh
node scripts/preview.js out/deck.pptx out/preview
```

這一步另外需要：

- LibreOffice；macOS 也可使用已安裝的 Microsoft PowerPoint。
- Poppler 的 `pdftoppm` 與 FFmpeg，兩者須在 PATH 中。
- Windows 版 PowerPoint 不由預覽腳本直接控制；可手動開檔，或使用 LibreOffice 預覽。

報告印 PDF：

```sh
node scripts/pdf.js out/report.html out/print
```

需要 Chrome、Edge、Chromium 或 Brave（可用 `BLUEPRINT_CHROME` 指定執行檔），以及 Poppler 的 `pdftoppm`、`pdftotext` 與 FFmpeg。

字型不隨 repo 或 PPTX 附送。預設一般文字使用微軟正黑體，展示標題使用 Cambria／PMingLiU；不同電腦可能採替代字型，造成換行差異。自動驗證通過不代表版面、來源真偽與完整語意都已驗收。原生圖表改值後，也不會自動改寫頁面結論或重選重點；詳見[編輯限制](docs/design-diff.md)。中文數詞與日期區間不自動核對；數字檢查只確認畫面數字出自原稿，不確認原稿本身正確。

## 文件

| 文件 | 內容 |
| --- | --- |
| [SKILL.md](SKILL.md) | agent 製作流程與資料原則 |
| [版型說明](references/layouts.md) | 每頁結構、容量與輸出 |
| [圖表選單](references/charts.md) | 圖種選擇與 JSON 欄位 |
| [HTML 報告](references/report.md) | 報告製作與列印 |
| [既有檔案](references/formats.md) | Office／HTML 修改範圍與保留原則 |
| [設計設定](design/README.md) | 預設全球藍、可選配色與全交付字級索引 |
| [自訂方法](docs/make-it-yours.md) | 改配色、字型、版型與流程 |
| [驗收說明](evals/README.md) | 自動檢查的能力與限制 |

## 驗證

在 repo 根目錄執行：

```sh
npm ci
npm test
node scripts/check-design.js
node evals/check.mjs examples/story.json evals/fixtures/example-script.md
node evals/check-report.mjs examples/report.html evals/fixtures/explain-script.md examples/report.json
```

CI 在 Windows、macOS 與 Linux 執行上述檢查。測試產生的檔案及自己的工作成果請放在 `out/`；不要提交客戶資料、憑證或私人文件。

依賴鎖定於 `package-lock.json`。`image-size` 透過套件版本覆寫 固定為 2.0.4，以避開舊版圖片解析器的無窮迴圈漏洞（[JXL／HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)、[ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)）。`package.json` 的 `private: true` 僅防止誤發布到 npm；GitHub repo 可公開安裝。

## 授權

[MIT License](LICENSE)，Copyright (c) 2026 iysl。分享或修改程式時請保留授權與著作權聲明。第三方套件依各自授權提供；本 repo 不附送商用字型。
