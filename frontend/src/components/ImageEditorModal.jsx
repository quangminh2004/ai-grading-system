import React, { useState, useEffect, useRef } from 'react';

/**
 * ImageEditorModal: Trình cắt ảnh thông minh & Xoay ảnh 360 độ cho bài làm học sinh
 * - Xoay 360 độ (xoay nhanh 90°, 180°, 270° hoặc thanh trượt mịn 0° - 360°)
 * - Khung cắt tương tác (8 điểm kéo, kéo di chuyển, tỉ lệ tự do / 3:4 / A4)
 * - Render chất lượng cao qua HTML5 Canvas với độ phân giải gốc của ảnh
 * - Hỗ trợ duyệt và chỉnh sửa nhiều trang ảnh liên tiếp (Trang 1, Trang 2...)
 */
export default function ImageEditorModal({
  isOpen,
  files = [],
  studentName = '',
  onClose,
  onComplete, // Nhận mảng File đã qua xử lý cắt và xoay
}) {
  if (!isOpen || !files || files.length === 0) return null;

  // Quản lý trang hiện tại khi nạp nhiều ảnh
  const [currentIdx, setCurrentIdx] = useState(0);
  // Lưu trữ trạng thái chỉnh sửa của từng file: { [idx]: { rotation: number, crop: { x, y, width, height } } }
  const [editStates, setEditStates] = useState({});
  // Lưu trữ ảnh đã xử lý: { [idx]: File }
  const [processedFiles, setProcessedFiles] = useState({});

  const [imageObj, setImageObj] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Trạng thái của trang hiện tại
  const [rotation, setRotation] = useState(0); // 0 - 360 độ
  const [crop, setCrop] = useState({ x: 5, y: 5, width: 90, height: 90 }); // Tỉ lệ % (0-100)
  const [aspectRatio, setAspectRatio] = useState('free'); // 'free', '3:4', '1:1.414', 'full'

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef({
    isDragging: false,
    dragType: null, // 'move', 'tl', 'tr', 'bl', 'br', 't', 'r', 'b', 'l', 'create'
    startX: 0,
    startY: 0,
    initialCrop: null,
  });

  const currentFile = files[currentIdx];
  const isImageFile = currentFile && currentFile.type.startsWith('image/');

  // Khi chuyển trang hoặc mở modal: Tải ảnh hiện tại vào bộ nhớ
  useEffect(() => {
    if (!currentFile) return;

    if (!isImageFile) {
      // Nếu là PDF hoặc file không phải ảnh, giữ nguyên không cần crop
      setImageObj(null);
      setImageLoaded(true);
      return;
    }

    setImageLoaded(false);
    const objectUrl = URL.createObjectURL(currentFile);
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      setImageLoaded(true);

      // Khôi phục trạng thái đã chỉnh sửa của trang này (nếu có)
      const saved = editStates[currentIdx];
      if (saved) {
        setRotation(saved.rotation || 0);
        setCrop(saved.crop || { x: 5, y: 5, width: 90, height: 90 });
      } else {
        setRotation(0);
        setCrop({ x: 5, y: 5, width: 90, height: 90 });
      }
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [currentIdx, currentFile]);

  // Lưu trạng thái của trang hiện tại khi thay đổi rotation hoặc crop
  useEffect(() => {
    setEditStates((prev) => ({
      ...prev,
      [currentIdx]: { rotation, crop },
    }));
  }, [rotation, crop, currentIdx]);

  // Tính toán kích thước ảnh xoay trong canvas
  const getRotatedDimensions = (origW, origH, deg) => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
      rotW: Math.round(origW * cos + origH * sin),
      rotH: Math.round(origW * sin + origH * cos),
    };
  };

  // Vẽ hình ảnh xoay và khung cắt lên Canvas hiển thị
  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj || !imageLoaded) return;
    const ctx = canvas.getContext('2d');

    const origW = imageObj.naturalWidth;
    const origH = imageObj.naturalHeight;
    const { rotW, rotH } = getRotatedDimensions(origW, origH, rotation);

    // Kích thước khung chứa preview
    const container = containerRef.current;
    const maxW = container ? Math.min(container.clientWidth - 20, 680) : 600;
    const maxH = 460;

    const scale = Math.min(maxW / rotW, maxH / rotH, 1);
    const dispW = Math.round(rotW * scale);
    const dispH = Math.round(rotH * scale);

    canvas.width = dispW;
    canvas.height = dispH;

    ctx.clearRect(0, 0, dispW, dispH);

    // 1. Vẽ ảnh đã xoay
    ctx.save();
    ctx.translate(dispW / 2, dispH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(imageObj, -origW / 2, -origH / 2);
    ctx.restore();

    // 2. Tọa độ thực tế của khung cắt trên canvas hiển thị (pixels)
    const cropPixelX = (crop.x / 100) * dispW;
    const cropPixelY = (crop.y / 100) * dispH;
    const cropPixelW = (crop.width / 100) * dispW;
    const cropPixelH = (crop.height / 100) * dispH;

    // 3. Phủ lớp nền mờ vùng nằm ngoài khung cắt
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    // Vùng trên
    ctx.fillRect(0, 0, dispW, cropPixelY);
    // Vùng dưới
    ctx.fillRect(0, cropPixelY + cropPixelH, dispW, dispH - (cropPixelY + cropPixelH));
    // Vùng trái
    ctx.fillRect(0, cropPixelY, cropPixelX, cropPixelH);
    // Vùng phải
    ctx.fillRect(cropPixelX + cropPixelW, cropPixelY, dispW - (cropPixelX + cropPixelW), cropPixelH);

    // 4. Vẽ viền khung cắt (màu xanh lá nổi bật)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cropPixelX, cropPixelY, cropPixelW, cropPixelH);

    // 5. Vẽ lưới 1/3 (Rule of thirds) mờ bên trong
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    // 2 đường dọc
    ctx.beginPath();
    ctx.moveTo(cropPixelX + cropPixelW / 3, cropPixelY);
    ctx.lineTo(cropPixelX + cropPixelW / 3, cropPixelY + cropPixelH);
    ctx.moveTo(cropPixelX + (cropPixelW * 2) / 3, cropPixelY);
    ctx.lineTo(cropPixelX + (cropPixelW * 2) / 3, cropPixelY + cropPixelH);
    // 2 đường ngang
    ctx.moveTo(cropPixelX, cropPixelY + cropPixelH / 3);
    ctx.lineTo(cropPixelX + cropPixelW, cropPixelY + cropPixelH / 3);
    ctx.moveTo(cropPixelX, cropPixelY + (cropPixelH * 2) / 3);
    ctx.lineTo(cropPixelX + cropPixelW, cropPixelY + (cropPixelH * 2) / 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Vẽ 8 điểm tay nắm (handles) ở các góc và cạnh
    const handleSize = 10;
    const handles = [
      { x: cropPixelX, y: cropPixelY }, // tl
      { x: cropPixelX + cropPixelW / 2, y: cropPixelY }, // tc
      { x: cropPixelX + cropPixelW, y: cropPixelY }, // tr
      { x: cropPixelX + cropPixelW, y: cropPixelY + cropPixelH / 2 }, // rc
      { x: cropPixelX + cropPixelW, y: cropPixelY + cropPixelH }, // br
      { x: cropPixelX + cropPixelW / 2, y: cropPixelY + cropPixelH }, // bc
      { x: cropPixelX, y: cropPixelY + cropPixelH }, // bl
      { x: cropPixelX, y: cropPixelY + cropPixelH / 2 }, // lc
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    handles.forEach((h) => {
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });
  };

  useEffect(() => {
    drawPreview();
  }, [imageObj, imageLoaded, rotation, crop]);

  // Các thao tác chuột trên Canvas
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pctX: ((clientX - rect.left) / canvas.width) * 100,
      pctY: ((clientY - rect.top) / canvas.height) * 100,
    };
  };

  const detectDragType = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cropPixelX = (crop.x / 100) * canvas.width;
    const cropPixelY = (crop.y / 100) * canvas.height;
    const cropPixelW = (crop.width / 100) * canvas.width;
    const cropPixelH = (crop.height / 100) * canvas.height;
    const threshold = 16;

    // Góc
    if (Math.hypot(x - cropPixelX, y - cropPixelY) <= threshold) return 'tl';
    if (Math.hypot(x - (cropPixelX + cropPixelW), y - cropPixelY) <= threshold) return 'tr';
    if (Math.hypot(x - cropPixelX, y - (cropPixelY + cropPixelH)) <= threshold) return 'bl';
    if (Math.hypot(x - (cropPixelX + cropPixelW), y - (cropPixelY + cropPixelH)) <= threshold) return 'br';

    // Cạnh
    if (Math.abs(y - cropPixelY) <= threshold && x >= cropPixelX && x <= cropPixelX + cropPixelW) return 't';
    if (Math.abs(y - (cropPixelY + cropPixelH)) <= threshold && x >= cropPixelX && x <= cropPixelX + cropPixelW) return 'b';
    if (Math.abs(x - cropPixelX) <= threshold && y >= cropPixelY && y <= cropPixelY + cropPixelH) return 'l';
    if (Math.abs(x - (cropPixelX + cropPixelW)) <= threshold && y >= cropPixelY && y <= cropPixelY + cropPixelH) return 'r';

    // Di chuyển bên trong khung cắt
    if (x >= cropPixelX && x <= cropPixelX + cropPixelW && y >= cropPixelY && y <= cropPixelY + cropPixelH) {
      return 'move';
    }

    return null;
  };

  const handlePointerDown = (e) => {
    const coords = getCanvasCoords(e);
    const dragType = detectDragType(coords.x, coords.y);
    if (!dragType) return;

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: coords.pctX,
      startY: coords.pctY,
      initialCrop: { ...crop },
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const coords = getCanvasCoords(e);
    const { dragType, startX, startY, initialCrop } = dragRef.current;
    const dx = coords.pctX - startX;
    const dy = coords.pctY - startY;

    let next = { ...initialCrop };

    if (dragType === 'move') {
      next.x = Math.max(0, Math.min(100 - next.width, initialCrop.x + dx));
      next.y = Math.max(0, Math.min(100 - next.height, initialCrop.y + dy));
    } else if (dragType === 'br') {
      next.width = Math.max(10, Math.min(100 - next.x, initialCrop.width + dx));
      next.height = Math.max(10, Math.min(100 - next.y, initialCrop.height + dy));
    } else if (dragType === 'tl') {
      const newX = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + dx));
      const newY = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + dy));
      next.width = initialCrop.width + (initialCrop.x - newX);
      next.height = initialCrop.height + (initialCrop.y - newY);
      next.x = newX;
      next.y = newY;
    } else if (dragType === 'tr') {
      const newY = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + dy));
      next.width = Math.max(10, Math.min(100 - next.x, initialCrop.width + dx));
      next.height = initialCrop.height + (initialCrop.y - newY);
      next.y = newY;
    } else if (dragType === 'bl') {
      const newX = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + dx));
      next.width = initialCrop.width + (initialCrop.x - newX);
      next.height = Math.max(10, Math.min(100 - next.y, initialCrop.height + dy));
      next.x = newX;
    } else if (dragType === 't') {
      const newY = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + dy));
      next.height = initialCrop.height + (initialCrop.y - newY);
      next.y = newY;
    } else if (dragType === 'b') {
      next.height = Math.max(10, Math.min(100 - next.y, initialCrop.height + dy));
    } else if (dragType === 'l') {
      const newX = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + dx));
      next.width = initialCrop.width + (initialCrop.x - newX);
      next.x = newX;
    } else if (dragType === 'r') {
      next.width = Math.max(10, Math.min(100 - next.x, initialCrop.width + dx));
    }

    setCrop(next);
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
  };

  // Các thao tác xoay nhanh
  const rotateLeft90 = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const rotateRight90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const rotate180 = () => {
    setRotation((prev) => (prev + 180) % 360);
  };

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10) || 0;
    setRotation(val % 360);
  };

  // Chọn tỷ lệ cắt
  const applyPresetRatio = (ratioType) => {
    setAspectRatio(ratioType);
    if (ratioType === 'full') {
      setCrop({ x: 0, y: 0, width: 100, height: 100 });
      return;
    }
    if (ratioType === '3:4') {
      setCrop({ x: 10, y: 5, width: 67.5, height: 90 });
      return;
    }
    if (ratioType === '1:1.414') {
      // Chuẩn khổ A4 dọc
      setCrop({ x: 15, y: 5, width: 63.6, height: 90 });
      return;
    }
    // Freeform mặc định
    setCrop({ x: 5, y: 5, width: 90, height: 90 });
  };

  // Thực hiện xuất ảnh cắt và xoay cho 1 tệp ảnh với độ phân giải gốc cao nhất
  const processSingleImage = async (file, rotVal, cropVal) => {
    if (!file || !file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;
        const { rotW, rotH } = getRotatedDimensions(origW, origH, rotVal);

        // Canvas full xoay ảnh
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = rotW;
        fullCanvas.height = rotH;
        const fullCtx = fullCanvas.getContext('2d');

        fullCtx.translate(rotW / 2, rotH / 2);
        fullCtx.rotate((rotVal * Math.PI) / 180);
        fullCtx.drawImage(img, -origW / 2, -origH / 2);

        // Tọa độ cắt thực tế trên ảnh độ phân giải gốc
        const pxX = Math.round((cropVal.x / 100) * rotW);
        const pxY = Math.round((cropVal.y / 100) * rotH);
        const pxW = Math.round((cropVal.width / 100) * rotW);
        const pxH = Math.round((cropVal.height / 100) * rotH);

        // Canvas cắt kết quả
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.max(1, pxW);
        cropCanvas.height = Math.max(1, pxH);
        const cropCtx = cropCanvas.getContext('2d');

        cropCtx.drawImage(fullCanvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);

        cropCanvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            const safeName = file.name.replace(/\.[^.]+$/, '') + '-cropped.jpg';
            const croppedFile = new File([blob], safeName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(croppedFile);
          },
          'image/jpeg',
          0.93 // Chất lượng cao để AI đọc chữ nét nhất
        );
      };
      img.src = objectUrl;
    });
  };

  // Xác nhận lưu trang hiện tại và chuyển sang trang kế tiếp hoặc nạp bài
  const handleSaveCurrentPage = async () => {
    setIsProcessing(true);
    try {
      const processedCurrent = await processSingleImage(currentFile, rotation, crop);
      const updatedProcessed = {
        ...processedFiles,
        [currentIdx]: processedCurrent,
      };
      setProcessedFiles(updatedProcessed);

      if (currentIdx < files.length - 1) {
        // Chuyển sang chỉnh sửa trang tiếp theo
        setCurrentIdx((prev) => prev + 1);
      } else {
        // Đã hoàn thành tất cả các trang
        const finalFilesList = files.map((origFile, idx) => {
          return updatedProcessed[idx] || origFile;
        });
        onComplete(finalFilesList);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Hoàn tất nạp tất cả các trang ngay lập tức
  const handleFinishAll = async () => {
    setIsProcessing(true);
    try {
      // Xử lý trang hiện tại trước
      const processedCurrent = await processSingleImage(currentFile, rotation, crop);
      const updatedProcessed = {
        ...processedFiles,
        [currentIdx]: processedCurrent,
      };

      // Xử lý các trang khác nếu có lưu trạng thái editStates
      const finalFilesList = [];
      for (let i = 0; i < files.length; i++) {
        if (updatedProcessed[i]) {
          finalFilesList.push(updatedProcessed[i]);
        } else if (editStates[i] && files[i].type.startsWith('image/')) {
          const res = await processSingleImage(files[i], editStates[i].rotation, editStates[i].crop);
          finalFilesList.push(res);
        } else {
          finalFilesList.push(files[i]);
        }
      }

      onComplete(finalFilesList);
    } finally {
      setIsProcessing(false);
    }
  };

  // Bỏ qua cắt, nạp trực tiếp ảnh gốc
  const handleSkipCrop = () => {
    onComplete(files);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '94vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f9fafb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#111827', fontWeight: '700' }}>
                Cắt &amp; Xoay ảnh bài làm {studentName ? `— Học sinh: ${studentName}` : ''}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                Xoay ảnh thẳng đứng và cắt lấy đúng vùng bài viết tay để AI đọc chữ chính xác nhất
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {files.length > 1 && (
              <span
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                Trang {currentIdx + 1} / {files.length}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '4px',
                lineHeight: 1,
              }}
              title="Đóng"
            >
              ✕
            </button>
          </div>
        </div>

        {/* NẾU CÓ NHIỀU FILE: THANH CHUYỂN TRANG */}
        {files.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '8px 20px',
              background: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb',
              overflowX: 'auto',
            }}
          >
            {files.map((f, i) => {
              const isSelected = i === currentIdx;
              const isDone = Boolean(processedFiles[i]);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIdx(i)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? '#15803d' : '#d1d5db'}`,
                    background: isSelected ? '#15803d' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#374151',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>Trang {i + 1}</span>
                  {isDone && <span style={{ color: isSelected ? '#bbf7d0' : '#16a34a' }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* THÂN MODAL: VÙNG CANVAS HIỂN THỊ */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minHeight: '360px',
            backgroundColor: '#18181b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '14px',
            userSelect: 'none',
            position: 'relative',
          }}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {!imageLoaded ? (
            <div style={{ color: '#9ca3af', fontSize: '14px' }}>Đang tải hình ảnh bài làm...</div>
          ) : !isImageFile ? (
            <div style={{ color: '#e5e7eb', textAlign: 'center', padding: '30px' }}>
              <strong>Tệp dạng PDF: Không cần cắt ảnh</strong>
              <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>
                Hệ thống sẽ tải tệp PDF lên và xử lý trực tiếp.
              </p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                borderRadius: '4px',
                cursor: 'crosshair',
                touchAction: 'none',
                maxWidth: '100%',
                maxHeight: '460px',
              }}
              onMouseDown={handlePointerDown}
              onTouchStart={handlePointerDown}
            />
          )}

          {/* Gợi ý hướng dẫn nhỏ dưới góc */}
          {isImageFile && imageLoaded && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '14px',
                backgroundColor: 'rgba(0,0,0,0.65)',
                color: '#e5e7eb',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                pointerEvents: 'none',
              }}
            >
              Kéo 4 góc/cạnh để đổi kích thước khung cắt · Kéo bên trong khung để di chuyển
            </div>
          )}
        </div>

        {/* THANH CÔNG CỤ CẮT & XOAY 360 ĐỘ */}
        {isImageFile && (
          <div
            style={{
              padding: '14px 22px',
              background: '#ffffff',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Hàng 1: Xoay ảnh 360 độ */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Xoay ảnh:</span>
                <button
                  type="button"
                  className="btn outline"
                  onClick={rotateLeft90}
                  style={{ padding: '5px 11px', fontSize: '12.5px', borderRadius: '6px' }}
                  title="Xoay ngược chiều kim đồng hồ 90 độ"
                >
                  ⟲ Xoay trái 90°
                </button>
                <button
                  type="button"
                  className="btn outline"
                  onClick={rotateRight90}
                  style={{ padding: '5px 11px', fontSize: '12.5px', borderRadius: '6px' }}
                  title="Xoay theo chiều kim đồng hồ 90 độ"
                >
                  ⟳ Xoay phải 90°
                </button>
                <button
                  type="button"
                  className="btn outline"
                  onClick={rotate180}
                  style={{ padding: '5px 11px', fontSize: '12.5px', borderRadius: '6px' }}
                  title="Lật ngược ảnh 180 độ"
                >
                  Lật 180°
                </button>
              </div>

              {/* Thanh trượt xoay 360 độ mịn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>0°</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={rotation}
                  onChange={handleSliderChange}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#15803d' }}
                  title="Kéo trượt để xoay ảnh linh hoạt 0 - 360 độ"
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>360°</span>
                <span
                  style={{
                    minWidth: '46px',
                    textAlign: 'center',
                    padding: '2px 6px',
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {rotation}°
                </span>
                {rotation !== 0 && (
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    Về 0°
                  </button>
                )}
              </div>
            </div>

            {/* Hàng 2: Tỉ lệ khung cắt */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Khung cắt:</span>
              <button
                type="button"
                onClick={() => applyPresetRatio('free')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: `1.5px solid ${aspectRatio === 'free' ? '#15803d' : '#d1d5db'}`,
                  background: aspectRatio === 'free' ? '#ecfdf5' : '#ffffff',
                  color: aspectRatio === 'free' ? '#065f46' : '#374151',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cắt tự do
              </button>
              <button
                type="button"
                onClick={() => applyPresetRatio('3:4')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: `1.5px solid ${aspectRatio === '3:4' ? '#15803d' : '#d1d5db'}`,
                  background: aspectRatio === '3:4' ? '#ecfdf5' : '#ffffff',
                  color: aspectRatio === '3:4' ? '#065f46' : '#374151',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Trang vở (3:4)
              </button>
              <button
                type="button"
                onClick={() => applyPresetRatio('1:1.414')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: `1.5px solid ${aspectRatio === '1:1.414' ? '#15803d' : '#d1d5db'}`,
                  background: aspectRatio === '1:1.414' ? '#ecfdf5' : '#ffffff',
                  color: aspectRatio === '1:1.414' ? '#065f46' : '#374151',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Giấy A4 dọc
              </button>
              <button
                type="button"
                onClick={() => applyPresetRatio('full')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: `1.5px solid ${aspectRatio === 'full' ? '#15803d' : '#d1d5db'}`,
                  background: aspectRatio === 'full' ? '#ecfdf5' : '#ffffff',
                  color: aspectRatio === 'full' ? '#065f46' : '#374151',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Lấy toàn bộ ảnh
              </button>
            </div>
          </div>
        )}

        {/* FOOTER MODAL: CÁC NÚT HÀNH ĐỘNG */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f9fafb',
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn outline"
              onClick={onClose}
              disabled={isProcessing}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSkipCrop}
              disabled={isProcessing}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              title="Bỏ qua chỉnh sửa và dùng nguyên gốc các tệp ảnh ban đầu"
            >
              Bỏ qua cắt (Nạp ảnh gốc)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {files.length > 1 && currentIdx < files.length - 1 ? (
              <>
                <button
                  type="button"
                  className="btn primary"
                  disabled={isProcessing}
                  onClick={handleSaveCurrentPage}
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Lưu trang này &amp; Sang trang {currentIdx + 2}</span>
                </button>
                <button
                  type="button"
                  className="btn outline"
                  disabled={isProcessing}
                  onClick={handleFinishAll}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#15803d',
                    borderColor: '#86efac',
                  }}
                >
                  Hoàn tất tất cả
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={isProcessing}
                onClick={handleFinishAll}
                style={{
                  padding: '9px 22px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: '#15803d',
                  borderColor: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{isProcessing ? 'Đang cắt ảnh...' : 'Cắt &amp; Hoàn tất nạp bài'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

