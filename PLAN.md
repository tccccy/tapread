# 多語言 AI 閱讀器（PWA 版）開發計畫

> 建立日期：2026-10-17
> 狀態：P0 完成（2026-10-17），下一步 P1
> 前一版（LUTE + Ollama 本機版）已封存於 `docs/archive-lute-plan.md`

---

## 1. 目標

- 讀外文書／文件時，生詞依熟練度上色；點一下由 AI **依該句上下文**給出繁中釋義，並記錄熟練度。
- 不限英文：英、西、葡、義等語言可自選。
- 不限書檔：EPUB 先做，之後 PDF、貼上文字、網頁文章。
- **電腦與平板優先**（桌機瀏覽器、iPad、Android 平板）；手機靠「匯出加註版 EPUB」閱讀。
- 隱私：書檔只存在使用者瀏覽器內，不上傳任何伺服器；查詞只送出「單字 + 所在句子」給 AI。

## 2. 形式決策

| 方案 | 結論 |
|---|---|
| Chrome 插件為主 | ✗ iPad／Android 的 Chrome 不支援插件；Safari 插件需 Mac + Xcode + 年費 |
| **PWA 網頁 App 為主（採用）** | ✓ 桌機、iPad、Android 平板都可用，可加到主畫面；純靜態網站 |
| 桌機插件 | 選配（P6）：一鍵把目前網頁文章送進閱讀器 |

## 3. 系統架構

```
PWA 閱讀器（靜態網站）
 ├─ 匯入：EPUB → PDF → 貼上文字／網址
 ├─ 閱讀頁：foliate-js 渲染 → Intl.Segmenter 分詞 → 依詞庫上色 → 點詞查 AI
 ├─ 詞庫：IndexedDB（Dexie），key = 語言 + 原形，熟練度 1–5
 └─ AI 來源（可切換）
     ├─ Gemini API，使用者自備 key（預設）
     └─ Ollama（桌機選用，完全本機）
```

| 用途 | 技術 |
|---|---|
| 建置 | Vite 8 + TypeScript 6（Node 22） |
| UI | Svelte 5 |
| EPUB 渲染 | foliate-js（MIT，固定於 commit `78914ae`，見 `vendor/foliate-js`） |
| PDF | PDF.js 文字層（P4） |
| 分詞 | `Intl.Segmenter` |
| 原形還原 | 查詞時由 LLM 一併回傳 `lemma` |
| 本機資料庫 | Dexie（P1 起） |
| 測試 | Vitest；E2E 用 Playwright（含 WebKit 近似 iPad） |

## 4. 開發階段

| 階段 | 內容 | 工時 | 完成標準 |
|---|---|---|---|
| **P0 骨架** | Vite PWA、匯入 EPUB、foliate-js 顯示、翻頁、記住閱讀位置 | 1–2 天 | iPad 開網址能讀一本 EPUB |
| **P1 點詞查 AI** | 分詞、點詞取句、Gemini 回傳 JSON（lemma／詞性／此句意思／字典意思）、快取 | 2–3 天 | 多義詞在不同句子給出不同解釋 |
| **P2 詞庫與上色** | 熟練度 1–5、生詞上色、標記已會、詞庫列表 | 2–3 天 | 標已會後全書該字顏色一起變 |
| **P3 多語言與設定** | 選學習語言、高頻詞表預設已會、詞庫匯出／匯入 JSON | 1–2 天 | 西文書常見字不被標成生詞 |
| **P4 PDF** | PDF.js 文字層接同一查詞流程 | 2–3 天 | 文字型 PDF 可點詞 |
| **P5 匯出給手機** | 輸出加註版 EPUB3（彈出式註解） | 2 天 | Apple Books 可點開註解 |
| **P6 桌機插件**（選配） | 把目前網頁文章送進閱讀器（WXT） | 2–3 天 | 新聞文章可進閱讀器查詞 |

## 5. AI 設計（P1）

- 預設模型：Gemini Flash 系列（有免費額度）；前端直接呼叫 Gemini API。
- 送出內容：`word`、`sentence`、前後各一句、書名、學習語言、母語（繁中）。
- 回傳 JSON：`lemma`、`pos`、`context_meaning`、`dict_meaning`、`note`。
- 快取：IndexedDB，key = `語言 + lemma + 句子 hash`。
- API key 只存在使用者瀏覽器，設定頁明確說明。

## 6. 風險

| 風險 | 對策 |
|---|---|
| iPad Safari 對未加入主畫面的網站可能清除 IndexedDB | 引導「加入主畫面」；定期提醒匯出詞庫 |
| foliate-js 無 npm 版本、上游改動 | 固定 commit；升級前跑測試 |
| API key 存在前端 | 只存本機；文件說明風險；可改用 Ollama |
| Ollama 從網頁呼叫被 CORS 擋 | 文件說明設定 `OLLAMA_ORIGINS` |
| LLM 回錯格式 | 用 Gemini 的 JSON schema 輸出；解析失敗重試一次 |

## 7. 開發環境

- Node 22（`/opt/homebrew/opt/node@22/bin`）；系統預設 Node 18 跑不動 Vite 8。
- 套件一律精確版本、發布滿 7 天，lockfile 進版控。
- `.npmrc` 設 `before=2026-10-10`，讓間接依賴也只解析到該日前發布的版本；之後要升級套件時，把日期改成「今天減 7 天」再 `npm install`。
- `.npmrc` 設 `legacy-peer-deps=true`（npm 10 解析 vitest peer 依賴有 bug），需要的 peer（workbox）已明列。
- npm 快取：沙盒內 `~/.npm` 不可寫時，用 `npm install --cache $TMPDIR/npm-cache`。

## 8. 進度紀錄

### P0（完成）
- 書庫頁：匯入 EPUB（選檔／拖放）、列表、進度、移除
- 閱讀頁：foliate-js 分頁顯示、上下頁按鈕、鍵盤左右鍵、觸控滑動、記住閱讀位置
- 書目與檔案分表存放（IndexedDB）；匯入後要求持久儲存
- 測試：22 個單元測試（檔案驗證、書庫、metadata）；瀏覽器手動驗證桌機與 768×1024 平板版面
- 已知待辦：foliate-js 的 `pdf.js` 有 Vite glob 警告，P4 處理；同一本書重複匯入不會去重
