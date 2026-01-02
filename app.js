// Google Sheets API 配置
const GOOGLE_SHEETS_API_KEY = 'AIzaSyAhpPKpchhC2d_xzEk_VLuzndBiOndER5M'; // 需要替換為實際的 API Key（格式：AIzaSy...，約39個字元）
const SPREADSHEET_ID = '1BAEfRh6-wykvTDzzo-jkW3DDOGVHXcwC3mUmr-qNcmg'; // 需要替換為實際的 Google Sheets ID

// 初始化模組
let ocrRecognition = null;
let bloodPressureAnalysis = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeModules();
    setupEventListeners();
});

// 初始化模組
async function initializeModules() {
    try {
        // 初始化 OCR 辨識模組
        ocrRecognition = new OCRRecognition();
        await ocrRecognition.initialize();
        console.log('OCR 辨識模組初始化完成');
        
        // 初始化血壓分析模組
        bloodPressureAnalysis = new BloodPressureAnalysis(GOOGLE_SHEETS_API_KEY, SPREADSHEET_ID);
        console.log('血壓分析模組初始化完成');
        
        // 如果已經選擇了圖片，啟用按鈕
        if (ocrRecognition.getSelectedImage()) {
            const processBtn = document.getElementById('processBtn');
            if (processBtn) {
                processBtn.disabled = false;
                console.log('OCR 引擎初始化完成，已選擇圖片，按鈕已啟用');
            }
        }
    } catch (error) {
        console.error('模組初始化失敗:', error);
        showError('模組初始化失敗: ' + error.message + '。請重新整理頁面');
        hideLoading();
    }
}

// 設置事件監聽器
function setupEventListeners() {
    const imageInput = document.getElementById('imageInput');
    const processBtn = document.getElementById('processBtn');
    const resetBtn = document.getElementById('resetBtn');
    const uploadLabel = document.querySelector('.upload-label');

    if (!imageInput) {
        console.error('找不到 imageInput 元素');
        return;
    }

    // 檔案選擇事件
    imageInput.addEventListener('change', handleImageSelect);
    
    // 點擊標籤時觸發檔案選擇
    if (uploadLabel) {
        uploadLabel.addEventListener('click', (e) => {
            // 如果點擊的是 label 本身，觸發 input 點擊
            if (e.target === uploadLabel || e.target.tagName === 'SPAN') {
                e.preventDefault();
                imageInput.click();
            }
        });
    }

    // 按鈕事件
    if (processBtn) {
        processBtn.addEventListener('click', handleProcess);
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', handleReset);
    }
    
    // 清除記錄按鈕
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
    }

    console.log('事件監聽器設置完成');
    
    // 載入歷史記錄
    loadHistory();
}

// 處理圖片選擇
async function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('未選擇檔案');
        return;
    }

    // 確保 loading 狀態是隱藏的
    hideLoading();

    try {
        // 使用 OCR 辨識模組處理圖片選擇
        await ocrRecognition.handleImageSelect(file);
        
        // 顯示圖片預覽
        const selectedImage = ocrRecognition.getSelectedImage();
        displayImagePreview(selectedImage);
        
        // 只有在圖片載入成功且 OCR 引擎已初始化時才啟用按鈕
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            if (ocrRecognition.isReady()) {
                processBtn.disabled = false;
                console.log('圖片載入成功，按鈕已啟用');
            } else {
                processBtn.disabled = true;
                console.log('圖片載入成功，但 OCR 引擎尚未初始化，按鈕保持禁用');
            }
        }
        
        hideResults();
        hideError();
        hideLoading();
        console.log('圖片載入完成');
    } catch (error) {
        console.error('處理圖片時發生錯誤:', error);
        showError('處理圖片時發生錯誤: ' + error.message);
        hideLoading();
        
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.disabled = true;
        }
    }
}

// 顯示圖片預覽
function displayImagePreview(imageSrc) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<img src="${imageSrc}" alt="預覽圖片">`;
}

// 處理辨識流程
async function handleProcess() {
    console.log('handleProcess 被調用');
    
    if (!ocrRecognition || !ocrRecognition.isReady()) {
        showError('請先選擇圖片，並等待 OCR 引擎初始化完成');
        hideLoading();
        return;
    }

    // 禁用按鈕防止重複點擊
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.disabled = true;
    }

    showLoading();
    hideError();
    hideResults();

    let ocrResult = null;
    let bloodPressure = null;
    
    try {
        console.log('開始處理流程...');
        
        // 步驟 1: 影像辨識（OCR 辨識）- 使用多策略識別
        console.log('=== 步驟 1: 影像辨識（OCR） ===');
        const recognitionResult = await ocrRecognition.recognize();
        bloodPressure = recognitionResult.bloodPressure;
        ocrResult = recognitionResult.ocrText || '';
        console.log('OCR 辨識完成，血壓數值:', bloodPressure);
        console.log('OCR 原始文字:', ocrResult);
        
        // 步驟 3: 血壓分析（使用血壓分析模組）
        console.log('=== 步驟 3: 血壓分析 ===');
        const analysisResult = await bloodPressureAnalysis.analyze(bloodPressure);
        console.log('血壓分析完成，結果:', analysisResult);
        
        // 顯示結果
        displayResults(analysisResult.bloodPressure, analysisResult.isNormal);
        
        // 添加到歷史記錄
        addToHistory({
            timestamp: new Date(),
            bloodPressure: analysisResult.bloodPressure,
            isNormal: analysisResult.isNormal,
            ocrText: ocrResult ? ocrResult.substring(0, 200) : '' // 只保存前200個字元
        });
        
        console.log('處理流程完成');
    } catch (error) {
        console.error('處理過程發生錯誤:', error);
        console.error('錯誤堆疊:', error.stack);
        showError('處理失敗: ' + error.message);
        
        // 記錄失敗的測試（如果有 OCR 結果或血壓值）
        addToHistory({
            timestamp: new Date(),
            bloodPressure: bloodPressure || { systolic: null, diastolic: null, pulse: null },
            isNormal: null,
            ocrText: ocrResult ? ocrResult.substring(0, 200) : '',
            error: error.message
        });
    } finally {
        hideLoading();
        // 重新啟用按鈕
        if (processBtn) {
            processBtn.disabled = false;
        }
        console.log('處理流程結束（finally）');
    }
}

// 顯示結果
function displayResults(bloodPressure, isNormal) {
    document.getElementById('systolic').textContent = bloodPressure.systolic || '-';
    document.getElementById('diastolic').textContent = bloodPressure.diastolic || '-';
    document.getElementById('pulse').textContent = bloodPressure.pulse || '-';
    
    const statusEl = document.getElementById('status');
    if (isNormal) {
        statusEl.textContent = '正常';
        statusEl.className = 'status normal';
    } else {
        statusEl.textContent = '不正常';
        statusEl.className = 'status abnormal';
    }
    
    document.getElementById('results').classList.remove('hidden');
}

// 重置
function handleReset() {
    if (ocrRecognition) {
        ocrRecognition.reset();
    }
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('processBtn').disabled = true;
    hideResults();
    hideError();
}

// 歷史記錄管理
function addToHistory(record) {
    try {
        const history = getHistory();
        history.unshift(record); // 添加到開頭
        // 只保留最近 50 筆記錄
        if (history.length > 50) {
            history.pop();
        }
        localStorage.setItem('bpHistory', JSON.stringify(history));
        renderHistory();
    } catch (error) {
        console.error('保存歷史記錄失敗:', error);
    }
}

function getHistory() {
    try {
        const historyStr = localStorage.getItem('bpHistory');
        if (historyStr) {
            const history = JSON.parse(historyStr);
            // 轉換時間戳為 Date 物件
            return history.map(record => ({
                ...record,
                timestamp: new Date(record.timestamp)
            }));
        }
    } catch (error) {
        console.error('讀取歷史記錄失敗:', error);
    }
    return [];
}

function loadHistory() {
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    const history = getHistory();
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">尚無測試記錄</div>';
        return;
    }
    
    historyList.innerHTML = history.map((record, index) => {
        const timeStr = record.timestamp.toLocaleString('zh-TW');
        const hasError = record.error || !record.bloodPressure;
        
        if (hasError) {
            return `
                <div class="history-item error">
                    <div class="history-header">
                        <span class="history-time">${timeStr}</span>
                        <span class="history-status error">辨識失敗</span>
                    </div>
                    <div class="history-ocr">
                        <strong>OCR 結果：</strong>${record.ocrText || '無'}
                    </div>
                    ${record.error ? `<div class="history-error">錯誤：${record.error}</div>` : ''}
                </div>
            `;
        }
        
        const statusClass = record.isNormal ? 'normal' : 'abnormal';
        const statusText = record.isNormal ? '正常' : '不正常';
        
        return `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-time">${timeStr}</span>
                    <span class="history-status ${statusClass}">${statusText}</span>
                </div>
                <div class="history-data">
                    <div class="history-data-item">
                        <span class="history-label">收縮壓：</span>
                        <span class="history-value">${record.bloodPressure.systolic || '-'}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-label">舒張壓：</span>
                        <span class="history-value">${record.bloodPressure.diastolic || '-'}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-label">脈拍：</span>
                        <span class="history-value">${record.bloodPressure.pulse || '-'}</span>
                    </div>
                </div>
                <div class="history-ocr">
                    <strong>OCR 結果：</strong>${record.ocrText || '無'}
                </div>
            </div>
        `;
    }).join('');
}

function clearHistory() {
    if (confirm('確定要清除所有測試記錄嗎？')) {
        localStorage.removeItem('bpHistory');
        renderHistory();
    }
}

// UI 輔助函數
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function hideResults() {
    document.getElementById('results').classList.add('hidden');
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}
