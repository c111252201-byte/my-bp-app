# 血壓機 OCR 辨識系統

這是一個使用 GitHub Pages 架設的前端網站，可以在瀏覽器端進行影像辨識（OCR）來讀取血壓機螢幕上的數字，並使用 Google Sheets 作為基準資料庫進行判斷。

## 功能特點

- 📸 上傳血壓機照片進行辨識
- 🖼️ 自動灰階處理提升辨識準確度
- 🔍 使用 Tesseract.js 進行瀏覽器端 OCR 辨識
- 📊 整合 Google Sheets API 讀取判斷基準
- ✅ 自動判斷血壓數值是否正常

## 設定步驟

### 1. Google Sheets API 設定

#### 方法一：使用 API Key（推薦，較簡單）

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Sheets API：
   - 在左側選單選擇「API 和服務」>「程式庫」
   - 搜尋「Google Sheets API」
   - 點擊進入並按下「啟用」
4. 建立 API 金鑰：
   - 前往「API 和服務」>「憑證」
   - 點擊「建立憑證」>「API 金鑰」
   - 複製產生的 API 金鑰
5. （建議）設定 API 金鑰限制：
   - 點擊剛建立的 API 金鑰進行編輯
   - 在「API 限制」中選擇「限制金鑰」
   - 勾選「Google Sheets API」
   - 在「應用程式限制」中可以設定 HTTP 參照網址（限制只能從特定網域使用）

#### 方法二：使用服務帳戶（進階，更安全）

如果您選擇建立服務帳戶，請按照以下步驟：

1. 前往「API 和服務」>「憑證」
2. 點擊「建立憑證」>「服務帳戶」
3. 填寫服務帳戶資訊：
   - **服務帳戶名稱**：可以填寫任何有意義的名稱，例如：
     - `blood-pressure-ocr-service`
     - `sheets-reader-service`
     - `血壓辨識服務`
   - **服務帳號ID**：系統會自動根據服務帳戶名稱產生，通常格式為 `服務帳戶名稱@專案ID.iam.gserviceaccount.com`
     - 您可以保持預設值，或自行修改（只能使用小寫字母、數字和連字號）
     - 例如：`blood-pressure-ocr@your-project-id.iam.gserviceaccount.com`
4. 點擊「建立並繼續」
5. 選擇角色（可選）：可以選擇「檢視者」或跳過
6. 點擊「完成」
7. 建立金鑰：
   - 點擊剛建立的服務帳戶
   - 前往「金鑰」分頁
   - 點擊「新增金鑰」>「建立新金鑰」
   - 選擇「JSON」格式並下載
   - **注意**：此方法需要後端伺服器，不適合純前端 GitHub Pages 使用

**重要說明**：本專案建議使用**方法一（API Key）**，因為：
- 更簡單，適合前端應用
- 不需要後端伺服器
- 可以直接在瀏覽器中使用

### 2. 設定 Google Sheets

1. 建立或開啟您的 Google Sheets
2. 確保有兩個工作表：
   - **工作表一**：包含編號、收縮壓、舒張壓、脈拍（此工作表不需要處理）
   - **工作表二**：
     - **C2**：輸入判斷函數（使用 x 代表舒張壓，y 代表收縮壓）
     - **B7**：輸入基準值（用於比較的閾值）
3. 將 Google Sheets 設為「知道連結的使用者」可以檢視（Viewer 權限即可）
4. 複製 Google Sheets 的 ID：
   - 開啟您的 Google Sheets
   - 查看瀏覽器網址列，網址格式為：`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...`
   - **只需要複製 `/d/` 和 `/edit` 之間的那段 ID**，例如：
     - 完整網址：`https://docs.google.com/spreadsheets/d/1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg/edit?gid=455702711#gid=455702711`
     - **只需要這部分**：`1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg`
   - **不要貼整個網址，只貼 ID 部分！**

### 3. 更新配置

編輯專案根目錄下的 `app.js` 檔案，找到檔案開頭的第 2-3 行，更新以下兩個變數：

**檔案位置**：`app.js`（專案根目錄）

**需要修改的程式碼**（位於 `app.js` 的第 2-3 行）：

```2:3:app.js
const GOOGLE_SHEETS_API_KEY = 'YOUR_API_KEY'; // 需要替換為實際的 API Key
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 需要替換為實際的 Google Sheets ID
```

**修改步驟**：
1. 用文字編輯器（如 VS Code、Notepad++ 等）開啟 `app.js` 檔案
2. 找到第 2 行的 `'YOUR_API_KEY'`，替換為您在步驟 1 中複製的 Google Sheets API Key
3. 找到第 3 行的 `'YOUR_SPREADSHEET_ID'`，替換為您在步驟 2 中複製的 Google Sheets ID
   - **重要**：只貼 ID 部分，不要貼整個網址！
   - 從網址 `https://docs.google.com/spreadsheets/d/ID/edit...` 中，只複製 `ID` 那一段
4. 儲存檔案

**範例**：
```javascript
// ✅ 正確：只貼 ID
const GOOGLE_SHEETS_API_KEY = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const SPREADSHEET_ID = '1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg';

// ❌ 錯誤：不要貼整個網址
const SPREADSHEET_ID = 'https://docs.google.com/spreadsheets/d/1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg/edit';
```

### 4. 部署到 GitHub Pages

1. 將所有檔案上傳到 GitHub 儲存庫
2. 前往儲存庫的 Settings > Pages
3. 選擇分支和資料夾（通常是 `main` 和 `/root`）
4. 儲存後等待幾分鐘，GitHub Pages 會自動部署

## 使用方式

1. 開啟網站
2. 點擊「選擇血壓機照片」上傳圖片
3. 點擊「開始辨識」
4. 系統會自動：
   - 將圖片轉換為灰階
   - 進行 OCR 辨識
   - 解析血壓數值（收縮壓、舒張壓、脈拍）
   - 從 Google Sheets 讀取判斷函數和基準值
   - 計算並顯示是否正常

## 判斷邏輯

系統會：
1. 從 OCR 結果中提取收縮壓（y）和舒張壓（x）
2. 將 x 和 y 代入工作表二的 C2 判斷函數
3. 計算 `|判斷函數結果 - y|`
4. 與工作表二的 B7 基準值比較
5. 如果差值 > B7：顯示「不正常」
6. 如果差值 ≤ B7：顯示「正常」

## 技術架構

- **前端框架**：純 HTML/CSS/JavaScript
- **OCR 引擎**：Tesseract.js（瀏覽器端）
- **資料庫**：Google Sheets API
- **部署平台**：GitHub Pages

## 注意事項

- 確保上傳的圖片清晰，血壓機螢幕上的數字清楚可見
- Google Sheets 需要設為公開或至少允許檢視權限
- API Key 會暴露在前端程式碼中，建議設定 API Key 限制（限制只能存取特定 Spreadsheet）

## 授權

MIT License



