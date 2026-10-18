# TapRead（多語言 AI 閱讀器，PWA 版）開發計畫

> 建立日期：2026-10-17
> 狀態：已上線 https://tccccy.github.io/tapread/ （P0、P1、P2、P4 完成），下一步 P3
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

### 部署前準備（完成）
- 書庫首次使用引導：沒有金鑰時顯示歡迎卡片與兩個步驟
- 設定頁：申請金鑰三步驟；「測試並儲存」以查詢模型資訊確認金鑰（不消耗額度），成功才儲存
- PWA 改為 prompt 模式：有新版本時底部提示「更新」；每小時與切回 App 時檢查更新

### 部署（完成，2026-10-17）
- 網址：https://tccccy.github.io/tapread/（2026-10-17 由 polyglot-reader 改名為 TapRead）
- Repo：https://github.com/tccccy/tapread（公開；只含閱讀器，作者 email 為 GitHub noreply）
- 開發仍在本機 `專案/閱讀器/`（上層 `專案/` repo）；發布用 `scripts/publish-github.sh`：
  抽出 `閱讀器/` 歷史 → email 改 noreply → 檢查無個人 email／金鑰 → 推到 GitHub main
  （改寫結果固定，每次只會接上新 commit；可先加 `--dry-run` 檢查）
- 推到 main 後 GitHub Actions（`.github/workflows/deploy.yml`）自動：npm ci → 型別檢查 → 測試 → 建置 → 部署；action 固定 commit SHA
- 使用者端：有新版本時 App 底部會提示「更新」

### 單字本篩選、難度、改名、備份（完成，2026-10-17）
- **篩選**（`src/lib/vocab/filters.ts`）：熟練度、難度（CEFR）、詞性（AI 自由文字歸成 6 類）、收藏時間（今天／7 天／30 天）、書、一字多義；同類複選為「或」、不同類為「且」；每個選項顯示套用其他篩選後的字數；統計、清單與「開始複習」都只用篩選後的字
- **CEFR 難度**：查詞時 Gemini 一併回傳（enum A1–C2／unknown），顯示在釋義卡片與清單；釋義快取 key 升為 v2，舊快取自然失效；改版前收藏的字為「未分級」
- **改名 TapRead**：標題、PWA 名稱、README；網址改為 /tapread/。IndexedDB 名稱與設定的 localStorage key 刻意沿用舊名（同網域，使用者資料不受影響）
- **手機版面**：書庫標題列按鈕不換行、空間不足時移到標題下；確認 375px 寬沒有橫向捲動
- **備份與同步（手動）**（`src/lib/backup/`）：設定頁匯出 zip（含書檔／只有單字與進度），平板手機用系統分享選單（可 AirDrop、存到檔案）
  - 不含 API 金鑰
  - 匯入時：同一本書以檔案內容 SHA-256 辨識並自動對應書號；例句聯集、熟練度與閱讀進度採較新的一邊；重複匯入不會重複
  - 備份內容視為不可信：逐欄驗證、壞資料略過並計數；書檔逐本解壓（每本上限 200 MB）並重算雜湊比對；zip 路徑限定 `books/<數字>.<副檔名>`
  - 已知限制：匯出時所有書檔會同時放在記憶體，書很多時（數百 MB）iPad 可能吃不消，可改用「只有單字與進度」
- 測試：207 個單元測試

### 介面改版（2026-10-18）
- 參考 `參考圖片/`：米白底＋咖啡色按鈕＋霧面玻璃；深色模式跟隨系統，改為深咖啡玻璃（`src/app.css` 的設計變數）
- 底部玻璃分頁列（書架／單字本／設定），寬螢幕（≥1100px）改為左側欄；閱讀與複習時隱藏
- **書架首頁**（`Bookshelf.svelte`）：「繼續閱讀」玻璃卡片；書封立在層板上、可橫向捲動；分類方式由使用者選：閱讀狀態／語言／自訂書架（可建立、改名、刪除，一本書可放多個書架）
- **書的頁面**（`BookDetail.svelte`）：封面模糊當背景、閱讀進度、開始／繼續閱讀、標為讀完、5 顆星（可半顆）評分、自動儲存的心得、放進書架、語言、日期、「從這本書收藏了 N 個單字」直接跳到單字本（自動篩選這本書）、移除
- **封面**：EPUB 取書內封面、PDF 用第一頁，縮成小圖存在 IndexedDB（v5 新增 covers、shelves 表）；沒有封面時依書名產生布面封面；捲進畫面才取、一次一本
- 閱讀頁：米白紙張＋襯線字；收藏字改焦糖色、正在查的字改咖啡底白字
- 閱讀狀態只看「讀完日期」（讀到 98% 自動記下，可手動取消）
- 返回鍵接上瀏覽器歷史：iPhone 右滑、Android 返回鍵會回上一層並還原捲動位置
- 備份加入評分、心得、日期與書架（書架以名稱對應）
- 測試：233 個單元測試

### 閱讀設定「Aa」（2026-10-18）
- 閱讀頁右上「Aa」：字體、字級（14–28）、行距（緊湊／適中／寬鬆）、頁寬（窄／適中／寬）、紙張（跟隨系統／米白／羊皮紙／夜間）；所有書共用，存在 localStorage `tapread.readingPrefs`
- 字體（`src/lib/reading/prefs.ts`）：明體（Literata＋思源宋體）、黑體（系統字體）、楷體（霞鶩文楷）、古典（EB Garamond＋思源宋體）、原書（不覆蓋出版社字體）；日文書的漢字優先用日文字形的系統字體
- 字型用 @fontsource 打包在 App 內（OFL 授權，不連 Google）；中文字型依 unicode-range 切片，只下載讀到的字；不預先快取，抓過的切片由 Service Worker 留著離線用；只保留 woff2
- 書本 iframe 是 blob: 網址讀不到主頁面的字型，`src/lib/reading/fonts.ts` 把 @font-face 改成絕對網址一起注入
- App 標題字改用 Literata＋思源宋體（各平台一致）
- PDF 是固定版面：只能換紙張色（只影響頁面外圍）
- foliate-js paginator 建置時修補：套用樣式後若已離開閱讀頁不再丟錯
- 測試：247 個單元測試

### 奶茶色與手動深淺色（2026-10-18）
- 主色改為奶茶色（淺色 `#c2a385`、深色 `#c4a88c`）；按鈕上用深咖啡字，文字用途改用較深的 `--accent-ink` 才讀得清楚
- 設定頁「外觀」：跟隨系統／淺色／深色，點了立即生效；存在 localStorage `tapread.appearance`，啟動時寫到 `<html data-theme>`（`src/lib/appearance.ts`）
- 閱讀頁紙張「跟隨系統」時，書本內文跟著設定頁手動選的深淺色
- 測試：253 個單元測試

### 片語、匯出 Word、閱讀統計（2026-10-18）
- **片語查詢與收藏**：書中拖曳選取幾個字（最多 8 個字），選取停下後上方出現「查詢『…』」按鈕；送給 AI 時改用 phrase 的提示，lemma 為原形片語（例如 se dio cuenta → darse cuenta）。收藏後以段落為單位比對（可跨 `<em>` 等標籤），片語內的單字不重複上色（`src/lib/text/selectPhrase.ts`、`phraseMatch.ts`）
- **匯出 Word**：單字本「匯出 Word」把目前篩選出的字（單字、CEFR、詞性、意思、書中例句＋此句意思＋書名）做成 .docx 表格；用 fflate 自行組 docx，不加套件（`src/lib/vocab/exportDocx.ts`）。平板手機走分享選單（`src/lib/saveFile.ts`，備份也共用）
- **閱讀統計與目標**：閱讀頁計時，最近 3 分鐘內有翻頁、點字、選字才算，切到背景暫停，每分鐘寫入 IndexedDB（v6 新增 `readingDays`）。書架首頁統計卡：今天分鐘數對照每日目標（可選 5–90 分鐘，存 localStorage `tapread.readingGoal`）、連續天數（一天讀滿 1 分鐘才算）、最近 7 天長條圖、7 天新收藏的字
- 備份加入閱讀紀錄：同一天取較多的那份，重複匯入不會加倍
- 發布腳本拿掉 commit 訊息中的 AI 署名（GitHub 不顯示 Claude 為貢獻者）
- 測試：288 個單元測試

### 目錄、發音、整句翻譯、書摘、貼上文章（2026-10-18）
- **目錄與進度跳轉**：閱讀頁右上「目錄」面板（巢狀目錄最多三層，標示目前章節）；底部改成可拖曳的進度條，放開才跳轉（`TocPanel.svelte`、`src/lib/reading/toc.ts`）
- **發音**：查詞卡片的喇叭念單字（較慢）、「念整句」念所在句子；用瀏覽器內建語音（免費、離線），優先選高品質語音、避開 Eddy／Grandma 等趣味語音（`src/lib/speech.ts`）
- **整句翻譯**：選取超過 8 個字（或 80 字元）改顯示「翻譯」，回傳台灣繁中翻譯＋最多 5 個文法重點；翻譯快取在 IndexedDB v7 `translations`。Gemini 呼叫改為共用的 JSON 產生器（`createGeminiJson`），查詞與翻譯共用逾時、重試、錯誤分類
- **劃線與書摘**：選取後可按「劃線」，翻譯卡片也能劃線；書頁上以淡金色標示（CSS Highlight `pr-quote`）。書的頁面新增「書摘」：原文、章節、日期、註記（離開輸入框時儲存）、回到書中、刪除。IndexedDB v7 `highlights`；刪除書時一併刪除；備份包含書摘（書號自動對應、同位置不重複）
- **貼上文章**：書架「貼上文章」貼上外文即可當書讀，以 # 開頭的行當章節；存成 .txt（新增 txt 格式，也可直接匯入 .txt 檔）
- 滑桿（字級、進度）改奶茶色樣式
- 測試：317 個單元測試

### 下一步
- 自動同步到使用者自己的 Google 雲端硬碟（需在 Google Cloud 建 OAuth 用戶端；測試階段要逐一加入使用者的 Gmail）
- P3：詞形還原（收藏 abrir 後，書中 abre、abrió 也上色）

