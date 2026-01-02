# 問題排除指南

## 錯誤：讀取 Google Sheets 失敗

如果看到「讀取 Google Sheets 失敗」的錯誤，請按照以下步驟檢查：

### 1. 檢查 API Key

**確認 API Key 是否正確：**
- 前往 [Google Cloud Console](https://console.cloud.google.com/)
- 選擇您的專案
- 前往「API 和服務」>「憑證」
- 確認 API Key 與 `app.js` 中的 `GOOGLE_SHEETS_API_KEY` 一致

**確認 Google Sheets API 已啟用：**
- 前往「API 和服務」>「程式庫」
- 搜尋「Google Sheets API」
- 確認狀態為「已啟用」

### 2. 檢查 Spreadsheet ID

**確認 Spreadsheet ID 是否正確：**
- 開啟您的 Google Sheets
- 查看網址：`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
- 確認 `app.js` 中的 `SPREADSHEET_ID` 只包含 ID 部分（不是整個網址）

**範例：**
```javascript
// ✅ 正確
const SPREADSHEET_ID = '1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg';

// ❌ 錯誤
const SPREADSHEET_ID = 'https://docs.google.com/spreadsheets/d/1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg/edit';
```

### 3. 檢查 Google Sheets 權限

**確認 Google Sheets 權限設定：**
1. 開啟您的 Google Sheets
2. 點擊右上角的「共用」按鈕
3. 在「取得連結」部分，選擇「知道連結的使用者」
4. 權限設為「檢視者」
5. 確認已啟用連結共用

**重要：** Google Sheets 必須設為可以透過連結存取，否則 API 無法讀取。

### 4. 檢查工作表名稱

**確認工作表名稱是否正確：**
- 確認您的 Google Sheets 中有名為「工作表二」的工作表
- 工作表名稱必須完全一致（包括大小寫和空格）
- 如果工作表名稱不同，請修改 `app.js` 中的工作表名稱

**修改方式：**
在 `app.js` 中找到：
```javascript
const range1 = '工作表二!C2'; // 判斷函數
const range2 = '工作表二!B7'; // 基準值
```

如果您的實際工作表名稱是「Sheet2」或其他名稱，請修改為：
```javascript
const range1 = 'Sheet2!C2'; // 判斷函數
const range2 = 'Sheet2!B7'; // 基準值
```

### 5. 檢查儲存格內容

**確認儲存格有內容：**
- **工作表二的 C2**：必須有輸入判斷函數（例如：`x + y` 或 `x * 2 + y`）
- **工作表二的 B7**：必須有輸入數字（例如：`10` 或 `20`）

**檢查方式：**
1. 開啟 Google Sheets
2. 切換到「工作表二」
3. 確認 C2 儲存格有內容
4. 確認 B7 儲存格有數字

### 6. 檢查瀏覽器主控台

**查看詳細錯誤訊息：**
1. 在瀏覽器中按 `F12` 開啟開發者工具
2. 切換到「Console」（主控台）分頁
3. 重新執行辨識
4. 查看錯誤訊息，會顯示更詳細的資訊

### 7. 測試 API 連線

**手動測試 API：**
在瀏覽器網址列輸入以下網址（替換為您的實際值）：
```
https://sheets.googleapis.com/v4/spreadsheets/YOUR_SPREADSHEET_ID/values/工作表二!C2?key=YOUR_API_KEY
```

如果看到 JSON 格式的資料，表示 API 連線正常。
如果看到錯誤訊息，請根據錯誤訊息進行修正。

### 8. 檢查 API Key 限制

**如果設定了 API Key 限制：**
- 確認 HTTP 參照網址包含您目前使用的網址
- 如果是在本地測試（`localhost`），需要加入 `http://localhost:*`
- 如果已部署到 GitHub Pages，需要加入 `https://yourusername.github.io/*`

### 常見錯誤訊息對照

| 錯誤訊息 | 可能原因 | 解決方法 |
|---------|---------|---------|
| 403 PERMISSION_DENIED | API Key 不正確或權限不足 | 檢查 API Key 和 Google Sheets 權限 |
| 404 NOT_FOUND | Spreadsheet ID 或工作表名稱錯誤 | 檢查 ID 和工作表名稱 |
| 400 INVALID_ARGUMENT | 儲存格範圍格式錯誤 | 檢查工作表名稱和儲存格範圍 |
| 無法讀取判斷函數 | C2 儲存格為空 | 在 C2 輸入判斷函數 |
| 無法讀取基準值 | B7 儲存格為空或不是數字 | 在 B7 輸入數字 |

### 需要協助？

如果以上步驟都檢查過了還是無法解決，請提供：
1. 瀏覽器主控台的完整錯誤訊息
2. API Key 的前幾碼（例如：`AIzaSy...`）
3. Spreadsheet ID
4. 工作表名稱





