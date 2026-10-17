# 第三方原始碼（vendored）

| 套件 | 來源 | 版本 | 授權 |
|---|---|---|---|
| foliate-js | https://github.com/johnfactotum/foliate-js | commit `78914aef4466eb960965702401634c2cb348e9b1`（2026-05-01） | MIT |

foliate-js 沒有發布到 npm，因此直接固定 commit 放在此處。升級步驟：

1. 下載新 commit 的 tarball 覆蓋 `vendor/foliate-js/`
2. 更新上表的 commit
3. `npm test && npm run build`，並手動開一本 EPUB 確認翻頁與記住位置
