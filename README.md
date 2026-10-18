# TapRead

網址：https://tccccy.github.io/tapread/

讀外文書時，點一下不懂的字，就會看到它**在這一句裡**的中文意思；想記住的字可以收藏進單字本，用閃卡複習。

- 支援 **EPUB、PDF（文字型）、Word（.docx）**
- 不限英文：西班牙文、葡萄牙文、義大利文、法文、德文……都可以
- 電腦、平板、手機的瀏覽器都能用，可以「加入主畫面」當 App 使用

## 開始使用

1. 打開網站
2. 到 [Google AI Studio](https://aistudio.google.com/apikey) 免費申請一把 Gemini API 金鑰
3. 在 App 的「設定」貼上金鑰，按「測試並儲存」
4. 匯入一本書，點字開始讀

## 隱私

- 書、單字本、金鑰**都只存在你自己的瀏覽器**，不會上傳到任何伺服器
- 點字時，只會把「這個字、所在句子與前後各一句、書名」送給 Google Gemini
- Gemini 免費方案送出的內容可能被 Google 用來改善產品；介意的話可以在 AI Studio 綁定付費方案
- iPad 建議「加入主畫面」，Safari 對沒加入主畫面的網站可能會清除本機資料

## 開發

需要 Node 22（≥ 22.13）。

```bash
npm ci
npm run dev        # 開發伺服器
npm run check      # 型別檢查
npm test           # 單元測試
npm run build      # 正式建置（輸出到 dist/）
```

推送到 `main` 會由 GitHub Actions 自動測試、建置並部署到 GitHub Pages。開發計畫與設計紀錄見 [PLAN.md](PLAN.md)。

## 授權與第三方元件

- [foliate-js](https://github.com/johnfactotum/foliate-js)（MIT）：EPUB／PDF 閱讀元件，固定版本放在 `vendor/`
- [PDF.js](https://github.com/mozilla/pdf.js)（Apache-2.0）：隨 foliate-js 附帶
- [mammoth](https://github.com/mwilliamson/mammoth.js)（BSD-2-Clause）：Word 轉 HTML
