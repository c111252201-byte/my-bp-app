// OCR 影像辨識模組
// 負責處理圖片上傳、預處理、OCR 辨識和血壓數值解析

class OCRRecognition {
    constructor() {
        this.selectedImage = null;
        this.worker = null;
    }

    // 初始化 Tesseract.js
    async initialize() {
        try {
            console.log('開始初始化 Tesseract.js...');
            
            if (this.worker) {
                try {
                    await this.worker.terminate();
                } catch (e) {
                    console.warn('終止舊 worker 時發生錯誤:', e);
                }
                this.worker = null;
            }
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Tesseract.js 初始化超時（超過 60 秒）')), 60000);
            });
            
            const initPromise = Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR 進度: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            
            this.worker = await Promise.race([initPromise, timeoutPromise]);
            
            if (typeof this.worker.recognize !== 'function') {
                throw new Error('Tesseract worker 缺少 recognize 方法');
            }
            
            console.log('Tesseract.js 初始化完成');
            return true;
        } catch (error) {
            console.error('Tesseract.js 初始化失敗:', error);
            this.worker = null;
            throw new Error('OCR 引擎初始化失敗: ' + error.message);
        }
    }

    // 處理圖片選擇
    handleImageSelect(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('未選擇檔案'));
                return;
            }

            if (!file.type.startsWith('image/')) {
                reject(new Error('請選擇圖片檔案（JPG、PNG、GIF 等）'));
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                reject(new Error('圖片檔案太大，請選擇小於 10MB 的圖片'));
                return;
            }

            console.log('選擇的檔案:', file.name, file.type, (file.size / 1024).toFixed(2) + 'KB');

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    this.selectedImage = e.target.result;
                    console.log('圖片載入完成');
                    resolve(this.selectedImage);
                } catch (error) {
                    console.error('處理圖片時發生錯誤:', error);
                    reject(new Error('處理圖片時發生錯誤: ' + error.message));
                }
            };
            
            reader.onerror = (error) => {
                console.error('讀取檔案失敗:', error);
                reject(new Error('讀取圖片檔案失敗，請重試'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    // 獲取選中的圖片
    getSelectedImage() {
        return this.selectedImage;
    }

    // 重置
    reset() {
        this.selectedImage = null;
    }

    // 檢查是否已準備好進行辨識
    isReady() {
        return this.selectedImage !== null && this.worker !== null;
    }

    // 應用銳化濾鏡（拉普拉斯算子）
    applySharpenFilter(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);
        
        // 拉普拉斯銳化核
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kIdx];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    newData[idx] = Math.max(0, Math.min(255, sum));
                }
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    // Otsu 閾值計算（自動計算最佳二值化閾值）
    calculateOtsuThreshold(histogram, totalPixels) {
        let sum = 0;
        for (let i = 0; i < 256; i++) {
            sum += i * histogram[i];
        }
        
        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let maxVariance = 0;
        let threshold = 0;
        
        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;
            
            wF = totalPixels - wB;
            if (wF === 0) break;
            
            sumB += i * histogram[i];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) * (mB - mF);
            
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = i;
            }
        }
        
        return threshold;
    }
    
    // 應用形態學操作（開運算：先腐蝕後膨脹，去除噪點）
    // 優化版本：只處理邊緣區域，提升性能
    applyMorphology(imageData, operation = 'open') {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);
        
        // 只對較小的圖片進行形態學操作（避免性能問題）
        if (width * height > 2000000) { // 如果圖片太大，跳過形態學操作
            console.log('圖片太大，跳過形態學操作以提升性能');
            return imageData;
        }
        
        // 3x3 結構元素
        const structSize = 1;
        
        if (operation === 'open') {
            // 先腐蝕（去除小噪點）
            const erodedData = new Uint8ClampedArray(data);
            for (let y = structSize; y < height - structSize; y++) {
                for (let x = structSize; x < width - structSize; x++) {
                    const idx = (y * width + x) * 4;
                    let minVal = 255;
                    
                    // 只檢查 3x3 鄰域
                    for (let dy = -structSize; dy <= structSize; dy++) {
                        for (let dx = -structSize; dx <= structSize; dx++) {
                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            minVal = Math.min(minVal, data[nIdx]);
                        }
                    }
                    
                    erodedData[idx] = minVal;
                    erodedData[idx + 1] = minVal;
                    erodedData[idx + 2] = minVal;
                }
            }
            
            // 再膨脹（恢復數字大小）
            for (let y = structSize; y < height - structSize; y++) {
                for (let x = structSize; x < width - structSize; x++) {
                    const idx = (y * width + x) * 4;
                    let maxVal = 0;
                    
                    for (let dy = -structSize; dy <= structSize; dy++) {
                        for (let dx = -structSize; dx <= structSize; dx++) {
                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            maxVal = Math.max(maxVal, erodedData[nIdx]);
                        }
                    }
                    
                    newData[idx] = maxVal;
                    newData[idx + 1] = maxVal;
                    newData[idx + 2] = maxVal;
                }
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    // 創建純灰階處理模式（專注於數字識別）
    async grayscaleOnly(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 放大圖片
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    const maxSize = 4000;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 轉換為純灰階
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        // 使用標準灰階轉換公式
                        const gray = r * 0.299 + g * 0.587 + b * 0.114;
                        
                        data[i] = gray;     // R
                        data[i + 1] = gray; // G
                        data[i + 2] = gray; // B
                        // data[i + 3] 保持 alpha 不變
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('灰階處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建邊緣檢測模式（Canny 邊緣檢測簡化版）
    async edgeDetectionMode(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    const newData = new Uint8ClampedArray(data);
                    
                    // Sobel 邊緣檢測
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            const idx = (y * width + x) * 4;
                            
                            // 轉為灰階
                            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                            
                            // Sobel X 和 Y 算子
                            const sobelX = 
                                -1 * this.getGray(data, x - 1, y - 1, width) +
                                 1 * this.getGray(data, x + 1, y - 1, width) +
                                -2 * this.getGray(data, x - 1, y, width) +
                                 2 * this.getGray(data, x + 1, y, width) +
                                -1 * this.getGray(data, x - 1, y + 1, width) +
                                 1 * this.getGray(data, x + 1, y + 1, width);
                            
                            const sobelY = 
                                -1 * this.getGray(data, x - 1, y - 1, width) +
                                -2 * this.getGray(data, x, y - 1, width) +
                                -1 * this.getGray(data, x + 1, y - 1, width) +
                                 1 * this.getGray(data, x - 1, y + 1, width) +
                                 2 * this.getGray(data, x, y + 1, width) +
                                 1 * this.getGray(data, x + 1, y + 1, width);
                            
                            const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
                            const edge = Math.min(255, magnitude * 2);
                            
                            newData[idx] = edge;
                            newData[idx + 1] = edge;
                            newData[idx + 2] = edge;
                        }
                    }
                    
                    const edgeImageData = new ImageData(newData, width, height);
                    ctx.putImageData(edgeImageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('邊緣檢測失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 輔助函數：獲取灰階值
    getGray(data, x, y, width) {
        const idx = (y * width + x) * 4;
        return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }
    
    // 創建反色模式（適用於深色背景亮數字）
    async invertColorsMode(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 轉為灰階並反色
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        const inverted = 255 - gray;
                        
                        data[i] = inverted;
                        data[i + 1] = inverted;
                        data[i + 2] = inverted;
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('反色處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建高亮度模式（增強亮部）
    async highBrightnessMode(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 轉為灰階並增強亮部
                    for (let i = 0; i < data.length; i += 4) {
                        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        
                        // 增強亮部（gamma 校正）
                        gray = Math.pow(gray / 255, 0.7) * 255;
                        
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('高亮度處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建低亮度模式（增強暗部）
    async lowBrightnessMode(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 轉為灰階並增強暗部
                    for (let i = 0; i < data.length; i += 4) {
                        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        
                        // 增強暗部（gamma 校正）
                        gray = Math.pow(gray / 255, 1.5) * 255;
                        
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('低亮度處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建灰階+對比度增強模式
    async grayscaleWithContrast(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 3000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    const maxSize = 4000;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 先轉換為灰階並計算統計
                    const grays = [];
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const gray = r * 0.299 + g * 0.587 + b * 0.114;
                        grays.push(gray);
                    }
                    
                    // 計算對比度範圍
                    grays.sort((a, b) => a - b);
                    const minVal = grays[0];
                    const maxVal = grays[grays.length - 1];
                    const range = maxVal - minVal || 1;
                    
                    // 應用對比度增強
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = grays[i / 4];
                        const enhanced = ((gray - minVal) / range) * 255 * 3.0; // 3倍增強
                        const final = Math.max(0, Math.min(255, enhanced));
                        
                        data[i] = final;
                        data[i + 1] = final;
                        data[i + 2] = final;
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('灰階+對比度處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建簡化預處理模式（最小處理，保留原始特徵）
    async minimalPreprocess(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 只放大，不進行其他處理
                    const targetSize = 2000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('圖片處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 創建高對比度模式（只增強對比度，不二值化）
    async highContrastOnly(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const targetSize = 2500;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 只增強對比度，不二值化
                    let minVal = 255, maxVal = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        minVal = Math.min(minVal, gray);
                        maxVal = Math.max(maxVal, gray);
                    }
                    
                    const range = maxVal - minVal || 1;
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        const enhanced = ((gray - minVal) / range) * 255 * 2.0; // 2倍增強
                        const final = Math.max(0, Math.min(255, enhanced));
                        data[i] = final;
                        data[i + 1] = final;
                        data[i + 2] = final;
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(new Error('圖片處理失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }
    
    // 優化圖片以提升 OCR 識別率（支援多種模式，使用 AI 級圖像處理）
    async optimizeImageForOCR(imageSrc, mode = 'aggressive') {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('圖片載入超時'));
            }, 10000);
            
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    if (!ctx) {
                        throw new Error('無法取得 Canvas 上下文');
                    }
                    
                    // 放大圖片以提高 OCR 準確度（數字需要高解析度）
                    // AI 級處理：大幅提高解析度
                    const targetSize = 3000; // 進一步提高目標尺寸
                    let width = img.width;
                    let height = img.height;
                    
                    if (width < targetSize || height < targetSize) {
                        const scale = Math.max(targetSize / width, targetSize / height);
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                        console.log(`放大圖片: ${img.width}x${img.height} -> ${width}x${height}`);
                    }
                    
                    // 限制最大尺寸（但允許更大的尺寸以提升準確度）
                    const maxSize = 4000;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 使用高品質縮放
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 第一步：先轉換為灰階（所有策略都先轉灰階）
                    let imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // 先轉換為純灰階
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const gray = r * 0.299 + g * 0.587 + b * 0.114;
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    
                    // 第二步：應用銳化濾鏡（增強邊緣）
                    imageData = ctx.getImageData(0, 0, width, height);
                    imageData = this.applySharpenFilter(imageData);
                    ctx.putImageData(imageData, 0, 0);
                    
                    // 重新獲取處理後的圖像數據
                    imageData = ctx.getImageData(0, 0, width, height);
                    const data2 = imageData.data;
                    
                    // 由於已經轉為灰階，直接使用灰階值進行分析
                    const allValues = [];
                    const brightnessValues = [];
                    let darkCount = 0, brightCount = 0;
                    
                    for (let i = 0; i < data2.length; i += 4) {
                        const gray = data2[i]; // 已經是灰階值
                        
                        allValues.push(gray);
                        brightnessValues.push(gray);
                        
                        // 檢測黑色數字（暗像素）
                        if (gray < 100) {
                            darkCount++;
                        }
                        // 檢測亮像素（可能是數字）
                        if (gray > 150) {
                            brightCount++;
                        }
                    }
                    
                    // 灰階圖片的顯示類型檢測
                    const totalPixels = data2.length / 4;
                    const isBlackText = darkCount > totalPixels / 8 && brightCount < totalPixels / 10;
                    const isBrightDisplay = brightCount > totalPixels / 15;
                    const isRedLED = false; // 灰階圖片無法檢測顏色
                    const isGreenLCD = false; // 灰階圖片無法檢測顏色
                    
                    // 計算統計信息（使用 AI 級方法）
                    allValues.sort((a, b) => a - b);
                    brightnessValues.sort((a, b) => a - b);
                    
                    const minVal = allValues[0];
                    const maxVal = allValues[allValues.length - 1];
                    const median = allValues[Math.floor(allValues.length / 2)];
                    const q1 = allValues[Math.floor(allValues.length * 0.25)];
                    const q3 = allValues[Math.floor(allValues.length * 0.75)];
                    const range = maxVal - minVal || 1;
                    
                    // 使用 Otsu 方法計算最佳閾值（AI 級自動閾值計算）
                    const histogram = new Array(256).fill(0);
                    for (let i = 0; i < allValues.length; i++) {
                        histogram[Math.round(allValues[i])]++;
                    }
                    const otsuThreshold = this.calculateOtsuThreshold(histogram, allValues.length);
                    
                    // 智能閾值選擇
                    let threshold;
                    if (isBlackText || isBrightDisplay) {
                        // 對於黑色文字或亮顯示，使用 Otsu 閾值
                        threshold = otsuThreshold;
                    } else {
                        // 對於 LED/LCD 顯示，結合 Otsu 和自適應方法
                        const adaptiveThreshold = mode === 'aggressive' ? 
                            minVal + range * 0.2 : 
                            (mode === 'conservative' ? minVal + range * 0.5 : minVal + range * 0.35);
                        threshold = (otsuThreshold + adaptiveThreshold) / 2; // 取平均值
                    }
                    
                    console.log('閾值計算:', {
                        Otsu閾值: otsuThreshold,
                        最終閾值: threshold.toFixed(1),
                        統計: {
                            最小值: minVal.toFixed(1),
                            最大值: maxVal.toFixed(1),
                            中位數: median.toFixed(1),
                            Q1: q1.toFixed(1),
                            Q3: q3.toFixed(1)
                        }
                    });
                    
                    // 應用自適應的對比度增強和二值化（使用灰階值）
                    for (let i = 0; i < data2.length; i += 4) {
                        // 由於已經是灰階，直接使用灰階值
                        let value = data2[i]; // 已經是灰階值
                        
                        // 如果是黑色文字，可能需要反轉
                        if (isBlackText && value < threshold) {
                            value = 255 - value;
                        }
                        
                        // 自適應的對比度拉伸
                        let enhanced = ((value - minVal) / range) * 255;
                        
                        // AI 級自適應增強（根據局部對比度動態調整）
                        let enhanceFactor;
                        const localContrast = Math.abs(value - median) / (range || 1);
                        
                        if (mode === 'aggressive') {
                            // 更強的增強，結合局部對比度
                            enhanceFactor = 6.0 + localContrast * 2.0; // 6-8倍
                        } else if (mode === 'conservative') {
                            enhanceFactor = 4.0 + localContrast * 1.0; // 4-5倍
                        } else {
                            enhanceFactor = 5.0 + localContrast * 1.5; // 5-6.5倍
                        }
                        
                        enhanced = Math.min(255, enhanced * enhanceFactor);
                        
                        // 應用 S 曲線增強（提升中間調對比度）
                        enhanced = 255 * (enhanced / 255) ** (1 / 1.5);
                        
                        // 智能二值化
                        let finalValue;
                        if (isBlackText) {
                            // 黑色數字：反轉後，暗的變白，亮的變黑
                            finalValue = (enhanced < threshold) ? 255 : 0;
                        } else if (isBrightDisplay) {
                            // 亮顯示：暗的（數字）變白，亮的（背景）變黑
                            finalValue = (enhanced < threshold) ? 255 : 0;
                        } else {
                            // 標準灰階：亮的變白，暗的變黑
                            finalValue = (enhanced > threshold) ? 255 : 0;
                        }
                        
                        // 特殊處理：確保數字區域清晰（灰階圖片）
                        if ((isBlackText || isBrightDisplay) && value < threshold * 1.2) finalValue = 255;
                        // 對於灰階圖片，如果值很亮，設為 255
                        if (value > threshold * 1.5) finalValue = 255;
                        
                        data2[i] = finalValue;
                        data2[i + 1] = finalValue;
                        data2[i + 2] = finalValue;
                    }
                    
                    // 將處理後的數據寫回 imageData
                    for (let i = 0; i < data2.length; i++) {
                        imageData.data[i] = data2[i];
                    }
                    ctx.putImageData(imageData, 0, 0);
                    
                    // 應用形態學操作去除噪點（開運算）
                    imageData = ctx.getImageData(0, 0, width, height);
                    imageData = this.applyMorphology(imageData, 'open');
                    ctx.putImageData(imageData, 0, 0);
                    
                    const optimizedDataUrl = canvas.toDataURL('image/png');
                    
                    const displayType = '灰階處理';
                    
                    console.log('圖片優化完成:', {
                        模式: mode,
                        原始尺寸: `${img.width}x${img.height}`,
                        處理後尺寸: `${width}x${height}`,
                        顯示類型: displayType,
                        對比度範圍: `${minVal.toFixed(1)}-${maxVal.toFixed(1)}`,
                        閾值: threshold.toFixed(1),
                        檢測統計: {
                            紅色像素: `${((redCount / totalPixels) * 100).toFixed(1)}%`,
                            綠色像素: `${((greenCount / totalPixels) * 100).toFixed(1)}%`,
                            暗像素: `${((darkCount / totalPixels) * 100).toFixed(1)}%`,
                            亮像素: `${((brightCount / totalPixels) * 100).toFixed(1)}%`
                        }
                    });
                    
                    resolve(optimizedDataUrl);
                } catch (error) {
                    reject(new Error('圖片優化失敗: ' + error.message));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageSrc;
        });
    }

    // 執行 OCR 辨識
    async performOCR(imageSrc) {
        try {
            if (!this.worker) {
                throw new Error('OCR 引擎未初始化');
            }
            
            console.log('開始 OCR 辨識...');
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('OCR 辨識超時（超過 90 秒）')), 90000);
            });
            
            // 使用 AI 級優化的 OCR 參數
            let ocrPromise;
            try {
                // 嘗試設置多種 OCR 參數以提升準確度
                ocrPromise = this.worker.recognize(imageSrc, {
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/|\\- ',
                    tessedit_pageseg_mode: '6', // 單一文本塊（最適合數字顯示）
                    tessedit_ocr_engine_mode: '1' // LSTM only（最佳準確度）
                });
            } catch (e) {
                // 如果失敗，嘗試更簡單的參數
                try {
                    ocrPromise = this.worker.recognize(imageSrc, {
                        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/|\\- '
                    });
                } catch (e2) {
                    console.warn('無法設置 OCR 參數，使用默認設置');
                    ocrPromise = this.worker.recognize(imageSrc);
                }
            }
            
            const result = await Promise.race([ocrPromise, timeoutPromise]);
            
            if (!result || !result.data) {
                throw new Error('OCR 返回結果為空');
            }
            
            const text = result.data.text || '';
            const confidence = result.data.confidence || 0;
            
            console.log('OCR 辨識完成');
            console.log('識別到的文字:', text);
            console.log('置信度:', confidence);
            
            if (!text || text.trim().length === 0) {
                throw new Error('OCR 沒有識別到任何文字');
            }
            
            return text;
        } catch (error) {
            console.error('OCR 辨識錯誤:', error);
            throw error;
        }
    }

    // 解析血壓數值（更寬鬆的解析，即使部分失敗也嘗試返回結果）
    parseBloodPressure(ocrText, throwError = true) {
        if (!ocrText || !ocrText.trim()) {
            if (throwError) throw new Error('OCR 文字為空');
            return null;
        }
        
        const text = ocrText.trim();
        console.log('開始解析血壓數值，OCR 文字:', text);
        
        // 方法1: 尋找 SYS 和 DIA 關鍵字（支援常見 OCR 錯誤）
        // SYS 可能被識別為: SYS, 5Y5, SY5, S Y S, sys 等
        // DIA 可能被識別為: DIA, D1A, D I A, dia 等
        const sysPatterns = [
            /SYS[:\s=]*(\d{2,3})/i,
            /5Y5[:\s=]*(\d{2,3})/i,
            /SY5[:\s=]*(\d{2,3})/i,
            /S\s*Y\s*S[:\s=]*(\d{2,3})/i,
            /S\s*Y\s*5[:\s=]*(\d{2,3})/i
        ];
        
        const diaPatterns = [
            /DIA[:\s=]*(\d{2,3})/i,
            /D1A[:\s=]*(\d{2,3})/i,
            /D\s*I\s*A[:\s=]*(\d{2,3})/i,
            /D\s*1\s*A[:\s=]*(\d{2,3})/i
        ];
        
        let sysMatch = null;
        let diaMatch = null;
        
        for (const pattern of sysPatterns) {
            sysMatch = text.match(pattern);
            if (sysMatch) break;
        }
        
        for (const pattern of diaPatterns) {
            diaMatch = text.match(pattern);
            if (diaMatch) break;
        }
        
        if (sysMatch && diaMatch) {
            const systolic = parseInt(sysMatch[1]);
            const diastolic = parseInt(diaMatch[1]);
            const pulse = this.extractPulse(text);
            
            if (this.isValidBloodPressure(systolic, diastolic)) {
                console.log('使用 SYS/DIA 方法解析:', { systolic, diastolic, pulse });
                return { systolic, diastolic, pulse };
            }
        }
        
        // 方法1.5: 只找到 SYS 或 DIA 其中一個，嘗試從其他數字推斷
        if (sysMatch || diaMatch) {
            const numbers = text.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                const nums = numbers.map(n => parseInt(n)).filter(n => n >= 50 && n <= 200);
                
                if (nums.length >= 2) {
                    nums.sort((a, b) => b - a);
                    let systolic, diastolic;
                    
                    if (sysMatch) {
                        systolic = parseInt(sysMatch[1]);
                        // 從其他數字中找到最接近的作為舒張壓
                        diastolic = nums.find(n => n !== systolic && n < systolic && n >= 50 && n <= 130) || nums[1];
                    } else if (diaMatch) {
                        diastolic = parseInt(diaMatch[1]);
                        // 從其他數字中找到最接近的作為收縮壓
                        systolic = nums.find(n => n !== diastolic && n > diastolic && n >= 80 && n <= 200) || nums[0];
                    }
                    
                    if (systolic && diastolic && this.isValidBloodPressure(systolic, diastolic)) {
                        const pulse = this.extractPulse(text);
                        console.log('使用部分 SYS/DIA 方法解析:', { systolic, diastolic, pulse });
                        return { systolic, diastolic, pulse };
                    }
                }
            }
        }
        
        // 方法2: 尋找 "數字/數字" 模式（支援多種格式）
        const slashPatterns = [
            /(\d{2,3})\s*\/\s*(\d{2,3})/,  // 標準格式: 138/75
            /(\d{2,3})\s*[|\\]\s*(\d{2,3})/,  // 可能被識別為 | 或 \
            /(\d{2,3})\s*[Il1]\s*(\d{2,3})/,  // 可能被識別為 I, l, 1
            /(\d{2,3})\s+(\d{2,3})/,  // 只有空格: 138 75
            /(\d{2,3})\s*:\s*(\d{2,3})/,  // 冒號: 138:75
        ];
        
        for (const pattern of slashPatterns) {
            const slashMatch = text.match(pattern);
            if (slashMatch) {
                let systolic = parseInt(slashMatch[1]);
                let diastolic = parseInt(slashMatch[2]);
                
                // 確保順序正確
                if (systolic <= diastolic) {
                    [systolic, diastolic] = [diastolic, systolic];
                }
                
                systolic = this.correctCommonOCRErrors(systolic, 'systolic');
                diastolic = this.correctCommonOCRErrors(diastolic, 'diastolic');
                
                if (this.isValidBloodPressure(systolic, diastolic)) {
                    const pulse = this.extractPulse(text);
                    console.log('使用 數字/數字 方法解析:', { systolic, diastolic, pulse });
                    return { systolic, diastolic, pulse };
                }
            }
        }
        
        // 方法3: 從所有數字中提取（更寬鬆的範圍）
        const numbers = text.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
            // 先嘗試標準範圍
            let nums = numbers.map(n => parseInt(n)).filter(n => n >= 50 && n <= 200);
            
            if (nums.length >= 2) {
                nums.sort((a, b) => b - a);
                let systolic = nums[0];
                let diastolic = nums[1];
                
                systolic = this.correctCommonOCRErrors(systolic, 'systolic');
                diastolic = this.correctCommonOCRErrors(diastolic, 'diastolic');
                
            if (systolic <= diastolic) {
                    [systolic, diastolic] = [diastolic, systolic];
                }
                
                if (this.isValidBloodPressure(systolic, diastolic)) {
                    const pulse = this.extractPulse(text);
                    console.log('使用數字提取方法解析:', { systolic, diastolic, pulse });
                    return { systolic, diastolic, pulse };
                }
            }
            
            // 如果標準範圍失敗，嘗試更寬鬆的範圍
            nums = numbers.map(n => parseInt(n)).filter(n => n >= 40 && n <= 250);
            if (nums.length >= 2) {
                nums.sort((a, b) => b - a);
                let systolic = nums[0];
                let diastolic = nums[1];
                
                if (systolic <= diastolic) {
                    [systolic, diastolic] = [diastolic, systolic];
                }
                
                // 寬鬆驗證
                if (systolic >= 60 && systolic <= 250 && 
                    diastolic >= 30 && diastolic <= 150 && 
                    systolic > diastolic) {
                    const pulse = this.extractPulse(text);
                    console.log('使用寬鬆數字提取方法解析:', { systolic, diastolic, pulse });
                    return { systolic, diastolic, pulse };
                }
            }
        }
        
        // 方法4: 尋找任何三個連續的數字（可能是 SYS/DIA/PULSE）
        if (numbers && numbers.length >= 3) {
            const nums = numbers.map(n => parseInt(n));
            
            // 嘗試所有可能的組合
            for (let i = 0; i < nums.length - 1; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    let n1 = nums[i];
                    let n2 = nums[j];
                    
                    // 確保 n1 > n2
                    if (n1 < n2) {
                        [n1, n2] = [n2, n1];
                    }
                    
                    // 檢查是否符合血壓模式（更寬鬆的條件）
                    if (n1 >= 70 && n1 <= 250 && 
                        n2 >= 40 && n2 <= 150 && 
                        n1 > n2 &&
                        (n1 - n2) >= 10 && (n1 - n2) <= 100) {
                        // 尋找第三個數字作為脈拍
                        let pulse = null;
                        for (let k = 0; k < nums.length; k++) {
                            if (k !== i && k !== j && nums[k] >= 40 && nums[k] <= 150) {
                                pulse = nums[k];
                        break;
                    }
                }
                        if (!pulse) {
                            pulse = this.extractPulse(text);
                        }
                        console.log('使用連續數字方法解析:', { systolic: n1, diastolic: n2, pulse });
                        return { systolic: n1, diastolic: n2, pulse };
                    }
                }
            }
        }
        
        // 方法5: 極度寬鬆解析（最後嘗試，只要基本邏輯正確就返回）
        if (numbers && numbers.length >= 2) {
            const nums = numbers.map(n => parseInt(n)).filter(n => n >= 20 && n <= 300);
            
            if (nums.length >= 2) {
                nums.sort((a, b) => b - a);
                let systolic = nums[0];
                let diastolic = nums[1];
                
                // 極度寬鬆驗證（只要基本邏輯正確）
                if (systolic >= 50 && systolic <= 300 && 
                    diastolic >= 20 && diastolic <= 200 && 
                    systolic > diastolic &&
                    (systolic - diastolic) >= 5) {
                    const pulse = this.extractPulse(text);
                    console.log('使用極度寬鬆解析方法:', { systolic, diastolic, pulse });
                    return { systolic, diastolic, pulse };
                }
            }
        }
        
        // 方法6: 嘗試識別常見的 OCR 錯誤（如 138 被識別為 13 8）
        if (numbers && numbers.length >= 2) {
            // 嘗試合併相鄰的數字
            const mergedNumbers = [];
            for (let i = 0; i < numbers.length; i++) {
                const num = parseInt(numbers[i]);
                // 如果是個位數或兩位數，嘗試與下一個數字合併
                if (num < 100 && i < numbers.length - 1) {
                    const nextNum = parseInt(numbers[i + 1]);
                    if (nextNum < 10) {
                        const merged = num * 10 + nextNum;
                        if (merged >= 50 && merged <= 200) {
                            mergedNumbers.push(merged);
                            i++; // 跳過下一個數字
                            continue;
                        }
                    }
                }
                mergedNumbers.push(num);
            }
            
            if (mergedNumbers.length >= 2) {
                const nums = mergedNumbers.filter(n => n >= 50 && n <= 200);
                if (nums.length >= 2) {
                    nums.sort((a, b) => b - a);
                    let systolic = nums[0];
                    let diastolic = nums[1];
                    
            if (systolic <= diastolic) {
                        [systolic, diastolic] = [diastolic, systolic];
                    }
                    
                    if (this.isValidBloodPressure(systolic, diastolic)) {
                        const pulse = this.extractPulse(text);
                        console.log('使用數字合併方法解析:', { systolic, diastolic, pulse });
                        return { systolic, diastolic, pulse };
                    }
                }
            }
        }
        
        if (throwError) {
            throw new Error(`無法從 OCR 結果中解析血壓數值。OCR 識別到的文字： "${text}"`);
        }
        return null;
    }

    // 驗證血壓值是否合理（更寬鬆的驗證）
    isValidBloodPressure(systolic, diastolic) {
        // 標準驗證
        if (systolic >= 80 && systolic <= 200 &&
            diastolic >= 50 && diastolic <= 130 &&
            systolic > diastolic &&
            (systolic - diastolic) >= 20 &&
            (systolic - diastolic) <= 80) {
            return true;
        }
        
        // 寬鬆驗證（允許邊界值）
        if (systolic >= 70 && systolic <= 250 &&
            diastolic >= 40 && diastolic <= 150 &&
            systolic > diastolic &&
            (systolic - diastolic) >= 10 &&
            (systolic - diastolic) <= 100) {
            return true;
        }
        
        return false;
    }

    // 修正常見的 OCR 字符錯誤（通用方法，不針對特定數值）
    // 只進行真正通用的字符級別修正，基於字符相似度
    correctCommonOCRErrors(value, type = 'general') {
        if (value < 10 || value > 300) return value;
        
        // 對於血壓值，如果數值已經在合理範圍內，直接返回
        // 不進行任何修正，讓 OCR 的原始識別結果優先
        if (type === 'systolic') {
            // 收縮壓：80-200
            if (value >= 80 && value <= 200) {
                return value; // 直接返回，不修正
            }
        } else if (type === 'diastolic') {
            // 舒張壓：50-130
            if (value >= 50 && value <= 130) {
                return value; // 直接返回，不修正
            }
                } else {
            // 一般情況：如果數值合理，直接返回
            if (value >= 10 && value <= 300) {
                return value; // 直接返回，不修正
            }
        }
        
        // 只有在數值明顯不合理時，才嘗試非常保守的修正
        // 例如：個位數可能是被錯誤識別的兩位數的一部分
        // 但這裡我們也不進行修正，讓解析邏輯處理
        
        return value; // 返回原值，讓系統依賴 OCR 的實際識別結果
    }

    // 提取脈拍（改進版，支援更多格式）
    extractPulse(text) {
        // 方法1: 尋找 PULSE 關鍵字（支援常見 OCR 錯誤）
        const pulsePatterns = [
            /PULSE[:\s=]*(\d+)/i,
            /PUL5E[:\s=]*(\d+)/i,  // PULSE 可能被識別為 PUL5E
            /P\s*U\s*L\s*S\s*E[:\s=]*(\d+)/i,
            /P[:\s=]*(\d+)/i,  // 只有 P
            /BPM[:\s=]*(\d+)/i,  // BPM
            /\/\s*min[:\s=]*(\d+)/i,  // /min
        ];
        
        for (const pattern of pulsePatterns) {
            const pulseMatch = text.match(pattern);
            if (pulseMatch) {
                let pulse = parseInt(pulseMatch[1]);
                pulse = this.correctPulse(pulse);
                if (pulse >= 40 && pulse <= 150) {
                    return pulse;
                }
            }
        }
        
        // 方法2: 尋找第三個合理的數字（在血壓值之後）
        const numbers = text.match(/\d+/g);
        if (numbers) {
            // 先過濾出合理的脈拍值
            const pulseCandidates = numbers.map(n => parseInt(n))
                .filter(n => n >= 40 && n <= 150);
            
            if (pulseCandidates.length > 0) {
                // 選擇最接近典型脈拍值（60-100）的數字
                const typicalPulse = pulseCandidates.find(n => n >= 60 && n <= 100) || 
                                    pulseCandidates[0];
                return this.correctPulse(typicalPulse);
            }
        }
        
        return null;
    }

    // 修正常見的脈拍 OCR 錯誤（通用方法）
    correctPulse(value) {
        if (value < 40 || value > 150) return value;
        
        // 脈拍值通常在 40-150 之間
        // 如果識別到的值在這個範圍內，直接返回
        // 不進行特定數值的硬編碼修正
        
        return value;
    }

    // 主辨識方法（使用多種策略並選擇最佳結果）
    async recognize() {
        if (!this.selectedImage) {
            throw new Error('請先選擇圖片');
        }

        if (!this.worker) {
            throw new Error('OCR 引擎尚未初始化完成，請稍候再試');
        }

        console.log('開始影像辨識流程（多策略優化）...');
        
        let bestResult = null;
        let bestOcrText = '';
        let bestScore = -1;
        
        // 策略1: 激進模式
        try {
            console.log('策略1: 激進模式處理...');
            const optimizedImage1 = await this.optimizeImageForOCR(this.selectedImage, 'aggressive');
            const ocrText1 = await this.performOCR(optimizedImage1);
            const bloodPressure1 = this.parseBloodPressure(ocrText1);
            const score1 = this.scoreResult(bloodPressure1, ocrText1);
            
            if (score1 > bestScore) {
                bestResult = bloodPressure1;
                bestOcrText = ocrText1;
                bestScore = score1;
                console.log('策略1 結果:', bloodPressure1, '分數:', score1);
            }
        } catch (e) {
            console.warn('策略1 失敗:', e.message);
        }
        
        // 策略2: 標準模式
        try {
            console.log('策略2: 標準模式處理...');
            const optimizedImage2 = await this.optimizeImageForOCR(this.selectedImage, 'standard');
            const ocrText2 = await this.performOCR(optimizedImage2);
            const bloodPressure2 = this.parseBloodPressure(ocrText2);
            const score2 = this.scoreResult(bloodPressure2, ocrText2);
            
            if (score2 > bestScore) {
                bestResult = bloodPressure2;
                bestOcrText = ocrText2;
                bestScore = score2;
                console.log('策略2 結果:', bloodPressure2, '分數:', score2);
            }
        } catch (e) {
            console.warn('策略2 失敗:', e.message);
        }
        
        // 策略3: 保守模式
        try {
            console.log('策略3: 保守模式處理...');
            const optimizedImage3 = await this.optimizeImageForOCR(this.selectedImage, 'conservative');
            const ocrText3 = await this.performOCR(optimizedImage3);
            const bloodPressure3 = this.parseBloodPressure(ocrText3);
            const score3 = this.scoreResult(bloodPressure3, ocrText3);
            
            if (score3 > bestScore) {
                bestResult = bloodPressure3;
                bestOcrText = ocrText3;
                bestScore = score3;
                console.log('策略3 結果:', bloodPressure3, '分數:', score3);
            }
        } catch (e) {
            console.warn('策略3 失敗:', e.message);
        }
        
        // 策略4: 極端激進模式（雙重銳化）
        if (!bestResult) {
            try {
                console.log('策略4: 極端激進模式處理...');
                const optimizedImage4 = await this.optimizeImageForOCR(this.selectedImage, 'aggressive');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = optimizedImage4;
                });
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                imgData = this.applySharpenFilter(imgData);
                ctx.putImageData(imgData, 0, 0);
                const doubleSharpened = canvas.toDataURL('image/png');
                
                const ocrText4 = await this.performOCR(doubleSharpened);
                const bloodPressure4 = this.parseBloodPressure(ocrText4, false);
                if (bloodPressure4) {
                    const score4 = this.scoreResult(bloodPressure4, ocrText4);
                    if (score4 > bestScore) {
                        bestResult = bloodPressure4;
                        bestOcrText = ocrText4;
                        bestScore = score4;
                        console.log('策略4 結果:', bloodPressure4, '分數:', score4);
                    }
                }
            } catch (e) {
                console.warn('策略4 失敗:', e.message);
            }
        }
        
        // 策略5: 純灰階處理（優先策略）
        if (!bestResult) {
            try {
                console.log('策略5: 純灰階處理模式...');
                const grayscaleImage = await this.grayscaleOnly(this.selectedImage);
                const ocrText5 = await this.performOCR(grayscaleImage);
                const bloodPressure5 = this.parseBloodPressure(ocrText5, false);
                if (bloodPressure5) {
                    const score5 = this.scoreResult(bloodPressure5, ocrText5);
                    if (score5 > bestScore) {
                        bestResult = bloodPressure5;
                        bestOcrText = ocrText5;
                        bestScore = score5;
                        console.log('策略5 結果:', bloodPressure5, '分數:', score5);
                    }
                }
            } catch (e) {
                console.warn('策略5 失敗:', e.message);
            }
        }
        
        // 策略6: 灰階+對比度增強
        if (!bestResult) {
            try {
                console.log('策略6: 灰階+對比度增強模式...');
                const grayscaleContrastImage = await this.grayscaleWithContrast(this.selectedImage);
                const ocrText6 = await this.performOCR(grayscaleContrastImage);
                const bloodPressure6 = this.parseBloodPressure(ocrText6, false);
                if (bloodPressure6) {
                    const score6 = this.scoreResult(bloodPressure6, ocrText6);
                    if (score6 > bestScore) {
                        bestResult = bloodPressure6;
                        bestOcrText = ocrText6;
                        bestScore = score6;
                        console.log('策略6 結果:', bloodPressure6, '分數:', score6);
                    }
                }
            } catch (e) {
                console.warn('策略6 失敗:', e.message);
            }
        }
        
        // 策略7: 最小預處理（保留原始特徵）
        if (!bestResult) {
            try {
                console.log('策略7: 最小預處理模式...');
                const minimalImage = await this.minimalPreprocess(this.selectedImage);
                const ocrText7 = await this.performOCR(minimalImage);
                const bloodPressure7 = this.parseBloodPressure(ocrText7, false);
                if (bloodPressure7) {
                    const score7 = this.scoreResult(bloodPressure7, ocrText7);
                    if (score7 > bestScore) {
                        bestResult = bloodPressure7;
                        bestOcrText = ocrText7;
                        bestScore = score7;
                        console.log('策略7 結果:', bloodPressure7, '分數:', score7);
                    }
                }
            } catch (e) {
                console.warn('策略7 失敗:', e.message);
            }
        }
        
        // 策略8: 只增強對比度（不二值化）
        if (!bestResult) {
            try {
                console.log('策略8: 高對比度模式（不二值化）...');
                const contrastImage = await this.highContrastOnly(this.selectedImage);
                const ocrText8 = await this.performOCR(contrastImage);
                const bloodPressure8 = this.parseBloodPressure(ocrText8, false);
                if (bloodPressure8) {
                    const score8 = this.scoreResult(bloodPressure8, ocrText8);
                    if (score8 > bestScore) {
                        bestResult = bloodPressure8;
                        bestOcrText = ocrText8;
                        bestScore = score8;
                        console.log('策略8 結果:', bloodPressure8, '分數:', score8);
                    }
                }
            } catch (e) {
                console.warn('策略8 失敗:', e.message);
            }
        }
        
        // 策略9: 原始圖片直接 OCR（無預處理）
        if (!bestResult) {
            try {
                console.log('策略9: 原始圖片直接 OCR...');
                const ocrText9 = await this.performOCR(this.selectedImage);
                const bloodPressure9 = this.parseBloodPressure(ocrText9, false);
                if (bloodPressure9) {
                    const score9 = this.scoreResult(bloodPressure9, ocrText9);
                    if (score9 > bestScore) {
                        bestResult = bloodPressure9;
                        bestOcrText = ocrText9;
                        bestScore = score9;
                        console.log('策略9 結果:', bloodPressure9, '分數:', score9);
                    }
                }
            } catch (e) {
                console.warn('策略9 失敗:', e.message);
            }
        }
        
        // 策略10: 灰階+不同 OCR 參數
        if (!bestResult) {
            try {
                console.log('策略10: 灰階+不同 OCR 參數...');
                const grayscaleImage10 = await this.grayscaleOnly(this.selectedImage);
                if (!this.worker) {
                    throw new Error('OCR 引擎未初始化');
                }
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('OCR 辨識超時')), 90000);
                });
                
                let ocrPromise10;
                try {
                    ocrPromise10 = this.worker.recognize(grayscaleImage10, {
                        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/|\\- ',
                        tessedit_pageseg_mode: '8' // 單詞模式
                    });
                } catch (e) {
                    ocrPromise10 = this.worker.recognize(grayscaleImage10);
                }
                
                const result10 = await Promise.race([ocrPromise10, timeoutPromise]);
                const ocrText10 = result10.data.text || '';
                
                if (ocrText10) {
                    const bloodPressure10 = this.parseBloodPressure(ocrText10, false);
                    if (bloodPressure10) {
                        const score10 = this.scoreResult(bloodPressure10, ocrText10);
                        if (score10 > bestScore) {
                            bestResult = bloodPressure10;
                            bestOcrText = ocrText10;
                            bestScore = score10;
                            console.log('策略10 結果:', bloodPressure10, '分數:', score10);
                        }
                    }
                }
            } catch (e) {
                console.warn('策略10 失敗:', e.message);
            }
        }
        
        // 策略11: 反色模式（適用於深色背景亮數字）
        if (!bestResult) {
            try {
                console.log('策略11: 反色模式處理...');
                const invertedImage = await this.invertColorsMode(this.selectedImage);
                const ocrText11 = await this.performOCR(invertedImage);
                const bloodPressure11 = this.parseBloodPressure(ocrText11, false);
                if (bloodPressure11) {
                    const score11 = this.scoreResult(bloodPressure11, ocrText11);
                    if (score11 > bestScore) {
                        bestResult = bloodPressure11;
                        bestOcrText = ocrText11;
                        bestScore = score11;
                        console.log('策略11 結果:', bloodPressure11, '分數:', score11);
                    }
                }
            } catch (e) {
                console.warn('策略11 失敗:', e.message);
            }
        }
        
        // 策略12: 高亮度模式（增強亮部）
        if (!bestResult) {
            try {
                console.log('策略12: 高亮度模式處理...');
                const brightImage = await this.highBrightnessMode(this.selectedImage);
                const ocrText12 = await this.performOCR(brightImage);
                const bloodPressure12 = this.parseBloodPressure(ocrText12, false);
                if (bloodPressure12) {
                    const score12 = this.scoreResult(bloodPressure12, ocrText12);
                    if (score12 > bestScore) {
                        bestResult = bloodPressure12;
                        bestOcrText = ocrText12;
                        bestScore = score12;
                        console.log('策略12 結果:', bloodPressure12, '分數:', score12);
                    }
                }
            } catch (e) {
                console.warn('策略12 失敗:', e.message);
            }
        }
        
        // 策略13: 低亮度模式（增強暗部）
        if (!bestResult) {
            try {
                console.log('策略13: 低亮度模式處理...');
                const darkImage = await this.lowBrightnessMode(this.selectedImage);
                const ocrText13 = await this.performOCR(darkImage);
                const bloodPressure13 = this.parseBloodPressure(ocrText13, false);
                if (bloodPressure13) {
                    const score13 = this.scoreResult(bloodPressure13, ocrText13);
                    if (score13 > bestScore) {
                        bestResult = bloodPressure13;
                        bestOcrText = ocrText13;
                        bestScore = score13;
                        console.log('策略13 結果:', bloodPressure13, '分數:', score13);
                    }
                }
            } catch (e) {
                console.warn('策略13 失敗:', e.message);
            }
        }
        
        // 策略14: 邊緣檢測模式
        if (!bestResult) {
            try {
                console.log('策略14: 邊緣檢測模式處理...');
                const edgeImage = await this.edgeDetectionMode(this.selectedImage);
                const ocrText14 = await this.performOCR(edgeImage);
                const bloodPressure14 = this.parseBloodPressure(ocrText14, false);
                if (bloodPressure14) {
                    const score14 = this.scoreResult(bloodPressure14, ocrText14);
                    if (score14 > bestScore) {
                        bestResult = bloodPressure14;
                        bestOcrText = ocrText14;
                        bestScore = score14;
                        console.log('策略14 結果:', bloodPressure14, '分數:', score14);
                    }
                }
            } catch (e) {
                console.warn('策略14 失敗:', e.message);
            }
        }
        
        // 策略15: 灰階+反色組合
        if (!bestResult) {
            try {
                console.log('策略15: 灰階+反色組合處理...');
                const grayscaleImage15 = await this.grayscaleOnly(this.selectedImage);
                const invertedGrayscale = await this.invertColorsMode(grayscaleImage15);
                const ocrText15 = await this.performOCR(invertedGrayscale);
                const bloodPressure15 = this.parseBloodPressure(ocrText15, false);
                if (bloodPressure15) {
                    const score15 = this.scoreResult(bloodPressure15, ocrText15);
                    if (score15 > bestScore) {
                        bestResult = bloodPressure15;
                        bestOcrText = ocrText15;
                        bestScore = score15;
                        console.log('策略15 結果:', bloodPressure15, '分數:', score15);
                    }
                }
            } catch (e) {
                console.warn('策略15 失敗:', e.message);
            }
        }
        
        // 策略16: 灰階+高亮度組合
        if (!bestResult) {
            try {
                console.log('策略16: 灰階+高亮度組合處理...');
                const grayscaleImage16 = await this.grayscaleOnly(this.selectedImage);
                const brightGrayscale = await this.highBrightnessMode(grayscaleImage16);
                const ocrText16 = await this.performOCR(brightGrayscale);
                const bloodPressure16 = this.parseBloodPressure(ocrText16, false);
                if (bloodPressure16) {
                    const score16 = this.scoreResult(bloodPressure16, ocrText16);
                    if (score16 > bestScore) {
                        bestResult = bloodPressure16;
                        bestOcrText = ocrText16;
                        bestScore = score16;
                        console.log('策略16 結果:', bloodPressure16, '分數:', score16);
                    }
                }
            } catch (e) {
                console.warn('策略16 失敗:', e.message);
            }
        }
        
        // 策略17: 灰階+低亮度組合
        if (!bestResult) {
            try {
                console.log('策略17: 灰階+低亮度組合處理...');
                const grayscaleImage17 = await this.grayscaleOnly(this.selectedImage);
                const darkGrayscale = await this.lowBrightnessMode(grayscaleImage17);
                const ocrText17 = await this.performOCR(darkGrayscale);
                const bloodPressure17 = this.parseBloodPressure(ocrText17, false);
                if (bloodPressure17) {
                    const score17 = this.scoreResult(bloodPressure17, ocrText17);
                    if (score17 > bestScore) {
                        bestResult = bloodPressure17;
                        bestOcrText = ocrText17;
                        bestScore = score17;
                        console.log('策略17 結果:', bloodPressure17, '分數:', score17);
                    }
                }
            } catch (e) {
                console.warn('策略17 失敗:', e.message);
            }
        }
        
        // 策略18: 多種 OCR 參數組合（嘗試所有頁面分割模式）
        if (!bestResult) {
            const pageSegModes = ['6', '7', '8', '11', '12'];
            for (const mode of pageSegModes) {
                try {
                    console.log(`策略18-${mode}: 使用頁面分割模式 ${mode}...`);
                    const grayscaleImage18 = await this.grayscaleOnly(this.selectedImage);
                    if (!this.worker) {
                        throw new Error('OCR 引擎未初始化');
                    }
                    
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('OCR 辨識超時')), 60000);
                    });
                    
                    let ocrPromise18;
                    try {
                        ocrPromise18 = this.worker.recognize(grayscaleImage18, {
                            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/|\\- ',
                            tessedit_pageseg_mode: mode
                        });
                    } catch (e) {
                        continue; // 跳過這個模式
                    }
                    
                    const result18 = await Promise.race([ocrPromise18, timeoutPromise]);
                    const ocrText18 = result18.data.text || '';
                    
                    if (ocrText18) {
                        const bloodPressure18 = this.parseBloodPressure(ocrText18, false);
                        if (bloodPressure18) {
                            const score18 = this.scoreResult(bloodPressure18, ocrText18);
                            if (score18 > bestScore) {
                                bestResult = bloodPressure18;
                                bestOcrText = ocrText18;
                                bestScore = score18;
                                console.log(`策略18-${mode} 結果:`, bloodPressure18, '分數:', score18);
                                break; // 找到結果就停止
                            }
                        }
                    }
                } catch (e) {
                    // 繼續嘗試下一個模式
                    continue;
                }
            }
        }
        
        // 如果所有策略都失敗，嘗試從所有 OCR 結果中提取數字
        if (!bestResult) {
            console.log('所有標準策略失敗，嘗試從所有 OCR 結果中提取數字...');
            const allOcrTexts = [];
            
            // 收集所有策略的 OCR 文字
            for (let i = 1; i <= 8; i++) {
                try {
                    let image;
                    if (i <= 3) {
                        const modes = ['aggressive', 'standard', 'conservative'];
                        image = await this.optimizeImageForOCR(this.selectedImage, modes[i - 1]);
                    } else if (i === 4) {
                        continue; // 跳過策略4（需要特殊處理）
                    } else if (i === 5) {
                        image = await this.minimalPreprocess(this.selectedImage);
                    } else if (i === 6) {
                        image = await this.highContrastOnly(this.selectedImage);
                    } else if (i === 7) {
                        image = this.selectedImage;
                    } else {
                        continue;
                    }
                    
                    const ocrText = await this.performOCR(image);
                    if (ocrText && ocrText.trim()) {
                        allOcrTexts.push(ocrText);
                    }
                } catch (e) {
                    // 忽略錯誤，繼續嘗試
                }
            }
            
            // 合併所有 OCR 文字並嘗試解析
            if (allOcrTexts.length > 0) {
                const combinedText = allOcrTexts.join(' ');
                console.log('合併所有 OCR 結果:', combinedText);
                const bloodPressure = this.parseBloodPressure(combinedText, false);
                if (bloodPressure) {
                    bestResult = bloodPressure;
                    bestOcrText = combinedText;
                    console.log('從合併結果解析成功:', bloodPressure);
                }
            }
        }
        
        if (!bestResult) {
            throw new Error('所有策略都失敗，無法識別血壓數值。請確認：\n1. 圖片清晰且只包含血壓機螢幕\n2. 光線充足\n3. 數字清楚可見\n4. 嘗試重新拍攝照片');
        }
        
        console.log('最佳辨識結果:', bestResult, '分數:', bestScore);
        
        return {
            bloodPressure: bestResult,
            ocrText: bestOcrText
        };
    }
    
    // 評分結果的質量
    scoreResult(bloodPressure, ocrText) {
        if (!bloodPressure || !bloodPressure.systolic || !bloodPressure.diastolic) {
            return 0;
        }
        
        let score = 100;
        
        // 檢查數值是否在合理範圍
        if (bloodPressure.systolic < 80 || bloodPressure.systolic > 200) score -= 30;
        if (bloodPressure.diastolic < 50 || bloodPressure.diastolic > 130) score -= 30;
        
        // 檢查收縮壓是否大於舒張壓
        if (bloodPressure.systolic <= bloodPressure.diastolic) score -= 20;
        
        // 檢查差值是否合理（通常 30-70）
        const diff = bloodPressure.systolic - bloodPressure.diastolic;
        if (diff < 20 || diff > 80) score -= 10;
        
        // 檢查 OCR 文字中是否包含關鍵字
        if (/SYS|DIA|mmHg/i.test(ocrText)) score += 20;
        if (/\d{2,3}\s*\/\s*\d{2,3}/.test(ocrText)) score += 15;
        
        // 檢查脈拍是否合理
        if (bloodPressure.pulse && bloodPressure.pulse >= 40 && bloodPressure.pulse <= 150) {
            score += 10;
        }
        
        return score;
    }
}
