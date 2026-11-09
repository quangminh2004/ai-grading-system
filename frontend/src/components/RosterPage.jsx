import React, { useState } from 'react';

export default function RosterPage({
  classroom,
  students,
  onAddStudent,
  onImportRoster,
}) {
  const [singleName, setSingleName] = useState('');
  const [singleId, setSingleId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [tab, setTab] = useState('list'); // 'list' | 'single' | 'bulk'

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!singleName.trim()) return;
    await onAddStudent({ name: singleName, studentId: singleId });
    setSingleName('');
    setSingleId('');
    setTab('list');
  };

  const handleImportBulk = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    await onImportRoster(bulkText);
    setBulkText('');
    setTab('list');
  };

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · DANH SÁCH LỚP HỌC
          </div>
          <h1>Danh sách học sinh · {classroom?.label}</h1>
          <p className="sub">
            Quản lý sĩ số lớp {classroom?.label}. Tổng cộng: {students.length} học sinh.
          </p>
        </div>
        <div className="actions">
          <button
            className={`btn ${tab === 'list' ? 'primary' : 'outline'}`}
            onClick={() => setTab('list')}
          >
            Danh sách
          </button>
          <button
            className={`btn ${tab === 'single' ? 'primary' : 'outline'}`}
            onClick={() => setTab('single')}
          >
            + Thêm 1 học sinh
          </button>
          <button
            className={`btn ${tab === 'bulk' ? 'primary' : 'outline'}`}
            onClick={() => setTab('bulk')}
          >
            Nhập hàng loạt
          </button>
        </div>
      </div>

      {tab === 'list' && (
        <div className="card" style={{ padding: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e3e8dc', color: '#66755e' }}>
                <th style={{ padding: '12px' }}>STT</th>
                <th style={{ padding: '12px' }}>Mã HS</th>
                <th style={{ padding: '12px' }}>Họ và tên</th>
                <th style={{ padding: '12px' }}>Trạng thái bài làm</th>
                <th style={{ padding: '12px' }}>Tệp đính kèm</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #eef2ea' }}>
                  <td style={{ padding: '12px', color: '#7a8670' }}>{idx + 1}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.id}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="avatar small">{s.id.slice(-2)}</span>
                      <span>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      className={`status ${
                        s.state === 'approved' ? 'approved' : s.state === 'new' ? 'new' : ''
                      }`}
                    >
                      {s.state === 'approved'
                        ? 'Đã duyệt'
                        : s.state === 'suggested'
                        ? 'Chờ GV duyệt'
                        : 'Chưa có bài'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#687560' }}>
                    {s.attachments?.length ? `${s.attachments.length} tệp` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'single' && (
        <div className="card" style={{ padding: '24px', maxWidth: '500px' }}>
          <h3>Thêm học sinh mới vào lớp {classroom?.label}</h3>
          <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                Mã học sinh (tùy chọn, vd: HS07):
              </label>
              <input
                type="text"
                placeholder="Tự động tạo nếu để trống"
                value={singleId}
                onChange={(e) => setSingleId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                Họ và tên học sinh (*):
              </label>
              <input
                type="text"
                required
                placeholder="Nhập họ và tên..."
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="btn primary">
                Thêm học sinh
              </button>
              <button type="button" className="btn outline" onClick={() => setTab('list')}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="card" style={{ padding: '24px', maxWidth: '650px' }}>
          <h3>Nhập danh sách học sinh hàng loạt</h3>
          <p style={{ color: '#687560', fontSize: '14px' }}>
            Dán danh sách học sinh vào ô bên dưới, mỗi học sinh trên một dòng. Có thể bao gồm mã HS hoặc chỉ họ tên.
          </p>

          <form onSubmit={handleImportBulk} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <textarea
              rows="8"
              required
              placeholder={`Nguyễn Văn A\nTrần Thị B\nHS05 Lê Văn C`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn primary">
                Nhập danh sách
              </button>
              <button type="button" className="btn outline" onClick={() => setTab('list')}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
