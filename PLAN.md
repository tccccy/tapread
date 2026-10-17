# 多語言 AI 閱讀器（PWA 版）開發計畫

> 建立日期：2026-10-17
> 狀態：P1、P2、P4（PDF＋Word）完成（2026-10-17），下一步：部署前準備 → GitHub Pages
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
| **P2 單字本與上色** | 卡片「收藏」、單字本（依語言、可篩書）、閃卡複習、熟練度 1–5、收藏字書中上色 | 2–3 天 | 標已熟後全書該字不再上色 |
| **P3 多語言與設定** | 選學習語言、詞形還原（讓 abre 也能對到收藏的 abrir）、單字本匯出／匯入 JSON | 1–2 天 | 收藏 abrir 後書中其他變化形也上色 |
| **部署前** | 首次開啟引導（申請金鑰三步驟）、「測試金鑰」按鈕、部署到 GitHub Pages／Cloudflare Pages | 0.5–1 天 | 朋友只靠網址就能完成設定 |
| **P4 PDF** | PDF.js 文字層接同一查詞流程 | 2–3 天 | 文字型 PDF 可點詞 |
| **P5 匯出給手機** | 輸出加註版 EPUB3（彈出式註解） | 2 天 | Apple Books 可點開註解 |
| **P6 桌機插件**（選配） | 把目前網頁文章送進閱讀器（WXT） | 2–3 天 | 新聞文章可進閱讀器查詞 |

## 5. AI 設計（P1）

- 預設模型：`gemini-3.5-flash-lite`（2026-07 穩定版、預設 minimal thinking、便宜快速）；可在設定改成 `gemini-3.6-flash` 等。前端直接呼叫 `generateContent`。
- 送出內容：`word`、`sentence`、前後各一句、書名、學習語言、母語（繁中）。
- 回傳 JSON：`lemma`、`pos`、`context_meaning`、`dict_meaning`、`note`。
- 快取：IndexedDB，key = `模型 + 語言 + 單字 + 前後文 hash`。
- API key 只存在使用者瀏覽器，設定頁明確說明。

## 6. 風險

| 風險 | 對策 |
|---|---|
| iPad Safari 對未加入主畫面的網站可能清除 IndexedDB | 引導「加入主畫面」；定期提醒匯出詞庫 |
| foliate-js 無 npm 版本、上游改動 | 固定 commit；升級前跑測試 |
| API key 存在前端 | 只存本機；文件說明風險；可改用 Ollama |
| Ollama 從網頁呼叫被 CORS 擋 | 文件說明設定 `OLLAMA_ORIGINS` |
| LLM 回錯格式 | 用 Gemini 的 JSON schema 輸出；解析失敗重試一次 |
| **EPUB 夾帶 JavaScript**（可偷 API 金鑰） | foliate-js 的 iframe 沙盒因 WebKit bug 形同無效 → 以 `<meta>` CSP 限制 `script-src 'self'`（vite.config.ts）。已用 `tests/fixtures/script-test.epub` 對照驗證：無 CSP 時腳本會執行，有 CSP 時三種注入全擋 |

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

### P1（完成）
- 點書中單字 → `Intl.Segmenter` 找出單字與所在句、前後句 → Gemini 回傳原形／詞性／此句意思／字典釋義／補充 → 底部卡片顯示
- CSS Custom Highlight API 標示查詢中的字（Safari 17.2+；不支援時略過）
- 設定頁：API 金鑰、模型名稱；金鑰只存在本機、放在請求標頭
- 連點多字時取消前一個請求；翻頁或點空白處關閉卡片
- 錯誤分類：未設金鑰／金鑰無效／模型錯誤／額度用完／網路／逾時／內容被擋／格式錯誤
- 額度錯誤細分（解析 429 的 QuotaFailure／RetryInfo）：每分鐘上限顯示建議等待秒數；每日上限依使用者時區顯示太平洋時間午夜的重置時刻（自動處理夏令時間）
- 加入 CSP（見風險表）
- 測試：88 個單元測試；瀏覽器驗證桌機、平板版面、正式建置（含 Service Worker）
- 已知待辦：章節載入失敗時畫面空白無提示（foliate 只在 console 警告）；尚未在實體 iPad 上測試點詞

### P2（完成）
- 依使用者選擇：**手動收藏**（卡片 ☆）、同原形合併並保留各例句、**依語言分**可再篩書、**閃卡複習**＋熟練度影響書中上色
- 閃卡：正面原形＋例句（目標字加底色），翻面看此句意思／字典釋義／補充／其他例句；不記得（10 分鐘後、本輪再出現）／記得（1、3、7 天）／已熟（不再出現）
- 書中上色：CSS Custom Highlight，越不熟越深，已熟不上色；以正規表示式預篩後才分詞，避免長章節卡頓
- 已熟的字又在新句子收藏 → 自動回到熟練度 1
- 以「語言＋字形＋句子」判斷是否已收藏（AI 回傳的原形每次可能不同）
- 限制：上色只認得收藏過的字形，其他變化形要等 P3 詞形還原
- 「回到書中」：收藏時記下 EPUB CFI；清單例句旁按鈕直接開到那一頁並標出該字。以快速翻閱模式開啟，不改變閱讀進度；返回時回到單字本原本的語言分頁與書本篩選。功能上線前收藏的例句沒有位置，不顯示按鈕
- 清單（單字本頁下方）：搜尋原形／字形／意思／例句、排序（最新、字母、最不熟）、展開看每個書中原句（目標字加底色）與當句意思、書名與收藏日期、移除單句或整個字
- 測試：125 個單元測試；瀏覽器驗證收藏、上色、取消、閃卡、資料庫 v3→v4 升級

### P4 格式擴充（完成）
- **PDF（文字型）**：用 foliate-js 內建的 PDF.js，保留原始版面；點字走 PDF.js 文字層
  - 文字索引把 `<br>`／區塊邊界視為空格，PDF 相鄰兩行的字不再黏在一起（`src/lib/text/textIndex.ts`）
  - 建置時修補 foliate-js `pdf.js`（不改 vendor 原始檔，見 `vite.config.ts`）：① 資源路徑改字串相加，避免 Vite 改寫成 `import.meta.glob`；② 重繪前清空文字層，修正同頁文字重複兩份的 bug。升級 foliate-js 時若程式碼變了，建置會直接失敗提醒
  - PDF.js 的 worker、字型、cmap 在建置時複製到 `dist/assets/vendor/pdfjs/`；開發伺服器原樣送出 PDF.js 的 CSS
  - 文字層較晚出現：以 MutationObserver 在重繪後重新上色、重新標示「回到書中」的位置
  - 限制：掃描成圖片的 PDF 無法點字；PDF 標題若沒有句號會和下一句併在一起送給 AI
- **Word（.docx）**：mammoth 1.13.0 轉 HTML → 依 h1（沒有則 h2）切章節、建目錄（`src/lib/formats/`）；舊版 .doc 提示另存 .docx
- **語言**：設定頁加「預設學習語言」；書庫中沒有語言的書可直接選，並把先前收藏在「未指定語言」下的字一併搬過去
- **已接受的風險**：npm audit 回報 mammoth → argparse → sprintf-js 的中度 DoS 漏洞（GHSA-hp3w-g68c-fv3c，目前無修補版）。argparse 只用於 mammoth 的命令列工具，瀏覽器打包結果不含此程式碼（已檢查 dist）
- 測試：154 個單元測試（新增 jsdom 環境測文字索引與 Word 轉換）；瀏覽器驗證開發版與正式版的 PDF、Word 匯入、點字、收藏、回到書中

### 部署前待辦
- 首次開啟引導（申請金鑰三步驟）、「測試金鑰」按鈕
- 有新版本時提示「重新整理以更新」（PWA 目前要開第二次才會換新版）
- 另開獨立 GitHub repo（只放閱讀器），GitHub Actions 自動建置部署到 GitHub Pages

