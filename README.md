# iysl-pubskills

可公開分享、安裝與修改的 AI skills。目前收錄 **Blueprint**，用來製作 PowerPoint 簡報、HTML 報告與 SVG 圖表，支援 Codex 與 Claude Code。

## 安裝 Blueprint

需要 Node.js 22 以上（含 npm）與 Git。在終端機執行：

```sh
npx --yes skills@1.5.16 add isaac-ys-lin/iysl-pubskills --skill iysl-blueprint --agent codex claude-code --global --yes
```

只用 Codex 或 Claude Code 時，保留對應的 `--agent codex` 或 `--agent claude-code` 即可。Windows PowerShell 如阻擋 `.ps1` 啟動檔，可改用 `npx.cmd`。

這會安裝目前預設分支的快照；重新執行可更新，不會自動同步後續修改。安裝後開啟新對話，並提供文字稿或檔案：

```text
使用 $iysl-blueprint，把這份文字稿做成給主管看的簡報。
先整理每頁一句結論，保留所有數字與來源，標示缺資料的地方。
```

Claude Code 可用 `/iysl-blueprint`。首次製作 PPTX／PNG 時，可請 agent 在已安裝的 skill 目錄執行 `npm ci`。

## 收錄內容

| Skill | 用途 | 文件 |
| --- | --- | --- |
| `iysl-blueprint` | 可編輯 PowerPoint 圖表、閱讀型簡報、HTML 報告與 PDF、SVG／PNG 圖表，以及既有檔案指定圖表改版 | [完整使用說明](skills/iysl-blueprint/README.md) |

Blueprint 附有虛構範例、設計設定及測試。簡報產生不需 Office；自動逐頁預覽另需 LibreOffice 或 macOS PowerPoint，以及 Poppler、FFmpeg；報告印 PDF 另需 Chrome、Edge、Chromium 或 Brave。字型替代、圖表編輯限制與驗收方式見完整說明。

## 本機試用與驗證

```sh
git clone https://github.com/isaac-ys-lin/iysl-pubskills.git
cd iysl-pubskills/skills/iysl-blueprint
npm ci
npm test
node -e "require('node:fs').mkdirSync('out', {recursive:true})"
node scripts/pptx.js examples/story.json out/deck.pptx
```

CI 在 Windows、macOS 與 Linux 檢查 Blueprint 的程式、範例與設計設定。自己的輸入與產出請留在 `out/`，不要提交私人資料。

## 授權

[MIT License](LICENSE)，Copyright (c) 2026 iysl。每個 skill 目錄也附有授權檔，供單獨安裝與分享時保留。第三方套件依各自授權提供；本 repo 不附送商用字型。
