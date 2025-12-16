// Advanced Image Upscaler - Main Application Logic
class ImageUpscaler {
    constructor() {
        this.originalImage = null;
        this.originalCanvas = document.getElementById('originalCanvas');
        this.resultCanvas = document.getElementById('resultCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d', { willReadFrequently: true });
        this.resultCtx = this.resultCanvas.getContext('2d', { willReadFrequently: true });

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const downloadBtn = document.getElementById('downloadBtn');

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadImage(file);
            }
        });

        processBtn.addEventListener('click', () => this.processImage());
        downloadBtn.addEventListener('click', () => this.downloadImage());
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginal();
                document.getElementById('processBtn').disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayOriginal() {
        const maxDisplay = 800;
        let displayWidth = this.originalImage.width;
        let displayHeight = this.originalImage.height;

        if (displayWidth > maxDisplay || displayHeight > maxDisplay) {
            const ratio = Math.min(maxDisplay / displayWidth, maxDisplay / displayHeight);
            displayWidth *= ratio;
            displayHeight *= ratio;
        }

        this.originalCanvas.width = this.originalImage.width;
        this.originalCanvas.height = this.originalImage.height;
        this.originalCtx.drawImage(this.originalImage, 0, 0);

        document.getElementById('originalInfo').textContent =
            `${this.originalImage.width} × ${this.originalImage.height} pixels`;

        document.getElementById('previewArea').classList.add('active');
        document.getElementById('resultCanvas').style.display = 'none';
        document.getElementById('downloadBtn').classList.remove('active');
        document.getElementById('stats').classList.remove('active');
    }

    async processImage() {
        const startTime = performance.now();
        const method = document.getElementById('upscaleMethod').value;
        const scale = parseInt(document.getElementById('scaleFactor').value);
        const sharpening = parseFloat(document.getElementById('sharpening').value);

        document.getElementById('processBtn').disabled = true;
        document.getElementById('progressContainer').classList.add('active');
        this.updateProgress(0, 'Starting upscaling process...');

        try {
            // Step 1: Initial upscale
            this.updateProgress(10, 'Performing initial upscale...');
            const upscaledData = await this.upscale(method, scale);

            // Step 2: Edge-preserving smoothing
            this.updateProgress(40, 'Applying edge preservation...');
            await this.sleep(50);
            this.edgePreservingSmooth(upscaledData);

            // Step 3: Sharpening
            if (sharpening > 0) {
                this.updateProgress(60, 'Enhancing details...');
                await this.sleep(50);
                this.unsharpMask(upscaledData, sharpening);
            }

            // Step 4: Denoise
            this.updateProgress(75, 'Reducing noise...');
            await this.sleep(50);
            this.bilateralFilter(upscaledData);

            // Step 5: Color enhancement
            this.updateProgress(85, 'Enhancing colors...');
            await this.sleep(50);
            this.enhanceColors(upscaledData);

            // Step 6: Contrast normalization
            this.updateProgress(95, 'Normalizing contrast...');
            await this.sleep(50);
            this.normalizeContrast(upscaledData);

            // Display result
            this.resultCtx.putImageData(upscaledData, 0, 0);
            document.getElementById('resultCanvas').style.display = 'block';

            const endTime = performance.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);

            this.updateProgress(100, 'Complete!');
            this.displayStats(processingTime, scale);

            setTimeout(() => {
                document.getElementById('progressContainer').classList.remove('active');
                document.getElementById('processBtn').disabled = false;
            }, 1000);

        } catch (error) {
            console.error('Processing error:', error);
            this.updateProgress(0, 'Error processing image');
            document.getElementById('processBtn').disabled = false;
        }
    }

    async upscale(method, scale) {
        const srcWidth = this.originalImage.width;
        const srcHeight = this.originalImage.height;
        const destWidth = srcWidth * scale;
        const destHeight = srcHeight * scale;

        this.resultCanvas.width = destWidth;
        this.resultCanvas.height = destHeight;

        const srcData = this.originalCtx.getImageData(0, 0, srcWidth, srcHeight);
        const destData = this.resultCtx.createImageData(destWidth, destHeight);

        // Use appropriate resampling method
        switch (method) {
            case 'lanczos':
                this.lanczosResample(srcData, destData, srcWidth, srcHeight, destWidth, destHeight);
                break;
            case 'bicubic':
                this.bicubicResample(srcData, destData, srcWidth, srcHeight, destWidth, destHeight);
                break;
            case 'bilinear':
                this.bilinearResample(srcData, destData, srcWidth, srcHeight, destWidth, destHeight);
                break;
        }

        return destData;
    }

    lanczosResample(src, dest, sw, sh, dw, dh) {
        const a = 3; // Lanczos window size
        const ratio_w = sw / dw;
        const ratio_h = sh / dh;

        for (let dy = 0; dy < dh; dy++) {
            for (let dx = 0; dx < dw; dx++) {
                const src_x = dx * ratio_w;
                const src_y = dy * ratio_h;

                let r = 0, g = 0, b = 0, alpha = 0, weight_sum = 0;

                for (let sy = Math.floor(src_y - a); sy <= Math.ceil(src_y + a); sy++) {
                    for (let sx = Math.floor(src_x - a); sx <= Math.ceil(src_x + a); sx++) {
                        if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
                            const weight = this.lanczosKernel(src_x - sx, a) *
                                          this.lanczosKernel(src_y - sy, a);

                            const idx = (sy * sw + sx) * 4;
                            r += src.data[idx] * weight;
                            g += src.data[idx + 1] * weight;
                            b += src.data[idx + 2] * weight;
                            alpha += src.data[idx + 3] * weight;
                            weight_sum += weight;
                        }
                    }
                }

                const destIdx = (dy * dw + dx) * 4;
                dest.data[destIdx] = Math.max(0, Math.min(255, r / weight_sum));
                dest.data[destIdx + 1] = Math.max(0, Math.min(255, g / weight_sum));
                dest.data[destIdx + 2] = Math.max(0, Math.min(255, b / weight_sum));
                dest.data[destIdx + 3] = Math.max(0, Math.min(255, alpha / weight_sum));
            }
        }
    }

    lanczosKernel(x, a) {
        if (x === 0) return 1;
        if (Math.abs(x) >= a) return 0;
        const pi_x = Math.PI * x;
        return (a * Math.sin(pi_x) * Math.sin(pi_x / a)) / (pi_x * pi_x);
    }

    bicubicResample(src, dest, sw, sh, dw, dh) {
        const ratio_w = sw / dw;
        const ratio_h = sh / dh;

        for (let dy = 0; dy < dh; dy++) {
            for (let dx = 0; dx < dw; dx++) {
                const src_x = dx * ratio_w;
                const src_y = dy * ratio_h;
                const x_int = Math.floor(src_x);
                const y_int = Math.floor(src_y);
                const x_frac = src_x - x_int;
                const y_frac = src_y - y_int;

                let r = 0, g = 0, b = 0, alpha = 0;

                for (let m = -1; m <= 2; m++) {
                    for (let n = -1; n <= 2; n++) {
                        const sx = Math.max(0, Math.min(sw - 1, x_int + n));
                        const sy = Math.max(0, Math.min(sh - 1, y_int + m));

                        const weight = this.cubicWeight(n - x_frac) * this.cubicWeight(m - y_frac);
                        const idx = (sy * sw + sx) * 4;

                        r += src.data[idx] * weight;
                        g += src.data[idx + 1] * weight;
                        b += src.data[idx + 2] * weight;
                        alpha += src.data[idx + 3] * weight;
                    }
                }

                const destIdx = (dy * dw + dx) * 4;
                dest.data[destIdx] = Math.max(0, Math.min(255, r));
                dest.data[destIdx + 1] = Math.max(0, Math.min(255, g));
                dest.data[destIdx + 2] = Math.max(0, Math.min(255, b));
                dest.data[destIdx + 3] = Math.max(0, Math.min(255, alpha));
            }
        }
    }

    cubicWeight(x) {
        const abs_x = Math.abs(x);
        if (abs_x <= 1) {
            return 1.5 * abs_x * abs_x * abs_x - 2.5 * abs_x * abs_x + 1;
        } else if (abs_x < 2) {
            return -0.5 * abs_x * abs_x * abs_x + 2.5 * abs_x * abs_x - 4 * abs_x + 2;
        }
        return 0;
    }

    bilinearResample(src, dest, sw, sh, dw, dh) {
        const ratio_w = sw / dw;
        const ratio_h = sh / dh;

        for (let dy = 0; dy < dh; dy++) {
            for (let dx = 0; dx < dw; dx++) {
                const src_x = dx * ratio_w;
                const src_y = dy * ratio_h;
                const x1 = Math.floor(src_x);
                const y1 = Math.floor(src_y);
                const x2 = Math.min(x1 + 1, sw - 1);
                const y2 = Math.min(y1 + 1, sh - 1);
                const x_weight = src_x - x1;
                const y_weight = src_y - y1;

                const idx11 = (y1 * sw + x1) * 4;
                const idx12 = (y1 * sw + x2) * 4;
                const idx21 = (y2 * sw + x1) * 4;
                const idx22 = (y2 * sw + x2) * 4;

                const destIdx = (dy * dw + dx) * 4;

                for (let c = 0; c < 4; c++) {
                    const top = src.data[idx11 + c] * (1 - x_weight) + src.data[idx12 + c] * x_weight;
                    const bottom = src.data[idx21 + c] * (1 - x_weight) + src.data[idx22 + c] * x_weight;
                    dest.data[destIdx + c] = top * (1 - y_weight) + bottom * y_weight;
                }
            }
        }
    }

    unsharpMask(imageData, amount) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const blurred = new Uint8ClampedArray(data);

        // Gaussian blur
        const kernel = [1, 4, 6, 4, 1];
        const kernelSum = 16;
        const temp = new Uint8ClampedArray(data);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let k = -2; k <= 2; k++) {
                        const px = Math.max(0, Math.min(width - 1, x + k));
                        sum += data[(y * width + px) * 4 + c] * kernel[k + 2];
                    }
                    temp[(y * width + x) * 4 + c] = sum / kernelSum;
                }
            }
        }

        // Vertical pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let k = -2; k <= 2; k++) {
                        const py = Math.max(0, Math.min(height - 1, y + k));
                        sum += temp[(py * width + x) * 4 + c] * kernel[k + 2];
                    }
                    blurred[(y * width + x) * 4 + c] = sum / kernelSum;
                }
            }
        }

        // Apply unsharp mask
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const sharp = data[i + c] + amount * (data[i + c] - blurred[i + c]);
                data[i + c] = Math.max(0, Math.min(255, sharp));
            }
        }
    }

    edgePreservingSmooth(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const temp = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    const center = data[idx + c];
                    let sum = 0, weight_sum = 0;

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nidx = ((y + dy) * width + (x + dx)) * 4;
                            const diff = Math.abs(data[nidx + c] - center);
                            const weight = Math.exp(-diff / 30);
                            sum += data[nidx + c] * weight;
                            weight_sum += weight;
                        }
                    }

                    temp[idx + c] = sum / weight_sum;
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = temp[i];
        }
    }

    bilateralFilter(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const temp = new Uint8ClampedArray(data);
        const sigma_s = 2;
        const sigma_r = 30;

        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    let sum = 0, weight_sum = 0;

                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const nidx = ((y + dy) * width + (x + dx)) * 4;
                            const spatial = Math.exp(-(dx * dx + dy * dy) / (2 * sigma_s * sigma_s));
                            const diff = data[idx + c] - data[nidx + c];
                            const range = Math.exp(-(diff * diff) / (2 * sigma_r * sigma_r));
                            const weight = spatial * range;

                            sum += data[nidx + c] * weight;
                            weight_sum += weight;
                        }
                    }

                    temp[idx + c] = sum / weight_sum;
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = temp[i];
        }
    }

    enhanceColors(imageData) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Convert to HSV
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const v = max;
            const s = max === 0 ? 0 : (max - min) / max;

            // Enhance saturation
            const enhancedS = Math.min(1, s * 1.15);

            // Convert back to RGB
            if (s === 0) continue;

            const delta = max - min;
            let h;
            if (r === max) h = (g - b) / delta;
            else if (g === max) h = 2 + (b - r) / delta;
            else h = 4 + (r - g) / delta;
            h = h * 60;
            if (h < 0) h += 360;

            const c = v * enhancedS;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = v - c;

            let rp, gp, bp;
            if (h < 60) [rp, gp, bp] = [c, x, 0];
            else if (h < 120) [rp, gp, bp] = [x, c, 0];
            else if (h < 180) [rp, gp, bp] = [0, c, x];
            else if (h < 240) [rp, gp, bp] = [0, x, c];
            else if (h < 300) [rp, gp, bp] = [x, 0, c];
            else [rp, gp, bp] = [c, 0, x];

            data[i] = (rp + m) * 255;
            data[i + 1] = (gp + m) * 255;
            data[i + 2] = (bp + m) * 255;
        }
    }

    normalizeContrast(imageData) {
        const data = imageData.data;
        const histogram = new Array(256).fill(0);

        // Calculate histogram
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[gray]++;
        }

        // Find min and max
        let min = 0, max = 255;
        let sum = 0;
        const threshold = data.length / 4 * 0.01;

        for (let i = 0; i < 256; i++) {
            sum += histogram[i];
            if (sum > threshold) {
                min = i;
                break;
            }
        }

        sum = 0;
        for (let i = 255; i >= 0; i--) {
            sum += histogram[i];
            if (sum > threshold) {
                max = i;
                break;
            }
        }

        // Normalize
        const range = max - min;
        if (range > 0) {
            for (let i = 0; i < data.length; i += 4) {
                for (let c = 0; c < 3; c++) {
                    data[i + c] = Math.max(0, Math.min(255,
                        255 * (data[i + c] - min) / range));
                }
            }
        }
    }

    updateProgress(percent, status) {
        const progressFill = document.getElementById('progressFill');
        const statusText = document.getElementById('statusText');
        progressFill.style.width = percent + '%';
        progressFill.textContent = Math.round(percent) + '%';
        statusText.textContent = status;
    }

    displayStats(processingTime, scale) {
        document.getElementById('processingTime').textContent = processingTime + 's';
        document.getElementById('resolutionIncrease').textContent = scale + '× (' +
            (scale * scale) + '× pixels)';

        const originalPixels = this.originalImage.width * this.originalImage.height;
        const resultPixels = this.resultCanvas.width * this.resultCanvas.height;
        const sizeMB = (resultPixels * 4 / 1024 / 1024).toFixed(2);
        document.getElementById('fileSize').textContent = sizeMB + ' MB';

        document.getElementById('resultInfo').textContent =
            `${this.resultCanvas.width} × ${this.resultCanvas.height} pixels`;

        document.getElementById('stats').classList.add('active');
        document.getElementById('downloadBtn').classList.add('active');
    }

    downloadImage() {
        this.resultCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'upscaled-' + Date.now() + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ImageUpscaler();
});
