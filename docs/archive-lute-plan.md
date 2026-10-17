# 本機英文原版書閱讀器（LinguoLand 本機版）開發計畫

> 建立日期：2026-10-17
> 狀態：規劃中

---

## 1. 動機與想法

- 參考產品：[LinguoLand（語島英語閱讀）](https://www.linguoland.com/) — 讀英文原版書時生詞自動上色，點一下由 AI 結合上下文給出釋義，並記錄熟練度。
- 問題：LinguoLand 需要把電子書上傳雲端，等於把自己下載的電子書直接交給對方。
- 目標：做一套**完全在本機運作**的版本，書與查詢都不離開電腦。
- 原則：不從零造輪子，以小型開源專案為基底，只補上缺的 AI 查詞功能。

## 2. 方案選擇

| 方案 | 說明 | 預估工時 |
|---|---|---|
| **LUTE v3 + 自加 AI 查詞（採用）** | Python/Flask、MIT 授權；已支援匯入 EPUB、生詞上色、熟練度 1–5 級、本機 SQLite 詞庫。缺「AI 依上下文釋義」 | 2.5–5 天 |
| LinguaCafe | Docker 自架，介面較現代，架設較重 | — |
| 從零自建 | EPUB 解析、分詞、上色、詞庫、AI 全部自己做 | MVP 3–5 天；接近 LinguoLand 完成度 2–3 週 |

**決策**：裝 LUTE，再加一個「點詞 → 呼叫本地 LLM」的功能，LUTE 本體不改 code。

## 3. 功能範圍

### 要做
- 本機閱讀 EPUB，生詞依熟練度上色（LUTE 原生）
- 點生詞 → 本地 LLM 依「該句」給繁中釋義（核心）
- 釋義可一鍵寫回 LUTE 詞庫
- 選配：「問 AI」劇情／語氣提問、長難句精講、語法筆記

### 不做
- 跨裝置同步
- AI 閱讀插畫
- 任何雲端上傳

## 4. 系統架構

```
LUTE (localhost:5001)  ←→  Userscript（瀏覽器 Tampermonkey）
                              │ 送「單字 + 所在句子 + 書名」
                              ▼
                      本地 AI 服務 (localhost:5050, FastAPI)
                              │
                              ▼
                      Ollama (localhost:11434) + SQLite 快取
```

| 元件 | 技術 | 職責 |
|---|---|---|
| 閱讀器 | LUTE v3 (`pip install lute3`) | 匯入書、上色、詞庫、熟練度 |
| 前端注入 | Tampermonkey userscript | 抓點擊單字與所在句子、顯示釋義卡片、寫回詞庫 |
| AI 服務 | FastAPI | 組 prompt、呼叫 Ollama、快取 |
| 模型 | Ollama + `qwen2.5:7b`（備選 `qwen2.5:3b`） | 中文釋義 |
| 快取 | SQLite | key = `lemma + sentence hash` |

**設計理由**：用 userscript 外掛而非 fork LUTE，升級 LUTE 時不會衝突。

## 5. 開發階段

### Phase 0：環境建置（0.5 天）
- [ ] `pip install lute3`，啟動並建立 English 語言
- [ ] 匯入一本 EPUB 測試
- [ ] 安裝 Ollama，`ollama pull qwen2.5:7b`
- [ ] 安裝 Tampermonkey
- **檢查點**：LUTE 可閱讀、生詞有上色；`ollama run qwen2.5:7b` 能回中文且速度可接受

### Phase 1：零改動驗證（0.5 天）
- [ ] FastAPI 端點 `GET /define?w=` → 回傳 HTML 釋義頁（無上下文）
- [ ] FastAPI 端點 `GET /explain?s=` → 句子翻譯 + 語法解析
- [ ] LUTE 語言設定新增字典：`http://localhost:5050/define?w=[LUTE]`（embedded）
  - LUTE 自 3.6.0 起字典佔位符為 `[LUTE]`（舊版為 `###`）
- **檢查點**：點詞後右側分頁出現 AI 釋義
- **已知限制**：字典 URL 只帶單字，拿不到句子，多義詞會不準 → Phase 2 解決

### Phase 2：上下文釋義（1 天，核心）
- [ ] 偵察：用 DevTools 看閱讀頁 DOM — 單字 span 的 class、句子分段方式、term form 所在 iframe
- [ ] Userscript（僅在 `localhost:5001/read/*` 執行）
  1. 監聽單字點擊，往前後抓同句 span 組回整句
  2. `POST /define {word, sentence, book_title}` 到本地服務
  3. 浮出小卡片顯示結果
- [ ] AI 服務
  - Prompt 要求只回 JSON：`lemma`、`pos`、`context_meaning`（繁中，貼合此句）、`dict_meaning`、`note`
  - SQLite 快取，同句不重查
  - Ollama 呼叫加 timeout，失敗回錯誤卡片
- **檢查點**：同一個多義詞在不同句子給出不同解釋

### Phase 3：寫回 LUTE 詞庫（0.5 天）
- [ ] 卡片加「存入」按鈕 → 填入 term form 的 Translation 欄位並送出（同源 localhost，可操作 iframe）
- [ ] 熟練度沿用 LUTE 原生 1–5 級，不另建
- **檢查點**：存入後該詞顏色改變，詞庫頁看得到 AI 釋義

### Phase 4：選配功能（各 0.5–1 天）
- [ ] 「問 AI」：選取段落提問，帶書名 + 前後幾句
- [ ] 句子精講：拆解長難句，結果存成 Markdown 語法筆記
- [ ] 沿用 LUTE 內建 Anki 匯出

## 6. 時程總覽

| 範圍 | 工時 |
|---|---|
| Phase 0–1（可用，但不看上下文） | 約 1 天 |
| Phase 0–3（核心完成） | 約 2.5 天 |
| 含 Phase 4 | 約 4–5 天 |

## 7. 成本

| 項目 | 成本 |
|---|---|
| 軟體／授權（LUTE、Ollama、Qwen2.5、FastAPI、SQLite、Tampermonkey） | 0 元 |
| 電費 | 每月幾元台幣，可忽略 |
| 硬碟空間 | 7B 模型約 4–5GB；3B 約 2GB |
| 開發時間 | 核心約 2.5 天，完整約 4–5 天 |

**唯一可能花錢的情況**：電腦跑不動本地模型。
- 8GB RAM 以下或無獨顯，7B 可能每次查詞 5–15 秒 → 先改試 `qwen2.5:3b`
- 若改接雲端 API（Haiku / GPT mini 級）：每次約 500 tokens，粗估 1 萬次約 10–15 美元（以官方定價為準）。但句子片段會外傳，違背全本機初衷，列為最後備案。

## 8. 風險評估

| 風險 | 影響 | 對策 |
|---|---|---|
| LUTE 版本更新導致 DOM 結構改變 | Userscript 選擇器失效 | 固定 LUTE 版本；升級前先測試 |
| LUTE 把跨行句子切成兩句 | 送給 AI 的上下文被截斷 | 抓句子時往前後多帶一句 |
| 本地模型回錯格式或過慢 | 卡片顯示失敗、體驗差 | JSON 解析失敗重試一次；快取降低重複呼叫；必要時換小模型 |
| 改接雲端 API | 句子片段外傳 | 預設只用 Ollama；如改用需自行評估 |
| Phase 3 寫入詞庫測試 | 汙染既有詞庫資料 | **開發前先用 LUTE 設定頁的 backup 功能備份資料庫** |

## 9. 參考資料

- LinguoLand：https://www.linguoland.com/
- LUTE v3 原始碼：https://github.com/LuteOrg/lute-v3
- LUTE 3.6.0 release（`[LUTE]` 佔位符變更）：https://github.com/LuteOrg/lute-v3/releases/tag/3.6.0
- Ollama：https://ollama.com/
