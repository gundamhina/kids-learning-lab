# Kids Learning Lab（原注音救援隊）：開發規則

## 上版
- **沒說「上版」就只在本地**：改完照常 `npm test`、`npm run build`，可以 commit，但不要 `git push`。push 到 master 會自動部署到 GitHub Pages，女兒玩的就是那一版。
- 本地試玩：`python -m http.server 8765 --directory dist`，開 http://localhost:8765/ 。
- 有離線版（`src/sw.js`，build 時填入檔案清單放到 `dist/sw.js`）：網頁一律先問網路，所以重新整理就是新打包的；錄音和圖照檔案內容雜湊快取。新增要離線用的檔案類型時，記得 build.js 的清單也要收。
- 使用者說「上版」才 push master。右下角版號（版本 · commit · 打包時間）可以用來確認手上是哪一版。
- **每個 commit 都要升版號**（`package.json` 的 `version`，跟改動放在同一個 commit）：平常升第三位（0.4.0 → 0.4.1 → 0.4.2）；第二位（0.4 → 0.5）以上要使用者說才升。

## 題庫讀音
- 注音以教育部《國語辭典簡編本》為準。改 `tools/gen_syllables.py` 後跑 `python tools/check_moe.py`（第一次會下載約 7 MB 的辭典資料到 `tools/.moe/`），要修的必須是 0。
- 新組一律接在最後：存檔的練習範圍和解鎖進度靠組的索引。
