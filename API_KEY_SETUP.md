# Google Sheets API Key 設定指南

## 問題：API Key 無效

如果看到錯誤訊息 `"API key not valid. Please pass a valid API key."`，表示 API Key 不正確或格式錯誤。

## 正確的 API Key 格式

Google API Key 的格式應該是：
- 以 `AIza` 開頭
- 長度約 39 個字元
- 例如：`AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 重新建立 API Key 的步驟

### 步驟 1：前往 Google Cloud Console

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 使用您的 Google 帳號登入

### 步驟 2：建立或選擇專案

1. 點擊頂部的專案選擇器
2. 如果已有專案，選擇該專案
3. 如果沒有專案，點擊「新增專案」：
   - 輸入專案名稱（例如：`blood-pressure-ocr`）
   - 點擊「建立」

### 步驟 3：啟用 Google Sheets API

1. 在左側選單中，點擊「API 和服務」>「程式庫」
2. 在搜尋框中輸入「Google Sheets API」
3. 點擊「Google Sheets API」
4. 點擊「啟用」按鈕
5. 等待幾秒鐘讓 API 啟用完成

### 步驟 4：建立 API Key

1. 在左側選單中，點擊「API 和服務」>「憑證」
2. 點擊頂部的「建立憑證」按鈕
3. 在下拉選單中選擇「API 金鑰」
4. **重要**：系統會立即顯示您的 API Key，格式應該類似：
   ```
   AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. **立即複製這個 API Key**（只會顯示一次！）
6. 點擊「關閉」

### 步驟 5：驗證 API Key 格式

確認您的 API Key：
- ✅ 以 `AIza` 開頭
- ✅ 長度約 39 個字元
- ✅ 只包含字母和數字

### 步驟 6：更新 app.js

1. 開啟 `app.js` 檔案
2. 找到第 2 行：
   ```javascript
   const GOOGLE_SHEETS_API_KEY = '064e7dd5d5be4969f7a6009734c2279ed8355db1';
   ```
3. 將單引號內的內容替換為您剛複製的 API Key：
   ```javascript
   const GOOGLE_SHEETS_API_KEY = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
   ```
4. 儲存檔案

### 步驟 7：測試 API Key

在瀏覽器網址列輸入（替換為您的實際值）：
```
https://sheets.googleapis.com/v4/spreadsheets/1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg/values/工作表二!C2?key=您的API_KEY
```

如果看到 JSON 資料（不是錯誤訊息），表示 API Key 正確！

## 設定 API Key 限制（建議）

為了安全，建議設定 API Key 限制：

### 限制 API 使用範圍

1. 在「憑證」頁面，點擊您剛建立的 API Key
2. 在「API 限制」區塊：
   - 選擇「限制金鑰」
   - 在「選取 API」中，勾選「Google Sheets API」
   - 點擊「儲存」

### 限制 HTTP 參照網址（可選）

1. 在「應用程式限制」區塊：
   - 選擇「HTTP 參照網址（網站）」
   - 點擊「新增項目」
   - 輸入您的網站網址：
     - 本地測試：`http://localhost:*`
     - GitHub Pages：`https://yourusername.github.io/*`
   - 點擊「儲存」

## 常見問題

### Q: 我找不到「建立憑證」按鈕
A: 確保您已經啟用了 Google Sheets API，並且有專案管理員權限。

### Q: API Key 顯示後我忘記複製了
A: 需要重新建立新的 API Key。舊的 API Key 無法再次查看。

### Q: API Key 仍然無效
A: 請確認：
1. API Key 已正確複製（沒有多餘的空格）
2. Google Sheets API 已啟用
3. 使用的是正確的專案

### Q: 如何刪除舊的 API Key
A: 在「憑證」頁面，點擊 API Key 旁邊的垃圾桶圖示即可刪除。

## 安全提醒

⚠️ **重要**：
- API Key 會暴露在前端程式碼中
- 務必設定 API Key 限制（只允許 Google Sheets API）
- 建議設定 HTTP 參照網址限制
- 如果 API Key 洩露，請立即刪除並建立新的





