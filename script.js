// Đảm bảo mã JavaScript chỉ chạy sau khi toàn bộ DOM đã được tải
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Lấy tham chiếu đến các phần tử DOM ---
    // Lấy các container màn hình chính và khu vực kéo thả
    const appContainer = document.querySelector('.app-container');
    const uploadScreen = document.getElementById('upload-screen');
    const editorScreen = document.getElementById('editor-screen');
    const imagePlaceholder = document.querySelector('.image-placeholder'); // Khu vực kéo thả

    // Lấy input file (được ẩn đi)
    const imageUpload = document.getElementById('imageUpload');

    // Lấy canvas để vẽ và chỉnh sửa ảnh
    const imageCanvas = document.getElementById('imageCanvas');
    let ctx = null; // Context 2D của canvas, sẽ được khởi tạo sau khi ảnh được tải

    // Lấy các nút điều khiển chính trong header và footer editor
    const backButton = document.getElementById('backButton');
    const saveButton = document.getElementById('saveButton');
    const resetButton = document.getElementById('resetButton');

    // Lấy các nút tab và các panel điều khiển tương ứng
    const tabButtons = document.querySelectorAll('.tab-button');
    const controlPanels = document.querySelectorAll('.control-panel');

    // Lấy các control điều chỉnh cụ thể
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

    // --- 2. Biến trạng thái và dữ liệu ảnh ---
    let originalImage = null; // Đối tượng Image gốc
    let originalImageData = null; // Dữ liệu pixel gốc (ImageData) từ canvas
    let isProcessing = false; // Cờ để ngăn các hành động khác khi đang xử lý ảnh

    // --- 3. Hàm Helper ---

    // Hàm giới hạn giá trị pixel trong khoảng [0, 255]
    function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    // Hàm chuyển đổi màn hình
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

    // Hàm hiển thị thông báo (hiện tại dùng alert và console)
    function showAlert(message, type = 'error') {
        console[type === 'error' ? 'error' : 'log'](`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }

    // Hàm cập nhật hiển thị giá trị của thanh trượt
    function updateSliderValueDisplay(slider) {
        let valueText = `${slider.value}%`; // Định dạng mặc định là %
        let targetSpanId = '';

        // Xác định span hiển thị giá trị dựa trên ID của slider
        switch (slider.id) {
            case 'brightnessSlider': targetSpanId = 'brightnessValue'; break;
            case 'contrastSlider': targetSpanId = 'contrastValue'; break;
            case 'saturationSlider': targetSpanId = 'saturationValue'; break;
            case 'posterizeSlider':
                targetSpanId = 'posterizeValue';
                const levels = parseInt(slider.value);
                valueText = levels === 0 ? 'Tắt' : `${levels} mức`; // Định dạng đặc biệt cho Posterize
                break;
            default: return; // Thoát nếu không phải slider đã biết
        }

        // Cập nhật text của span tương ứng
        const span = document.getElementById(targetSpanId);
        if (span) {
            span.textContent = valueText;
        } else {
            console.warn(`Không tìm thấy span hiển thị giá trị với ID: ${targetSpanId}`);
        }
    }

    // Hàm quay trở lại màn hình tải ảnh và reset trạng thái
    function goBackToUpload() {
        if (isProcessing) {
            console.warn("Đang trong quá trình xử lý, không thể quay lại.");
            return; // Ngăn quay lại khi đang xử lý
        }

        // Chuyển màn hình
        switchScreen(uploadScreen);

        // Reset các điều chỉnh
        resetAdjustments(); // Hàm này cũng sẽ xóa canvas hoặc vẽ lại ảnh gốc nếu cần

        // Xóa canvas và dữ liệu ảnh cũ
        if (ctx) {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        }
        imageCanvas.width = 0; // Reset kích thước canvas
        imageCanvas.height = 0;
        originalImage = null;
        originalImageData = null;
        ctx = null; // Xóa context

        // Reset input file để có thể tải lại file vừa tải
        if (imageUpload) {
            imageUpload.value = null;
        }
        // Xóa class kéo thả nếu còn sót
        imagePlaceholder.classList.remove('drag-over');
    }

    // Hàm reset tất cả các điều chỉnh về giá trị mặc định
    function resetAdjustments() {
        // Đặt lại giá trị các toggle
        redToggle.checked = true;
        greenToggle.checked = true;
        blueToggle.checked = true;
        grayscaleToggle.checked = false;

        // Đặt lại giá trị các slider
        brightnessSlider.value = 100;
        contrastSlider.value = 100;
        saturationSlider.value = 100;
        posterizeSlider.value = 0;

        // Cập nhật hiển thị giá trị các slider
        updateSliderValueDisplay(brightnessSlider);
        updateSliderValueDisplay(contrastSlider);
        updateSliderValueDisplay(saturationSlider);
        updateSliderValueDisplay(posterizeSlider);

        // Loại bỏ bộ lọc CSS (nếu có)
        imageCanvas.style.filter = 'none';

        // Vẽ lại ảnh gốc lên canvas
        if (originalImageData && ctx) {
            // Sử dụng putImageData để đảm bảo trạng thái pixel gốc
            if(imageCanvas.width !== originalImageData.width || imageCanvas.height !== originalImageData.height) {
                // Đảm bảo canvas có kích thước phù hợp trước khi putImageData
                imageCanvas.width = originalImageData.width;
                imageCanvas.height = originalImageData.height;
            }
            ctx.putImageData(originalImageData, 0, 0);
        } else if (originalImage && ctx) {
            // Trường hợp dự phòng nếu originalImageData không tồn tại (không mong muốn)
            if(imageCanvas.width !== originalImage.naturalWidth || imageCanvas.height !== originalImage.naturalHeight) {
                imageCanvas.width = originalImage.naturalWidth;
                imageCanvas.height = originalImage.naturalHeight;
            }
            ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
        } else if (ctx) {
            // Trường hợp không có ảnh, chỉ xóa canvas
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        }

        console.log("Đã đặt lại điều chỉnh.");
        isProcessing = false; // Đảm bảo cờ xử lý được đặt lại sau reset
    }


    // Hàm áp dụng tất cả các điều chỉnh lên ảnh
    // Sử dụng requestAnimationFrame để tối ưu hiệu suất khi kéo slider
    function applyAdjustments() {
        if (isProcessing || !originalImageData || !ctx) {
            //console.log("Không áp dụng điều chỉnh: Đang xử lý, không có ảnh gốc hoặc context canvas.");
            return; // Không xử lý nếu đang bận hoặc chưa có ảnh gốc
        }

        //isProcessing = true; // Đặt cờ bắt đầu xử lý (chú ý: requestAnimationFrame có thể gọi nhanh, cần quản lý cờ cẩn thận)
        // Đối với các hiệu ứng pixel, ta sẽ tạo một bản sao ImageData để thao tác
        // Điều này đảm bảo originalImageData luôn giữ dữ liệu gốc
        const workingImageData = new ImageData(
            new Uint8ClampedArray(originalImageData.data), // Sao chép mảng pixel
            originalImageData.width,
            originalImageData.height
        );
        const data = workingImageData.data; // Lấy mảng pixel từ bản sao

        // Lấy giá trị từ các control
        const showRed = redToggle.checked;
        const showGreen = greenToggle.checked;
        const showBlue = blueToggle.checked;
        const brightnessOffset = parseInt(brightnessSlider.value) - 100; // Độ sáng: 100 là gốc, >100 sáng hơn, <100 tối hơn
        const contrastVal = parseInt(contrastSlider.value);
        // Công thức tính contrast factor (dùng 259 là giá trị tốt cho dải 0-200)
        const contrastFactor = contrastVal === 100 ? 1.0 : (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
        const saturationFactor = parseInt(saturationSlider.value) / 100.0; // Bão hòa: 1.0 là gốc
        const applyGrayscale = grayscaleToggle.checked;
        const posterizeLevels = parseInt(posterizeSlider.value); // Áp phích hóa: 0 hoặc 1 là tắt

        // Lặp qua từng pixel trong ảnh
        // Mỗi pixel có 4 giá trị: R, G, B, Alpha (độ trong suốt)
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];     // Giá trị kênh Đỏ (0-255)
            let g = data[i + 1]; // Giá trị kênh Xanh lá (0-255)
            let b = data[i + 2]; // Giá trị kênh Xanh dương (0-255)
            // data[i + 3] là kênh Alpha, thường không chỉnh sửa

            // 1. Áp dụng bộ lọc RGB (bật/tắt kênh màu)
            if (!showRed) r = 0;
            if (!showGreen) g = 0;
            if (!showBlue) b = 0;

            // 2. Áp dụng điều chỉnh Độ sáng
            if (brightnessOffset !== 0) {
                r += brightnessOffset;
                g += brightnessOffset;
                b += brightnessOffset;
            }

            // 3. Áp dụng điều chỉnh Tương phản
            // Công thức: new_color = factor * (old_color - 128) + 128
            if (contrastFactor !== 1.0) {
                r = contrastFactor * (r - 128) + 128;
                g = contrastFactor * (g - 128) + 128;
                b = contrastFactor * (b - 128) + 128;
            }

            // 4. Áp dụng điều chỉnh Bão hòa (Saturation)
            // Công thức: new_color = luminance + factor * (old_color - luminance)
            if (saturationFactor !== 1.0) {
                // Tính độ sáng (luminance) của pixel (phổ biến công thức BT.709)
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                r = lum + saturationFactor * (r - lum);
                g = lum + saturationFactor * (g - lum);
                b = lum + saturationFactor * (b - lum);
            }

            // 5. Áp dụng hiệu ứng Thang xám (Grayscale)
            if (applyGrayscale) {
                // Tính giá trị xám dựa trên độ sáng
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = g = b = gray; // Gán giá trị xám cho cả 3 kênh
            }

            // 6. Áp dụng hiệu ứng Áp phích hóa (Posterize)
            // Chỉ áp dụng nếu levels > 1
            if (posterizeLevels > 1) {
                const levelStep = 255 / (posterizeLevels - 1); // Khoảng cách giữa các mức màu
                // Lượng tử hóa giá trị màu về mức gần nhất
                r = Math.round(r / levelStep) * levelStep;
                g = Math.round(g / levelStep) * levelStep;
                b = Math.round(b / levelStep) * levelStep;
            }

            // 7. Giới hạn giá trị pixel trong khoảng [0, 255] và gán lại vào mảng data
            data[i] = clamp(r);
            data[i + 1] = clamp(g);
            data[i + 2] = clamp(b);
            // data[i + 3] (Alpha) giữ nguyên
        }

        // Vẽ dữ liệu pixel đã chỉnh sửa lên canvas
        try {
            // Đảm bảo canvas có kích thước đúng trước khi putImageData
            if(imageCanvas.width !== workingImageData.width || imageCanvas.height !== workingImageData.height) {
                imageCanvas.width = workingImageData.width;
                imageCanvas.height = workingImageData.height;
            }
            ctx.putImageData(workingImageData, 0, 0);
            //isProcessing = false; // Kết thúc xử lý
        } catch (error) {
            console.error("Lỗi khi đưa dữ liệu ảnh lên canvas:", error);
            showAlert(`Không thể cập nhật ảnh trên canvas: ${error.message}`);
            //isProcessing = false; // Đảm bảo cờ được đặt lại ngay cả khi có lỗi
        }
        // isProcessing = false; // Cờ này nên được đặt lại sau khi requestAnimationFrame hoàn thành,
        // hoặc quản lý chặt hơn nếu nhiều yêu cầu apply liên tục.
        // Với requestAnimationFrame, mỗi frame chỉ có 1 lần gọi apply, nên đặt ở cuối là OK.
    }


    // --- 4. Xử lý File (Tải ảnh) ---

    // Hàm chung để xử lý tệp ảnh (dùng cho cả input file và kéo thả)
    function handleFile(file) {
        if (!file) {
            showAlert('Không có tệp nào được chọn.', 'warning');
            return;
        }

        // Kiểm tra loại tệp
        if (!file.type.startsWith('image/')) {
            showAlert('Vui lòng chọn một tệp hình ảnh hợp lệ.', 'warning');
            return;
        }

        if (isProcessing) {
            console.warn("Đang xử lý tệp khác, vui lòng chờ.");
            return;
        }
        isProcessing = true; // Đặt cờ đang xử lý

        const reader = new FileReader();

        // Sự kiện khi FileReader đọc tệp thành công
        reader.onload = (event) => {
            originalImage = new Image(); // Tạo đối tượng Image mới

            // Sự kiện khi đối tượng Image tải dữ liệu ảnh thành công
            originalImage.onload = () => {
                try {
                    // Lấy context 2D từ canvas
                    ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) {
                        throw new Error("Không thể lấy context 2D từ canvas.");
                    }

                    // Đặt kích thước canvas bằng kích thước ảnh gốc
                    imageCanvas.width = originalImage.naturalWidth;
                    imageCanvas.height = originalImage.naturalHeight;

                    // Vẽ ảnh gốc lên canvas
                    ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);

                    // Lấy dữ liệu pixel gốc từ canvas
                    originalImageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

                    // Reset các điều chỉnh về mặc định và áp dụng lên ảnh vừa tải
                    resetAdjustments(); // Hàm này sẽ vẽ lại ảnh gốc từ originalImageData

                    // Chuyển sang màn hình chỉnh sửa
                    switchScreen(editorScreen);

                    console.log(`Đã tải ảnh thành công. Kích thước: ${originalImage.naturalWidth}x${originalImage.naturalHeight}`);

                } catch (error) {
                    console.error("Lỗi trong quá trình xử lý ảnh sau khi tải:", error);
                    showAlert(`Đã xảy ra lỗi khi hiển thị ảnh: ${error.message}`);
                    goBackToUpload(); // Quay về màn hình tải ảnh nếu có lỗi
                } finally {
                    isProcessing = false; // Kết thúc xử lý
                }
            };

            // Sự kiện khi đối tượng Image không tải được dữ liệu
            originalImage.onerror = (err) => {
                console.error("Image onerror - Lỗi tải ảnh vào đối tượng Image:", err);
                showAlert("Không thể tải ảnh này. Tệp có thể bị hỏng hoặc không được hỗ trợ.");
                isProcessing = false;
                goBackToUpload(); // Quay về màn hình tải ảnh
            };

            // Bắt đầu đọc dữ liệu ảnh từ Data URL
            originalImage.src = event.target.result;
        };

        // Sự kiện khi FileReader không đọc được tệp
        reader.onerror = (err) => {
            console.error("FileReader onerror - Lỗi đọc tệp:", err);
            showAlert("Đã xảy ra lỗi khi đọc tệp ảnh.");
            isProcessing = false;
        };

        // Đọc tệp như một Data URL (chuỗi base64)
        reader.readAsDataURL(file);
    }

    // Lắng nghe sự kiện khi người dùng chọn tệp bằng input file
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0]; // Lấy tệp đầu tiên được chọn
        handleFile(file); // Gọi hàm xử lý tệp chung

        // Xóa giá trị của input file để cho phép chọn lại cùng một tệp sau này
        e.target.value = null;
    });

    // Lắng nghe sự kiện kéo file vào khu vực placeholder
    imagePlaceholder.addEventListener('dragover', (e) => {
        e.preventDefault(); // Ngăn chặn hành vi mặc định (mở file trong trình duyệt)
        // Thêm class CSS để tạo hiệu ứng hình ảnh khi kéo qua
        if (!isProcessing) {
            imagePlaceholder.classList.add('drag-over');
        }
    });

    // Lắng nghe sự kiện rê file rời khỏi khu vực placeholder
    imagePlaceholder.addEventListener('dragleave', () => {
        // Xóa class CSS hiệu ứng khi rời khỏi vùng
        imagePlaceholder.classList.remove('drag-over');
    });

    // Lắng nghe sự kiện thả file vào khu vực placeholder
    imagePlaceholder.addEventListener('drop', (e) => {
        e.preventDefault(); // Ngăn chặn hành vi mặc định
        imagePlaceholder.classList.remove('drag-over'); // Xóa hiệu ứng

        const files = e.dataTransfer.files; // Lấy danh sách các tệp được thả
        if (files.length > 0) {
            handleFile(files[0]); // Chỉ xử lý tệp đầu tiên
        } else {
            showAlert('Không có tệp nào được thả.', 'warning');
        }
    });

    // Khi click vào khu vực placeholder, kích hoạt input file
    imagePlaceholder.addEventListener('click', () => {
        if (!isProcessing) {
            imageUpload.click(); // Mô phỏng hành động click vào input file
        }
    });


    // --- 5. Xử lý Sự kiện của các Control và Nút ---

    // Nút Quay lại
    backButton.addEventListener('click', () => {
        goBackToUpload();
    });

    // Nút Lưu ảnh
    saveButton.addEventListener('click', () => {
        if (isProcessing || !originalImage || !imageCanvas || imageCanvas.width === 0 || imageCanvas.height === 0) {
            showAlert('Không có ảnh để lưu hoặc đang xử lý.', 'warning');
            return; // Không lưu nếu đang xử lý, chưa có ảnh hoặc canvas rỗng
        }

        try {
            // Tạo thẻ 'a' để tải ảnh
            const link = document.createElement('a');
            link.download = 'edited-image.png'; // Tên tệp khi tải về

            // Chuyển nội dung canvas thành Data URL (PNG mặc định)
            link.href = imageCanvas.toDataURL('image/png');

            // Kích hoạt sự kiện click trên thẻ 'a' để trình duyệt tải tệp
            link.click();

            console.log("Đã yêu cầu tải ảnh.");

        } catch (error) {
            console.error("Lỗi khi lưu ảnh PNG:", error);
            showAlert(`Không thể lưu ảnh định dạng PNG: ${error.message}. Thử lại với JPEG?`);
            // Thử lưu dưới dạng JPEG nếu PNG thất bại
            try {
                const link = document.createElement('a');
                link.download = 'edited-image.jpg';
                // toDataURL cho JPEG cần chỉ định chất lượng (0-1), 0.9 là tốt
                link.href = imageCanvas.toDataURL('image/jpeg', 0.9);
                link.click();
                console.log("Đã yêu cầu tải ảnh dưới dạng JPEG.");
            } catch (jpegError) {
                console.error("Lỗi khi lưu ảnh JPEG:", jpegError);
                showAlert(`Không thể lưu ảnh dưới dạng JPEG: ${jpegError.message}.`);
            }
        }
    });

    // Nút Đặt lại
    resetButton.addEventListener('click', () => {
        if (isProcessing || !originalImageData) {
            console.warn("Không thể đặt lại: Đang xử lý hoặc không có ảnh gốc.");
            return;
        }
        resetAdjustments();
        // applyAdjustments(); // resetAdjustments đã vẽ lại ảnh gốc, không cần gọi apply ngay
    });

    // Xử lý chuyển đổi giữa các Tab điều khiển
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isProcessing) {
                console.warn("Đang xử lý, không thể chuyển tab.");
                return;
            }

            const targetPanelId = button.getAttribute('data-controls'); // Lấy ID panel mục tiêu từ data-attribute

            // Loại bỏ class 'active' khỏi tất cả tab và panel
            tabButtons.forEach(btn => btn.classList.remove('active'));
            controlPanels.forEach(panel => panel.classList.remove('active'));

            // Thêm class 'active' cho tab và panel mục tiêu
            button.classList.add('active');
            const activePanel = document.getElementById(targetPanelId);
            if (activePanel) {
                activePanel.classList.add('active');
            } else {
                console.warn(`Không tìm thấy panel với ID: ${targetPanelId}`);
            }
        });
    });

    // Lắng nghe sự kiện thay đổi giá trị của các control điều chỉnh
    // Gom tất cả các control vào một mảng để xử lý tiện hơn
    const adjustmentControls = [
        redToggle, greenToggle, blueToggle,
        brightnessSlider, contrastSlider, saturationSlider,
        grayscaleToggle, posterizeSlider
    ];

    adjustmentControls.forEach(control => {
        // Chọn loại sự kiện phù hợp: 'input' cho slider (cập nhật liên tục), 'change' cho checkbox
        const eventType = control.type === 'range' ? 'input' : 'change';

        control.addEventListener(eventType, () => {
            // Cập nhật hiển thị giá trị cho slider
            if (control.type === 'range') {
                updateSliderValueDisplay(control);
            }

            // Yêu cầu trình duyệt thực hiện applyAdjustments ở frame vẽ tiếp theo
            // Điều này giúp tối ưu hiệu suất, tránh gọi apply liên tục khi kéo slider
            if (!isProcessing) {
                isProcessing = true; // Đặt cờ trước khi yêu cầu frame
                requestAnimationFrame(() => {
                    applyAdjustments();
                    isProcessing = false; // Xóa cờ sau khi hoàn thành apply
                });
            } else {
                // Nếu đã có yêu cầu frame đang chờ hoặc đang xử lý,
                // applyAdjustments sẽ tự chạy khi frame đó kết thúc.
                // Không cần làm gì thêm ở đây.
                // Có thể thêm logic để hủy frame cũ và yêu cầu frame mới để đáp ứng nhanh hơn,
                // nhưng với setup hiện tại, requestAnimationFrame tự quản lý khá tốt.
            }
        });
    });

    // --- 6. Khởi tạo ban đầu ---
    // (Hiện tại không cần khởi tạo gì đặc biệt ngoài việc các màn hình đã được định sẵn class 'active' ban đầu trong HTML)
    // Đảm bảo màn hình upload là màn hình đầu tiên
    // switchScreen(uploadScreen); // Dòng này không cần thiết nếu HTML đã đặt class active đúng
});