import React from 'react';

const total = (a) => (a || []).reduce((s, n) => s + Number(n), 0);
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function OverviewPage({ classroom, students, setPage, onSelectStudent, onNewClassClick }) {
  if (!classroom) {
    return (
      <div className="card" style={{ padding: '60px 30px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <h2 style={{ margin: '0 0 10px 0', color: 'var(--ink)' }}>Chào mừng thầy cô đến với Hệ thống</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
          Tài khoản của bạn hiện chưa có lớp học nào trong cơ sở dữ liệu. Hãy tạo lớp học đầu tiên của trường để bắt đầu nhập danh sách học sinh và nhận bài!
        </p>
        <button className="btn primary" onClick={onNewClassClick} style={{ padding: '10px 22px', fontSize: '14px' }}>
          + Tạo lớp học mới ngay
        </button>
      </div>
    );
  }

  const approved = students.filter((s) => s.state === 'approved');
  const pending = students.filter((s) => s.state === 'suggested');
  const unsubmitted = students.filter((s) => s.state === 'new');

  const avgScore = approved.length
    ? fmt(approved.reduce((a, s) => a + total(s.teacherScores || s.scores), 0) / approved.length)
    : '—';

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · QUẢN LÝ LỚP HỌC
          </div>
          <h1>Tổng quan {classroom?.label || ''}</h1>
          <p className="sub">
            Năm học 2026-2027 · Quản lý và theo dõi tiến độ đánh giá bài viết
          </p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setPage('intake')}>
            <span>⇧</span> Nhận bài &amp; chấm AI
          </button>
          <button className="btn secondary" onClick={() => setPage('grading')}>
            <span>▤</span> Chấm, chữa bài
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="notice">
        <span className="symbol">✳</span>
        <div>
          <strong>Một trợ lý tận tâm, một quyết định của thầy cô.</strong>
          AI đề xuất điểm và cách chữa; giáo viên kiểm tra, chỉnh sửa và duyệt trước khi sử dụng.
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats">
        <div className="stat">
          <div className="stat-top">Học sinh trong lớp <span className="stat-icon">▤</span></div>
          <div className="stat-value">{students.length.toString().padStart(2, '0')}</div>
          <small>Tiếng Việt · {classroom?.label}</small>
        </div>
        <div className="stat">
          <div className="stat-top">Chờ giáo viên duyệt <span className="stat-icon">◷</span></div>
          <div className="stat-value pending">{pending.length.toString().padStart(2, '0')}</div>
          <small>Đã có gợi ý phân tích từ AI</small>
        </div>
        <div className="stat">
          <div className="stat-top">Giáo viên đã duyệt <span className="stat-icon">☑</span></div>
          <div className="stat-value good">{approved.length.toString().padStart(2, '0')}</div>
          <small>Kết quả chính thức được lưu</small>
        </div>
        <div className="stat">
          <div className="stat-top">Điểm TB đã duyệt <span className="stat-icon">↗</span></div>
          <div className="stat-value">
            {avgScore}
            <span style={{ fontSize: '12px', color: '#a0ac96', letterSpacing: 0 }}> /10</span>
          </div>
          <small>Chỉ tính bài đã được duyệt</small>
        </div>
      </div>

      {/* Overview content grid */}
      <div className="overview-grid grid2">
        {/* Left card: Tiến độ theo trạng thái */}
        <div className="card">
          <div className="card-head">
            <h3>Tiến độ bài làm của lớp</h3>
            <span className="count">{students.length} HS</span>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', height: '14px', borderRadius: '7px', overflow: 'hidden', background: '#f0f3eb', marginBottom: '16px' }}>
              <div
                style={{
                  width: `${(approved.length / (students.length || 1)) * 100}%`,
                  background: '#3d6333',
                  transition: 'width 0.3s',
                }}
                title={`Đã duyệt: ${approved.length}`}
              />
              <div
                style={{
                  width: `${(pending.length / (students.length || 1)) * 100}%`,
                  background: '#c48b28',
                  transition: 'width 0.3s',
                }}
                title={`Chờ duyệt: ${pending.length}`}
              />
              <div
                style={{
                  width: `${(unsubmitted.length / (students.length || 1)) * 100}%`,
                  background: '#cbd4c2',
                  transition: 'width 0.3s',
                }}
                title={`Chưa nộp: ${unsubmitted.length}`}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span><b style={{ color: '#3d6333' }}>●</b> Đã duyệt ({approved.length})</span>
              <span><b style={{ color: '#c48b28' }}>●</b> Chờ duyệt ({pending.length})</span>
              <span><b style={{ color: '#7a8670' }}>●</b> Chưa có bài ({unsubmitted.length})</span>
            </div>

            <hr style={{ margin: '20px 0', borderColor: '#e5e9df' }} />

            <h4>Danh sách học sinh</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
              {students.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#f8faf6',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSelectStudent(s.id);
                    setPage('grading');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="avatar small">{s.id.slice(-2)}</span>
                    <b>{s.name}</b>
                    <span style={{ fontSize: '12px', color: '#7a8670' }}>({s.id})</span>
                  </div>
                  <div>
                    <span className={`status ${s.state === 'approved' ? 'approved' : s.state === 'new' ? 'new' : ''}`}>
                      {s.state === 'approved' ? 'Đã duyệt' : s.state === 'suggested' ? 'Chờ duyệt' : 'Chưa có bài'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right card: Đề bài & Tiêu chí đang áp dụng */}
        <div className="card">
          <div className="card-head">
            <h3>Bài tập &amp; Thang tiêu chí chấm</h3>
            <button className="textbtn" onClick={() => setPage('rubric')}>
              Xem chi tiết ↗
            </button>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#f5f7f2', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7a8670', marginBottom: '4px' }}>
                Khung đánh giá bài tập làm văn
              </div>
              <strong style={{ fontSize: '15px', color: '#273822', display: 'block' }}>
                Hỗ trợ đa dạng thể loại: Miêu tả, Kể chuyện, Nêu cảm nghĩ, Viết thư...
              </strong>
            </div>

            <h4 style={{ marginBottom: '10px' }}>4 Tiêu chí đánh giá chuẩn (Tổng 10 điểm)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { name: '1. Nội dung & chi tiết', max: 4, desc: 'Đúng trọng tâm đề bài; có chi tiết, hình ảnh cụ thể và sinh động.' },
                { name: '2. Sắp xếp ý & bố cục', max: 2, desc: 'Bố cục rõ ràng, các câu và đoạn kết nối mạch lạc, hợp lý.' },
                { name: '3. Từ ngữ & diễn đạt', max: 2, desc: 'Từ ngữ phù hợp, gợi cảm; câu rõ nghĩa; diễn đạt tự nhiên, sáng tạo.' },
                { name: '4. Chính tả & dấu câu', max: 2, desc: 'Viết đúng chính tả, đúng quy tắc viết hoa và dấu câu.' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', border: '1px solid #e3e8dc' }}>
                  <div>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: '12px', color: '#687560' }}>{c.desc}</div>
                  </div>
                  <b style={{ color: '#3d6333', fontSize: '15px' }}>{c.max}đ</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
