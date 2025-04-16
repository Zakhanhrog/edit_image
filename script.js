document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.querySelector('.app-container');
    const uploadScreen = document.getElementById('upload-screen');
    const editorScreen = document.getElementById('editor-screen');
    const imageUpload = document.getElementById('imageUpload');
    const imageCanvas = document.getElementById('imageCanvas');
    let ctx = null;

    const backButton = document.getElementById('backButton');
    const saveButton = document.getElementById('saveButton');
    const resetButton = document.getElementById('resetButton');

    const tabButtons = document.querySelectorAll('.tab-button');
    const controlPanels = document.querySelectorAll('.control-panel');

    const redToggle = document.getElementById('redToggle');
    const greenToggle = document.getElementById('greenToggle');
    const blueToggle = document.getElementById('blueToggle');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const brightnessValueSpan = document.getElementById('brightnessValue');
    const contrastSlider = document.getElementById('contrastSlider');
    const contrastValueSpan = document.getElementById('contrastValue');
    const saturationSlider = document.getElementById('saturationSlider');
    const saturationValueSpan = document.getElementById('saturationValue');
    const grayscaleToggle = document.getElementById('grayscaleToggle');
    const posterizeSlider = document.getElementById('posterizeSlider');
    const posterizeValueSpan = document.getElementById('posterizeValue');

    let originalImage = null;
    let originalImageData = null;
    let isProcessing = false;

    function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function switchScreen(screenToShow) {
        const screens = [uploadScreen, editorScreen];
        screens.forEach(screen => {
            if (screen.id === screenToShow.id) {
                screen.classList.add('active');
            } else {
                screen.classList.remove('active');
            }
        });
    }

    function showAlert(message, type = 'error') {
        console[type === 'error' ? 'error' : 'log'](message);
        alert(message);
    }

    imageUpload.addEventListener('change', (e) => {
        if (isProcessing) return;
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showAlert('Vui lòng chọn một tệp hình ảnh hợp lệ.');
            e.target.value = null;
            return;
        }

        isProcessing = true;

        const reader = new FileReader();

        reader.onload = (event) => {
            originalImage = new Image();

            originalImage.onload = () => {
                try {
                    ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) {
                        throw new Error("Không thể lấy context 2D từ canvas.");
                    }

                    imageCanvas.width = originalImage.naturalWidth;
                    imageCanvas.height = originalImage.naturalHeight;
                    ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);

                    originalImageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

                    resetAdjustments();
                    switchScreen(editorScreen);

                } catch (error) {
                    console.error("Lỗi trong image.onload:", error);
                    showAlert(`Đã xảy ra lỗi khi xử lý ảnh: ${error.message}`);
                    goBackToUpload();
                } finally {
                    isProcessing = false;
                    e.target.value = null;
                }
            };

            originalImage.onerror = (err) => {
                console.error("Image onerror - Lỗi tải ảnh vào đối tượng Image:", err);
                showAlert("Không thể tải ảnh này. Tệp có thể bị hỏng hoặc không được hỗ trợ.");
                isProcessing = false;
                e.target.value = null;
                goBackToUpload();
            };

            originalImage.src = event.target.result;
        };

        reader.onerror = (err) => {
            console.error("FileReader onerror - Lỗi đọc tệp:", err);
            showAlert("Đã xảy ra lỗi khi đọc tệp ảnh.");
            isProcessing = false;
            e.target.value = null;
        };

        reader.readAsDataURL(file);
    });

    backButton.addEventListener('click', () => {
        if (isProcessing) return;
        goBackToUpload();
    });

    saveButton.addEventListener('click', () => {
        if (isProcessing || !originalImage || !imageCanvas) return;
        try {
            const link = document.createElement('a');
            link.download = 'edited-image.png';
            if (imageCanvas.width > 0 && imageCanvas.height > 0) {
                link.href = imageCanvas.toDataURL('image/png');
                link.click();
            } else {
                showAlert("Không có ảnh để lưu.");
            }
        } catch (error) {
            console.error("Lỗi khi lưu ảnh:", error);
            showAlert(`Không thể lưu ảnh: ${error.message}. Thử lại hoặc dùng định dạng JPEG.`);
            try {
                const link = document.createElement('a');
                link.download = 'edited-image.jpg';
                link.href = imageCanvas.toDataURL('image/jpeg', 0.9);
                link.click();
            } catch (jpegError) {
                console.error("Lỗi khi lưu ảnh JPEG:", jpegError);
                showAlert(`Không thể lưu ảnh dưới dạng JPEG: ${jpegError.message}.`);
            }
        }
    });

    resetButton.addEventListener('click', () => {
        if (isProcessing || !originalImageData) return;
        resetAdjustments();
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isProcessing) return;
            const targetPanelId = button.getAttribute('data-controls');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            controlPanels.forEach(panel => panel.classList.remove('active'));

            button.classList.add('active');
            const activePanel = document.getElementById(targetPanelId);
            if (activePanel) {
                activePanel.classList.add('active');
            } else {
                console.warn(`Không tìm thấy panel với ID: ${targetPanelId}`);
            }
        });
    });

    const adjustmentControls = [
        redToggle, greenToggle, blueToggle,
        brightnessSlider, contrastSlider, saturationSlider,
        grayscaleToggle, posterizeSlider
    ];

    adjustmentControls.forEach(control => {
        const eventType = control.type === 'range' ? 'input' : 'change';
        control.addEventListener(eventType, () => {
            if (control.type === 'range') {
                updateSliderValueDisplay(control);
            }
            requestAnimationFrame(applyAdjustments);
        });
    });

    function updateSliderValueDisplay(slider) {
        let valueText = `${slider.value}%`;
        let targetSpanId = '';

        switch (slider.id) {
            case 'brightnessSlider': targetSpanId = 'brightnessValue'; break;
            case 'contrastSlider': targetSpanId = 'contrastValue'; break;
            case 'saturationSlider': targetSpanId = 'saturationValue'; break;
            case 'posterizeSlider':
                targetSpanId = 'posterizeValue';
                const levels = parseInt(slider.value);
                valueText = levels === 0 ? 'Tắt' : `${levels} mức`;
                break;
        }
        if (targetSpanId) {
            const span = document.getElementById(targetSpanId);
            if (span) span.textContent = valueText;
        }
    }

    function goBackToUpload() {
        switchScreen(uploadScreen);
        resetAdjustments();
        if (ctx) {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        }
        imageCanvas.width = 0;
        imageCanvas.height = 0;
        originalImage = null;
        originalImageData = null;
        ctx = null;
    }

    function resetAdjustments() {
        redToggle.checked = true;
        greenToggle.checked = true;
        blueToggle.checked = true;
        grayscaleToggle.checked = false;

        brightnessSlider.value = 100;
        contrastSlider.value = 100;
        saturationSlider.value = 100;
        posterizeSlider.value = 0;

        updateSliderValueDisplay(brightnessSlider);
        updateSliderValueDisplay(contrastSlider);
        updateSliderValueDisplay(saturationSlider);
        updateSliderValueDisplay(posterizeSlider);

        imageCanvas.style.filter = 'none';

        if (ctx && originalImage) {
            if(imageCanvas.width !== originalImage.naturalWidth || imageCanvas.height !== originalImage.naturalHeight) {
                imageCanvas.width = originalImage.naturalWidth;
                imageCanvas.height = originalImage.naturalHeight;
            }
            ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
        } else if (originalImageData && ctx) {
            if(ctx) {
                imageCanvas.width = originalImageData.width;
                imageCanvas.height = originalImageData.height;
                ctx.putImageData(originalImageData, 0, 0);
            }
        }
    }

    function applyAdjustments() {
        if (isProcessing || !originalImageData || !ctx) {
            return;
        }

        isProcessing = true;

        try {
            const showRed = redToggle.checked;
            const showGreen = greenToggle.checked;
            const showBlue = blueToggle.checked;
            const brightnessOffset = parseInt(brightnessSlider.value) - 100;
            const contrastVal = parseInt(contrastSlider.value);
            const contrastFactor = contrastVal === 100 ? 1.0 : (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
            const saturationFactor = parseInt(saturationSlider.value) / 100.0;
            const applyGrayscale = grayscaleToggle.checked;
            const posterizeLevels = parseInt(posterizeSlider.value);

            const workingImageData = new ImageData(
                new Uint8ClampedArray(originalImageData.data),
                originalImageData.width,
                originalImageData.height
            );
            const data = workingImageData.data;

            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];

                if (!showRed) r = 0;
                if (!showGreen) g = 0;
                if (!showBlue) b = 0;

                if (brightnessOffset !== 0) {
                    r += brightnessOffset;
                    g += brightnessOffset;
                    b += brightnessOffset;
                }

                if (contrastFactor !== 1.0) {
                    r = contrastFactor * (r - 128) + 128;
                    g = contrastFactor * (g - 128) + 128;
                    b = contrastFactor * (b - 128) + 128;
                }

                if (saturationFactor !== 1.0) {
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = lum + saturationFactor * (r - lum);
                    g = lum + saturationFactor * (g - lum);
                    b = lum + saturationFactor * (b - lum);
                }

                if (applyGrayscale) {
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = g = b = gray;
                }

                if (posterizeLevels > 1) {
                    const levelStep = 255 / (posterizeLevels - 1);
                    r = Math.round(r / levelStep) * levelStep;
                    g = Math.round(g / levelStep) * levelStep;
                    b = Math.round(b / levelStep) * levelStep;
                }

                data[i] = clamp(r);
                data[i + 1] = clamp(g);
                data[i + 2] = clamp(b);
            }

            ctx.putImageData(workingImageData, 0, 0);

        } catch (error) {
            console.error("Lỗi trong quá trình applyAdjustments:", error);
            showAlert(`Đã xảy ra lỗi khi áp dụng hiệu ứng: ${error.message}`);
            if (originalImageData && ctx) {
                ctx.putImageData(originalImageData, 0, 0);
            }
        } finally {
            isProcessing = false;
        }
    }

});