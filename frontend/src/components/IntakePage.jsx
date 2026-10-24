import React, { useState } from 'react';

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
  onResetSamples,
  setPage,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mapping, setMapping] = useState({}); // { [filename]: studentId }
  const [uploading, setUploading] = useState(false);

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
  };

  const handleSelectStudentForFile = (filename, studentId) => {
    setMapping((prev) => ({
      ...prev,
      [filename]: studentId,
    }));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">TRỢ LÝ CHẤM CHỮA BÀI · THANH LÂN</div>
          <h1>Nhận bài &amp; Chấm AI</h1>
          <p className="sub">
            Tải lên bài làm dạng ảnh chụp hoặc PDF của học sinh {classroom?.label}. Tệp được lưu trữ và quản lý trên Cloud.
          </p>
        </div>
        <div className="actions">
          <button className="btn outline" onClick={onResetSamples}>
            <span>↻</span> Nạp bộ bài mẫu lớp 4A
          </button>
        </div>
      </div>

      <div className="grid2">
        {/* Upload Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3>Tải tệp bài làm lên hệ thống</h3>
          <p style={{ color: '#687560', fontSize: '14px', marginBottom: '18px' }}>
            Hỗ trợ định dạng <b>PDF, PNG, JPG/JPEG</b>. Hệ thống tự đối chiếu tên tệp với danh sách học sinh của lớp.
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
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
            <strong>Kéo thả tệp vào đây hoặc nhấn để chọn từ máy</strong>
            <div style={{ fontSize: '13px', color: '#7a8670', marginTop: '6px' }}>
              Tối đa 20 tệp/lượt · Dung lượng tối đa 25MB/tệp
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
              <h4>Danh sách tệp chờ tiếp nhận ({selectedFiles.length} tệp)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#f3f6ee',
                      border: '1px solid #dce4d5',
                    }}
                  >
                    <div>
                      <strong>{file.name}</strong>
                      <div style={{ fontSize: '12px', color: '#7a8670' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px' }}>Ghép vào HS:</span>
                      <select
                        value={mapping[file.name] || ''}
                        onChange={(e) => handleSelectStudentForFile(file.name, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ccc' }}
                      >
                        <option value="">-- Chọn học sinh --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  className="btn primary"
                  disabled={uploading}
                  onClick={handleUpload}
                >
                  {uploading ? 'Đang tải lên...' : '🚀 Tiếp nhận & Lưu vào MongoDB Atlas'}
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
                <strong>Đặt tên tệp theo quy ước</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Ví dụ: <code>Nguyen Minh An.jpg</code> hoặc <code>HS01_Nguyen Minh An.pdf</code>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>2</span>
              <div>
                <strong>Tự động nhận diện &amp; So khớp</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Hệ thống chuẩn hóa không dấu và tự tìm học sinh tương ứng trong danh sách lớp.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="avatar small" style={{ background: '#3d6333', color: '#fff' }}>3</span>
              <div>
                <strong>Chấm &amp; Phê duyệt</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#556550' }}>
                  Sau khi tiếp nhận, chuyển qua màn hình "Chấm, chữa bài" để xem bài gốc, chỉnh điểm và xác nhận kết quả.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
