# GitHub 部署指南

## 需要上傳到 GitHub 的檔案

以下檔案**全部都需要**上傳到 GitHub：

1. ✅ **index.html** - 主頁面
2. ✅ **styles.css** - 樣式檔案
3. ✅ **app.js** - 主要功能程式碼（包含 API Key 和 Spreadsheet ID）
4. ✅ **README.md** - 說明文件
5. ✅ **.gitignore** - Git 忽略檔案設定

## ⚠️ 重要安全提醒

**`app.js` 檔案中包含您的 API Key 和 Spreadsheet ID**，這些資訊會公開在 GitHub 上。

### 安全建議：

1. **設定 API Key 限制**（強烈建議）：
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 選擇您的專案
   - 前往「API 和服務」>「憑證」
   - 點擊您的 API 金鑰進行編輯
   - 在「應用程式限制」中選擇「HTTP 參照網址（網站）」
   - 新增您的 GitHub Pages 網址（例如：`https://yourusername.github.io/*`）
   - 在「API 限制」中勾選「限制金鑰」，只選擇「Google Sheets API」
   - 儲存變更

2. **限制 Google Sheets 存取權限**：
   - 確保 Google Sheets 只設為「知道連結的使用者」可以檢視
   - 不要設為完全公開

3. **定期更換 API Key**（如果發現異常使用）

## 上傳步驟

1. 在 GitHub 建立新儲存庫（Repository）
2. 將所有檔案上傳到儲存庫：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/your-repo-name.git
   git push -u origin main
   ```
3. 啟用 GitHub Pages：
   - 前往儲存庫的 Settings
   - 點擊左側的 Pages
   - 在 Source 選擇 main 分支和 / (root) 資料夾
   - 儲存後等待幾分鐘，網站就會上線

## 檔案說明

- **index.html**: 網站主頁面
- **styles.css**: 網站樣式
- **app.js**: 核心功能（OCR、Google Sheets API 整合）
- **README.md**: 專案說明文件
- **.gitignore**: 指定哪些檔案不需要上傳到 Git





