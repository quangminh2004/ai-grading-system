import React, { useState } from 'react';
import ImageEditorModal from './ImageEditorModal';

// Chuẩn hóa tên để đối chiếu
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export default function IntakePage({
  classroom,
  students,
  onUploadBatch,
  setPage,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mapping, setMapping] = useState({}); // { [filename]: studentId }
  const [uploading, setUploading] = useState(false);
  const [globalAssignStudentId, setGlobalAssignStudentId] = useState('');

  // Quản lý Modal Cắt & Xoay ảnh 360 độ
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // null = tất cả, number = file cụ thể

  // So khớp tên tệp với danh sách học sinh
  const matchFile = (filename) => {
    const stem = filename.replace(/\.[^.]+$/, '');
    let base = normalize(stem);

    // Khớp chính xác tên hoặc mã
    const matched = students.find((s) => {
      const sNameNorm = normalize(s.name);
      const sIdNorm = normalize(s.id);
      return (
        base === sNameNorm ||
        base === sIdNorm ||
        base === `${sIdNorm} ${sNameNorm}` ||
        base.includes(sNameNorm) ||
        base.includes(sIdNorm)
      );
    });

    return matched ? matched.id : '';
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles(files);
    const newMapping = {};
    files.forEach((f) => {
      newMapping[f.name] = matchFile(f.name);
    });
    setMapping(newMapping);

    // Nếu có tệp ảnh -> Tự động mở Modal Cắt & Xoay để giáo viên căn chỉnh ngay
    const hasImages = files.some((f) => f.type.startsWith('image/'));
    if (hasImages) {
      setEditingIndex(null);
      setEditorOpen(true);
    }
  };

  const handleEditorComplete = (processedList) => {
    if (editingIndex !== null) {
      // Cắt 1 file cụ thể
      const updatedFile = processedList[0];
      const oldFile = selectedFiles[editingIndex];
      const nextFiles = [...selectedFiles];
      nextFiles[editingIndex] = updatedFile;
      setSelectedFiles(nextFiles);

      // Chuyển mapping sang tên file mới
      if (oldFile && updatedFile && oldFile.name !== updatedFile.name) {
        setMapping((prev) => {
          const next = { ...prev };
          const studentId = next[oldFile.name];
          delete next[oldFile.name];
          next[updatedFile.name] = studentId;
          return next;
        });
      }
    } else {
      // Cắt danh sách nhiều file
      setSelectedFiles(processedList);
      setMapping((prev) => {
        const next = {};
        processedList.forEach((newFile, i) => {
          const origFile = selectedFiles[i];
          const studentId = (origFile && prev[origFile.name]) || matchFile(newFile.name);
          next[newFile.name] = studentId;
        });
        return next;
      });
    }
    setEditorOpen(false);
    setEditingIndex(null);
  };

  const handleSelectStudentForFile = (filename, studentId) => {
    setMapping((prev) => ({
      ...prev,
      [filename]: studentId,
    }));
  };

  // Gán tất cả các tệp hiện tại cho một học sinh
  const handleAssignAllToStudent = (studentId) => {
    setGlobalAssignStudentId(studentId);
    if (!studentId) return;
    const newMapping = {};
    selectedFiles.forEach((f) => {
      newMapping[f.name] = studentId;
    });
    setMapping(newMapping);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;

    // Kiểm tra xem có tệp nào chưa được ghép học sinh không
    const unmapped = selectedFiles.filter((f) => !mapping[f.name]);
    if (unmapped.length > 0) {
      alert(`Có ${unmapped.length} tệp chưa được gán cho học sinh nào!\nVui lòng chọn học sinh tương ứng ở ô chọn (hoặc dùng mục "Gán tất cả tệp cho một học sinh") trước khi bấm tiếp nhận.`);
      return;
    }

    setUploading(true);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('mapping', JSON.stringify(mapping));

    try {
      await onUploadBatch(formData);
      setSelectedFiles([]);
      setMapping({});
      setGlobalAssignStudentId('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · TIẾP NHẬN BÀI LÀM
          </div>
          <h1>Nhận bài &amp; Chấm AI</h1>
          <p className="sub">
            Tải lên bài làm dạng ảnh chụp hoặc PDF của học sinh {classroom?.label || 'lớp'}. Tệp được lưu trữ an toàn trên máy chủ hệ thống.
          </p>
        </div>
      </div>

      <div className="grid2">
        {/* Upload Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3>Tải tệp bài làm lên hệ thống</h3>
          <p style={{ color: '#687560', fontSize: '14px', marginBottom: '18px' }}>
            Hỗ trợ định dạng <b>PDF, PNG, JPG/JPEG</b> từ bất kỳ thư mục nào trên máy. Hệ thống tự đối chiếu tên tệp hoặc thầy cô tự ghép với học sinh trong danh sách.
          </p>

          <div
            style={{
              border: '2px dashed #b5c7aa',
              borderRadius: '10px',
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#fafbfa',
              cursor: 'pointer',
              marginBottom: '20px',
            }}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <strong>Kéo thả tệp vào đây hoặc nhấn để chọn ảnh bài làm</strong>
            <div style={{ fontSize: '13px', color: '#7a8670', marginTop: '6px' }}>
              Tối đa 20 tệp/lượt · Dung lượng tối đa 25MB/tệp · Hỗ trợ tải từ mọi thư mục
            </div>
            <input
              id="fileInput"
              type="file"
              multiple
              accept="image/png,image/jpeg,application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0 }}>Danh sách tệp chờ tiếp nhận ({selectedFiles.length} tệp)</h4>
                
                {/* Nút cắt & xoay ảnh và Chọn nhanh: Gán tất cả tệp cho một học sinh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      setEditingIndex(null);
                      setEditorOpen(true);
                    }}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      color: '#15803d',
                      borderColor: '#86efac',
                      background: '#f0fdf4',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Mở trình cắt ảnh và xoay 360 độ cho các ảnh đã chọn"
                  >
                    <span>Cắt &amp; Xoay ảnh</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <span>Gán tất cả cho:</span>
                    <select
                      value={globalAssignStudentId}
                      onChange={(e) => handleAssignAllToStudent(e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #3d6333', fontSize: '12px' }}
                    >
                      <option value="">-- Chọn để gán tất cả --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {selectedFiles.map((file, idx) => {
                  const currentMappedId = mapping[file.name] || '';
                  const isUnmapped = !currentMappedId;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: isUnmapped ? '#fff9f5' : '#f3f6ee',
                        border: isUnmapped ? '1px solid #f29f8f' : '1px solid #dce4d5',
                      }}
                    >
                      <div>
                        <strong>{file.name}</strong>
                        <div style={{ fontSize: '12px', color: '#7a8670' }}>
                          {(file.size / 1024).toFixed(1)} KB
                          {isUnmapped && (
                            <span style={{ color: '#d9534f', marginLeft: '8px', fontWeight: 'bold' }}>
                              Chưa chọn học sinh
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {file.type && file.type.startsWith('image/') && (
                          <button
                            type="button"
                            className="btn outline"
                            onClick={() => {
                              setEditingIndex(idx);
                              setEditorOpen(true);
                            }}
                            style={{
                              padding: '5px 10px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              color: '#15803d',
                              borderColor: '#86efac',
                              background: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Cắt lấy vùng bài viết và xoay ảnh 360 độ"
                          >
                            <span>Cắt &amp; Xoay</span>
                          </button>
                        )}

                        <span style={{ fontSize: '13px' }}>Học sinh:</span>
                        <select
                          value={currentMappedId}
                          onChange={(e) => handleSelectStudentForFile(file.name, e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: isUnmapped ? '2px solid #d9534f' : '1px solid #9bbd92',
                            background: isUnmapped ? '#fff' : '#fafff8',
                            fontWeight: isUnmapped ? 'normal' : '550',
                          }}
                        >
                          <option value="">-- Chọn học sinh --</option>
                          {students.map((s) => {
                            const subCount = s.allSubmissions?.length || (s.attachments?.length ? 1 : 0);
                            return (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.id}){subCount > 0 ? ` [Đã có ${subCount} bài]` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                marginTop: '14px',
                padding: '10px 14px',
                background: '#f4f9f1',
                border: '1px solid #c2dec0',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#2d5a22',
              }}>
                <strong>Mỗi lần nộp sẽ lưu thành một bài làm riêng:</strong> Học sinh có thể có nhiều bài nộp (bài nộp lại lần 2, lần 3...). Hệ thống sẽ lưu giữ đầy đủ lịch sử tất cả các bài làm để thầy cô xem và đối chiếu.
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#556550' }}>
                  Sau khi tải lên, AI sẽ tự động đọc tệp bằng OCR, phân tích ngôn ngữ và đề xuất điểm ngay lập tức.
                </span>
                <button
                  className="btn primary"
                  disabled={uploading}
                  onClick={handleUpload}
                >
                  {uploading ? 'Đang tiếp nhận & AI đang chấm...' : 'Tiếp nhận & AI Chấm ngay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3>Quy trình nhận &amp; Ghép bài</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>1</span>
              <div>
                <strong>Chọn tệp ảnh bài làm từ bất kỳ đâu</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Ảnh chụp từ điện thoại, máy ảnh hoặc tệp PDF đều được hỗ trợ. Không bắt buộc phải đặt tên cố định.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>2</span>
              <div>
                <strong>Tự động nhận diện hoặc chọn học sinh</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Hệ thống tự đối chiếu nếu tên tệp có chứa tên/mã học sinh. Nếu tên tệp ngẫu nhiên (ảnh chụp), thầy cô chỉ cần chọn học sinh từ danh sách thả xuống.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>3</span>
              <div>
                <strong>Nhiều bài nộp cho cùng một học sinh</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Một học sinh có thể nộp nhiều lần (bài 1, bài làm lại...). Mỗi bài được AI chấm riêng và thầy cô có thể chuyển qua lại giữa các bài để so sánh.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>4</span>
              <div>
                <strong>Nạp bài trực tiếp tại trang Chấm, chữa bài</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Thầy cô cũng có thể vào thẳng mục "Chấm, chữa bài", chọn học sinh và nhấn nút <b>"Tải bài mới"</b> để tải ảnh bài làm lên cho riêng em đó mà không cần vào trang này.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRÌNH CẮT ẢNH & XOAY ẢNH 360 ĐỘ */}
      <ImageEditorModal
        isOpen={editorOpen}
        files={
          editingIndex !== null
            ? [selectedFiles[editingIndex]].filter(Boolean)
            : selectedFiles.filter((f) => f.type && f.type.startsWith('image/'))
        }
        studentName={
          editingIndex !== null && mapping[selectedFiles[editingIndex]?.name]
            ? students.find((s) => s.id === mapping[selectedFiles[editingIndex]?.name])?.name
            : ''
        }
        onClose={() => {
          setEditorOpen(false);
          setEditingIndex(null);
        }}
        onComplete={handleEditorComplete}
      />
    </div>
  );
}
