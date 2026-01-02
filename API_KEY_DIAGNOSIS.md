# API Key 無效問題診斷指南

## 錯誤訊息
```
讀取 C2 失敗 (400): API key not valid. Please pass a valid API key.
```

## 逐步檢查清單

### ✅ 步驟 1：確認 API Key 格式

您的 API Key：`AIzaSyAhpPKpchhC2d_xzEk_VLuzndBiOndER5M`

檢查項目：
- [x] 以 `AIza` 開頭 ✅
- [x] 長度約 39 個字元 ✅
- [x] 格式正確 ✅

**結論：API Key 格式正確**

---

### ✅ 步驟 2：確認 Google Sheets API 已啟用

**檢查方法：**

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 確認您選擇的是**正確的專案**（建立 API Key 時使用的專案）
3. 前往「API 和服務」>「程式庫」
4. 搜尋「Google Sheets API」
5. 檢查狀態：
   - ✅ **已啟用** → 繼續下一步
   - ❌ **未啟用** → 點擊「啟用」按鈕，等待幾秒鐘

**如果未啟用，請啟用後等待 1-2 分鐘再測試**

---

### ✅ 步驟 3：檢查 API Key 是否屬於正確的專案

**檢查方法：**

1. 前往「API 和服務」>「憑證」
2. 找到您的 API Key：`AIzaSyAhpPKpchhC2d_xzEk_VLuzndBiOndER5M`
3. 點擊 API Key 名稱進入詳情
4. 確認：
   - API Key 狀態為「已啟用」
   - 屬於正確的專案

**如果找不到這個 API Key，可能需要重新建立**

---

### ✅ 步驟 4：檢查 API Key 限制設定

**這是最常見的問題！**

1. 在「憑證」頁面，點擊您的 API Key
2. 檢查「API 限制」區塊：
   - 如果選擇「限制金鑰」：
     - ✅ 確認有勾選「Google Sheets API」
     - ❌ 如果沒有勾選，請勾選並儲存
   - 如果選擇「無限制」：
     - ✅ 這應該沒問題

3. **重要：檢查「應用程式限制」區塊：**
   - 如果選擇「無限制」：
     - ✅ 這應該沒問題
   - 如果選擇「HTTP 參照網址（網站）」：
     - ❌ **這可能是問題所在！**
     - 檢查是否有加入您目前使用的網址：
       - 本地測試：`http://localhost:*` 或 `http://127.0.0.1:*`
       - 檔案系統：`file:///*`（通常不支援）
       - GitHub Pages：`https://yourusername.github.io/*`
     - **如果沒有加入，請新增或暫時改為「無限制」**

---

### ✅ 步驟 5：測試 API Key（在瀏覽器直接測試）

**在瀏覽器網址列輸入（完整複製貼上）：**

```
https://sheets.googleapis.com/v4/spreadsheets/1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg/values/工作表二!C2?key=AIzaSyAhpPKpchhC2d_xzEk_VLuzndBiOndER5M
```

**預期結果：**

✅ **成功** - 看到 JSON 資料：
```json
{
  "range": "工作表二!C2",
  "majorDimension": "ROWS",
  "values": [
    ["您的判斷函數"]
  ]
}
```

❌ **失敗** - 看到錯誤訊息：
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid..."
  }
}
```

---

### ✅ 步驟 6：如果仍然失敗，重新建立 API Key

**如果以上步驟都檢查過了還是失敗，請重新建立 API Key：**

1. 前往「API 和服務」>「憑證」
2. 找到舊的 API Key，點擊垃圾桶圖示刪除（可選）
3. 點擊「建立憑證」>「API 金鑰」
4. **立即複製新的 API Key**
5. **暫時不要設定任何限制**（先測試是否能運作）
6. 更新 `app.js` 中的 API Key
7. 測試是否能正常運作
8. 確認運作正常後，再設定 API 限制

---

## 常見問題與解決方案

### 問題 1：API Key 有 HTTP 參照網址限制

**症狀：**
- API Key 格式正確
- Google Sheets API 已啟用
- 但在瀏覽器中測試失敗

**解決方案：**
1. 前往 API Key 設定頁面
2. 在「應用程式限制」中：
   - 暫時改為「無限制」測試
   - 或新增您目前使用的網址

### 問題 2：在本地檔案系統開啟 HTML

**症狀：**
- 使用 `file:///` 開啟 HTML 檔案
- API Key 無效

**解決方案：**
- 使用本地伺服器（例如：VS Code 的 Live Server）
- 或在 API Key 限制中加入 `file:///*`（但 Google 可能不支援）

### 問題 3：API Key 屬於不同的專案

**症狀：**
- 有多個 Google Cloud 專案
- API Key 在專案 A，但 Google Sheets API 在專案 B

**解決方案：**
- 確認 API Key 和 Google Sheets API 在同一個專案中

---

## 快速修復步驟（推薦）

如果急於解決問題，請按照以下順序：

1. **確認 Google Sheets API 已啟用**
2. **暫時移除 API Key 的所有限制**（改為「無限制」）
3. **測試是否能正常運作**
4. **確認運作正常後，再逐步加入限制**

---

## 需要協助？

如果以上步驟都嘗試過了還是無法解決，請提供：

1. 在瀏覽器網址列直接測試 API 的完整錯誤訊息
2. API Key 的「API 限制」設定（截圖）
3. API Key 的「應用程式限制」設定（截圖）
4. Google Sheets API 的啟用狀態（截圖）





