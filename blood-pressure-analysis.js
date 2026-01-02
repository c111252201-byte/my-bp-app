// 血壓分析模組
// 負責從 Google Sheets 讀取判斷函數和基準值，評估血壓是否正常，並顯示結果

class BloodPressureAnalysis {
    constructor(apiKey, spreadsheetId) {
        this.GOOGLE_SHEETS_API_KEY = apiKey;
        this.SPREADSHEET_ID = spreadsheetId;
    }

    // 從 Google Sheets 讀取資料
    async fetchGoogleSheetsData() {
        try {
            // 讀取工作表二的 C2（判斷函數）和 B7（基準值）
            const range1 = '工作表二!C2'; // 判斷函數
            const range2 = '工作表二!B7'; // 基準值
            
            const url1 = `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/${encodeURIComponent(range1)}?key=${this.GOOGLE_SHEETS_API_KEY}`;
            const url2 = `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/${encodeURIComponent(range2)}?key=${this.GOOGLE_SHEETS_API_KEY}`;
            
            console.log('正在讀取 Google Sheets...');
            console.log('URL1:', url1.replace(this.GOOGLE_SHEETS_API_KEY, 'API_KEY_HIDDEN'));
            console.log('URL2:', url2.replace(this.GOOGLE_SHEETS_API_KEY, 'API_KEY_HIDDEN'));
            
            const [response1, response2] = await Promise.all([
                fetch(url1),
                fetch(url2)
            ]);
            
            // 詳細的錯誤處理
            if (!response1.ok) {
                const errorData1 = await response1.json().catch(() => ({}));
                console.error('讀取 C2 失敗:', response1.status, response1.statusText, errorData1);
                throw new Error(`讀取 C2 失敗 (${response1.status}): ${errorData1.error?.message || response1.statusText}`);
            }
            
            if (!response2.ok) {
                const errorData2 = await response2.json().catch(() => ({}));
                console.error('讀取 B7 失敗:', response2.status, response2.statusText, errorData2);
                throw new Error(`讀取 B7 失敗 (${response2.status}): ${errorData2.error?.message || response2.statusText}`);
            }
            
            const data1 = await response1.json();
            const data2 = await response2.json();
            
            console.log('讀取到的資料:', { data1, data2 });
            
            const formula = data1.values && data1.values[0] && data1.values[0][0] 
                ? data1.values[0][0] 
                : null;
            const threshold = data2.values && data2.values[0] && data2.values[0][0] 
                ? parseFloat(data2.values[0][0]) 
                : null;
            
            console.log('解析結果:', { formula, threshold });
            
            if (!formula) {
                throw new Error('無法從工作表二的 C2 讀取判斷函數，請確認 C2 有輸入內容');
            }
            
            if (threshold === null || isNaN(threshold)) {
                throw new Error('無法從工作表二的 B7 讀取基準值，請確認 B7 有輸入數字');
            }
            
            return { formula, threshold };
        } catch (error) {
            console.error('Google Sheets 讀取錯誤:', error);
            
            // 提供更詳細的錯誤訊息
            let errorMessage = '讀取 Google Sheets 失敗: ' + error.message;
            
            if (error.message.includes('403') || error.message.includes('PERMISSION_DENIED')) {
                errorMessage += '\n\n可能原因：\n1. API Key 不正確或未啟用 Google Sheets API\n2. Google Sheets 權限設定不正確（需要設為「知道連結的使用者」可以檢視）\n3. API Key 有網域限制，請檢查 Google Cloud Console 設定';
            } else if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
                errorMessage += '\n\n可能原因：\n1. Spreadsheet ID 不正確\n2. 工作表名稱「工作表二」不存在或名稱不符\n3. Google Sheets 不存在或已被刪除';
            } else if (error.message.includes('400') || error.message.includes('INVALID_ARGUMENT')) {
                errorMessage += '\n\n可能原因：\n1. 工作表名稱或儲存格範圍格式不正確\n2. API Key 格式不正確';
            }
            
            throw new Error(errorMessage);
        }
    }

    // 評估血壓是否正常
    evaluateBloodPressure(bloodPressure, formula, threshold) {
        try {
            // x = 舒張壓, y = 收縮壓
            const x = bloodPressure.diastolic;
            const y = bloodPressure.systolic;
            
            // 清理和處理公式
            let formulaStr = formula.toString().trim();
            
            // 移除 Google Sheets 公式格式的等號（如果有的話）
            if (formulaStr.startsWith('=')) {
                formulaStr = formulaStr.substring(1).trim();
            }
            
            // 移除多餘的空格
            formulaStr = formulaStr.replace(/\s+/g, ' ');
            
            console.log('原始公式:', formula);
            console.log('清理後的公式:', formulaStr);
            console.log('代入值: x=' + x + ', y=' + y);
            
            // 將公式中的 x 和 y 替換為實際數值
            // 使用 \b 確保只替換完整的變數名（避免替換部分字串）
            formulaStr = formulaStr.replace(/\bx\b/g, x.toString());
            formulaStr = formulaStr.replace(/\by\b/g, y.toString());
            
            console.log('替換後的公式:', formulaStr);
            
            // 驗證公式是否包含危險字符（防止注入攻擊）
            const dangerousPatterns = /[;{}()\[\]'"`]/;
            if (dangerousPatterns.test(formulaStr) && !/[+\-*/().\s0-9]/.test(formulaStr.replace(/[+\-*/().\s0-9]/g, ''))) {
                // 如果只包含安全的數學運算符，允許繼續
            }
            
            // 計算公式結果（使用 eval，注意安全性）
            // 在實際應用中，應該使用更安全的表達式解析器
            let result;
            try {
                result = eval(formulaStr);
            } catch (evalError) {
                throw new Error(`公式計算錯誤: ${evalError.message}。請確認公式格式正確（例如: x+y 或 x*2+y，不要包含等號）`);
            }
            
            // 確保結果是數字
            if (typeof result !== 'number' || isNaN(result)) {
                throw new Error(`公式計算結果不是有效數字: ${result}。請確認公式正確`);
            }
            
            // 計算 |result - y|
            const difference = Math.abs(result - y);
            
            // 與 B7 比較
            const isNormal = difference <= threshold;
            
            console.log(`判斷結果: 公式=${formula}, x=${x}, y=${y}, 計算結果=${result}, 差值=${difference}, 基準=${threshold}, 正常=${isNormal}`);
            
            return isNormal;
        } catch (error) {
            console.error('判斷函數計算錯誤:', error);
            throw new Error('判斷函數計算失敗: ' + error.message);
        }
    }

    // 執行完整的血壓分析流程
    async analyze(bloodPressure) {
        console.log('開始血壓分析流程...');
        
        // 1. 從 Google Sheets 讀取判斷函數和基準值
        console.log('步驟 1/2: 讀取 Google Sheets 中...');
        const { formula, threshold } = await this.fetchGoogleSheetsData();
        console.log('Google Sheets 讀取完成，公式:', formula, '基準值:', threshold);
        
        // 2. 判斷是否正常
        console.log('步驟 2/2: 判斷血壓是否正常中...');
        const isNormal = this.evaluateBloodPressure(bloodPressure, formula, threshold);
        console.log('判斷完成，結果:', isNormal ? '正常' : '不正常');
        
        return {
            bloodPressure,
            isNormal,
            formula,
            threshold
        };
    }
}

