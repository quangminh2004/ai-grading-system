import React, { useState, useEffect } from 'react';
import { getFileUrl, api } from '../api';

const total = (a) => (a || []).reduce((s, n) => s + Number(n), 0);
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const rubric = [
  { name: 'Nội dung & chi tiết', max: 4, desc: 'Đúng yêu cầu tả cây; có chi tiết cụ thể về hình dáng, đặc điểm hoặc sự gắn bó.' },
  { name: 'Sắp xếp ý', max: 2, desc: 'Các ý được kết nối và sắp xếp hợp lý trong đoạn văn.' },
  { name: 'Từ ngữ & diễn đạt', max: 2, desc: 'Từ ngữ phù hợp; câu rõ nghĩa; có cách diễn đạt riêng.' },
  { name: 'Chính tả & dấu câu', max: 2, desc: 'Viết đúng chính tả, viết hoa và sử dụng dấu câu phù hợp.' },
];

export default function GradingPage({
  students,
  selectedId,
  onSelectStudent,
  onOpenEditModal,
  onExportCSV,
  currentClassId,
  onRefreshClass,
  showToast,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'profile' | 'logs'
  const [gradingAI, setGradingAI] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState('');

  const current = students.find((s) => s.id === selectedId) || students[0];

  useEffect(() => {
    if (current) {
      setEditedText(current.text || '');
      setIsEditingText(false);
    }
  }, [current?.id]);

  const handleGradeAI = async () => {
    if (!current || !currentClassId) return;
    setGradingAI(true);
    try {
      const textToSend = isEditingText ? editedText : (current.text || undefined);
      const res = await api.gradeWithAI(currentClassId, current.id, textToSend);
      if (res.success) {
        showToast?.(res.message || '✓ AI đã chấm và đề xuất điểm bài làm thành công!');
        setIsEditingText(false);
        if (onRefreshClass) await onRefreshClass(currentClassId);
      } else {
        showToast?.(res.message || 'Lỗi khi kích hoạt AI');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setGradingAI(false);
    }
  };

  const handleGradeAllAI = async () => {
    if (!currentClassId) return;
    if (!window.confirm('Kích hoạt AI tự động chấm toàn bộ bài chưa duyệt trong lớp?')) return;
    setGradingAI(true);
    try {
      const res = await api.gradeAllWithAI(currentClassId);
      if (res.success) {
        showToast?.(res.message || '✓ Đã chấm xong bài làm toàn lớp!');
        if (onRefreshClass) await onRefreshClass(currentClassId);
      } else {
        showToast?.(res.message || 'Lỗi khi chấm bài');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setGradingAI(false);
    }
  };

  const visibleStudents = students.filter((s) => {
    const matchFilter = filter === 'all' || s.state === filter;
    const matchQuery =
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.id.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  if (!students.length) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Lớp này chưa có học sinh nào.</h3>
        <p>Vui lòng chuyển qua mục "Danh sách lớp" để thêm học sinh.</p>
      </div>
    );
  }

  const currentScores = current.teacherScores || current.scores || [];
  const currentTotal = total(currentScores);

  return (
    <div className="layout grading-layout">
      {/* LEFT PANEL: Student list */}
      <div className="card">
        <div className="card-head">
          <h3>Danh sách bài làm</h3>
          <span className="count">{students.length} HS</span>
        </div>

        <div className="searchbox">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Tìm tên hoặc mã học sinh…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ padding: '0 12px 10px 12px' }}>
          <button
            className="btn compact outline"
            onClick={handleGradeAllAI}
            disabled={gradingAI}
            style={{
              width: '100%',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: '#f6f9f3',
              borderColor: '#b4cfab',
              color: '#2b5a20',
              fontWeight: '550',
            }}
            title="Kích hoạt AI chấm toàn bộ bài chưa duyệt trong lớp"
          >
            <span>{gradingAI ? '⏳' : '⚡'}</span>
            <span>{gradingAI ? 'AI đang chấm cả lớp...' : 'AI Chấm cả lớp'}</span>
          </button>
        </div>

        <div className="filters">
          {[
            ['all', 'Tất cả'],
            ['suggested', 'Chờ duyệt'],
            ['approved', 'Đã duyệt'],
            ['new', 'Chưa có bài'],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`filter ${filter === k ? 'active' : ''}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="student-list" style={{ maxHeight: '650px', overflowY: 'auto' }}>
          {visibleStudents.map((s) => {
            const hasScores = (s.teacherScores || s.scores)?.length > 0;
            const scoreSum = hasScores ? total(s.teacherScores || s.scores) : null;
            const hasAttachments = s.attachments?.length > 0;
            return (
              <button
                key={s.id}
                className={`student ${selectedId === s.id ? 'selected' : ''}`}
                onClick={() => onSelectStudent(s.id)}
              >
                <span className="avatar">{s.id.slice(-2)}</span>
                <div className="student-meta">
                  <div className="student-top">
                    <strong>{s.name}</strong>
                    <span className="student-id">{s.id}</span>
                  </div>
                  <div className="student-sub">
                    <span
                      className={`status ${
                        s.state === 'approved'
                          ? 'approved'
                          : s.state === 'suggested' || hasScores
                          ? 'suggested'
                          : hasAttachments
                          ? 'waiting'
                          : 'new'
                      }`}
                    >
                      {s.state === 'approved'
                        ? 'Đã duyệt'
                        : s.state === 'suggested' || hasScores
                        ? 'Chờ GV duyệt'
                        : hasAttachments
                        ? 'Chờ AI chấm'
                        : 'Chưa có bài'}
                    </span>
                    {scoreSum !== null && (
                      <span className="student-score">
                        {fmt(scoreSum)}
                        <small>/10</small>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Details of Selected Student */}
      {current && (
        <div className="detail">
          {/* Header of Detail */}
          <div className="detail-head">
            <div className="detail-title">
              <span className="avatar">{current.id.slice(-2)}</span>
              <div>
                <h2>{current.name}</h2>
                <div className="detail-meta">
                  <span>Mã: <b>{current.id}</b></span>
                  <span>•</span>
                  <span>
                    Trạng thái: 
                    <span
                      className={`status ${
                        current.state === 'approved'
                          ? 'approved'
                          : current.state === 'suggested' || (current.teacherScores || current.scores)?.length > 0
                          ? 'suggested'
                          : current.attachments?.length > 0
                          ? 'waiting'
                          : 'new'
                      }`}
                      style={{ marginLeft: '6px' }}
                    >
                      {current.state === 'approved'
                        ? 'Đã duyệt'
                        : current.state === 'suggested' || (current.teacherScores || current.scores)?.length > 0
                        ? 'Chờ GV duyệt'
                        : current.attachments?.length > 0
                        ? 'Chờ AI chấm'
                        : 'Chưa có bài'}
                    </span>
                  </span>
                  <span>•</span>
                  <span>Trực tuyến: <b>Đã đồng bộ</b></span>
                </div>
              </div>
            </div>

            <div className="detail-actions">
              {/* NÚT KÍCH HOẠT CHẤM AI */}
              <button
                className="btn secondary"
                onClick={handleGradeAI}
                disabled={gradingAI}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f0f7ec',
                  color: '#285e20',
                  border: '1px solid #b7d6ab',
                  fontWeight: '550',
                }}
                title="Kích hoạt trợ lý AI phân tích và chấm bài"
              >
                <span>{gradingAI ? '⏳' : '⚡'}</span>
                <span>
                  {gradingAI
                    ? 'AI đang chấm...'
                    : (current.scores?.length > 0 ? 'AI Chấm lại' : 'Chấm bài bằng AI')}
                </span>
              </button>

              <button
                className="btn primary"
                onClick={() => onOpenEditModal(current)}
              >
                <span>✎</span> Chỉnh sửa &amp; Duyệt bài
              </button>
              <button className="btn outline" onClick={onExportCSV}>
                Xuất CSV
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              Bài làm &amp; Chấm chữa
            </button>
            <button
              className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Hồ sơ năng lực
            </button>
            <button
              className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              Nhật ký duyệt ({current.logs?.length || 0})
            </button>
          </div>

          {/* TAB 1: Review */}
          {activeTab === 'review' && (
            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Score summary banner */}
              <div
                style={{
                  background: current.state === 'approved' ? '#ebf4e6' : '#fff9ea',
                  border: `1px solid ${current.state === 'approved' ? '#bcd4af' : '#ebd49d'}`,
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#55634e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {current.teacherScores ? 'Điểm chính thức (Giáo viên duyệt)' : 'Điểm đề xuất từ AI'}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#273822' }}>
                    {currentScores.length ? fmt(currentTotal) : '—'}
                    <span style={{ fontSize: '16px', color: '#7a8670' }}> / 10 điểm</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {current.state === 'approved' ? (
                    <div style={{ color: '#2f5926', fontWeight: 'bold' }}>
                      ✓ Đã được giáo viên xác nhận
                    </div>
                  ) : (
                    <div style={{ color: '#8d6313', fontStyle: 'italic' }}>
                      ⏳ Cần giáo viên kiểm tra và bấm duyệt
                    </div>
                  )}
                </div>
              </div>

              {/* Tệp đính kèm & Ảnh/PDF */}
              {current.attachments?.length > 0 && (
                <div className="card" style={{ padding: '16px' }}>
                  <h4>Tệp bài làm gốc ({current.attachments.length} tệp)</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {current.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#f2f5ee',
                          padding: '6px 12px',
                          borderRadius: '6px',
                        }}
                      >
                        <span>📄</span>
                        <a
                          href={getFileUrl(att.filePath, att.sampleUrl)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2b5120', textDecoration: 'underline', fontWeight: '500' }}
                        >
                          {att.name}
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Image preview nếu là ảnh */}
                  {current.attachments[0] &&
                    (current.attachments[0].type?.includes('image') ||
                      current.attachments[0].name?.match(/\.(png|jpe?g)$/i)) && (
                      <div style={{ marginTop: '14px', textAlign: 'center', background: '#fafbfa', padding: '10px', borderRadius: '8px', border: '1px solid #e3e8dc' }}>
                        <img
                          src={getFileUrl(current.attachments[0].filePath, current.attachments[0].sampleUrl)}
                          alt="Bài làm gốc"
                          style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                </div>
              )}

              {/* Nội dung bài văn đã trích xuất */}
              <div className="card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4>Nội dung bài làm của học sinh</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#7a8670' }}>Văn bản nhận dạng OCR</span>
                    {!isEditingText ? (
                      <button
                        className="btn compact outline"
                        style={{ fontSize: '12px', padding: '3px 9px' }}
                        onClick={() => {
                          setEditedText(current.text || '');
                          setIsEditingText(true);
                        }}
                      >
                        ✏️ Sửa văn bản bài làm
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn compact primary"
                          style={{ fontSize: '12px', padding: '3px 9px' }}
                          onClick={handleGradeAI}
                          disabled={gradingAI}
                        >
                          ⚡ AI Chấm bài này
                        </button>
                        <button
                          className="btn compact"
                          style={{ fontSize: '12px', padding: '3px 9px' }}
                          onClick={() => setIsEditingText(false)}
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditingText ? (
                  <div>
                    <textarea
                      rows={6}
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      placeholder="Nhập hoặc dán nội dung bài văn của học sinh vào đây..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #7ea86f',
                        fontFamily: 'serif',
                        fontSize: '15px',
                        lineHeight: '1.6',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>
                      💡 Thầy cô có thể chỉnh sửa lỗi OCR rồi bấm <b>"⚡ AI Chấm bài này"</b> để AI phân tích lại điểm số và nhận xét.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#fbfcfa',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e7dc',
                      fontFamily: 'serif',
                      fontSize: '16px',
                      lineHeight: '1.8',
                      color: '#2a3525',
                    }}
                  >
                    {current.text || (
                      <div style={{ color: '#888', fontStyle: 'italic' }}>
                        Chưa có nội dung bài làm. Bấm nút <b>"⚡ Chấm bài bằng AI"</b> ở góc trên hoặc <b>"✏️ Sửa văn bản bài làm"</b> để AI tiến hành đọc và chấm điểm.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4 Tiêu chí đánh giá */}
              <div className="card" style={{ padding: '18px' }}>
                <h4>Điểm theo 4 tiêu chí đánh giá</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                  {rubric.map((r, i) => {
                    const score = currentScores[i] ?? '—';
                    const exp = current.explain?.[i] || '';
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid #e2e7dc',
                          background: '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <strong>{r.name}</strong>
                          <b style={{ color: '#2b5120', fontSize: '16px' }}>
                            {score} / {r.max} điểm
                          </b>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#606c59' }}>
                          <b>Giải thích:</b> {exp || r.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gợi ý sửa lỗi chính tả / diễn đạt */}
              {current.errors?.length > 0 && (
                <div className="card" style={{ padding: '18px' }}>
                  <h4>Lỗi và gợi ý chữa ({current.errors.length} điểm cần lưu ý)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    {current.errors.map((err, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px',
                          borderRadius: '6px',
                          background: '#fffdf6',
                          border: '1px solid #fae8b8',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="badge" style={{ background: '#f5deb3', color: '#7a4b08' }}>
                            {err[0]}
                          </span>
                          <span style={{ textDecoration: 'line-through', color: '#ba3c3c' }}>
                            "{err[1]}"
                          </span>
                          <span>→</span>
                          <span style={{ fontWeight: 'bold', color: '#2d6325' }}>
                            "{err[2]}"
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#68593c' }}>{err[3]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nhận xét của giáo viên */}
              <div className="card" style={{ padding: '18px' }}>
                <h4>Lời nhận xét &amp; Động viên</h4>
                <div
                  style={{
                    background: '#f3f7ef',
                    padding: '14px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #3d6333',
                    marginTop: '10px',
                    fontSize: '15px',
                    lineHeight: '1.6',
                  }}
                >
                  {current.teacherFeedback || current.feedback || 'Chưa có lời nhận xét.'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Profiles */}
          {activeTab === 'profile' && (
            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '18px' }}>
                <h4>Hồ sơ năng lực học tập</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
                  <div style={{ background: '#f5faf2', padding: '14px', borderRadius: '8px', border: '1px solid #d4e6cd' }}>
                    <h5 style={{ color: '#2d6325', marginBottom: '6px' }}>✓ Điểm mạnh &amp; Nét riêng</h5>
                    <p>{current.strength || 'Chưa ghi nhận'}</p>
                    {current.evidence && (
                      <div style={{ fontSize: '13px', color: '#556850', marginTop: '8px' }}>
                        <b>Dẫn chứng trong bài:</b> {current.evidence}
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#fff9f0', padding: '14px', borderRadius: '8px', border: '1px solid #f2dfc2' }}>
                    <h5 style={{ color: '#8a5c1b', marginBottom: '6px' }}>▲ Nội dung cần hỗ trợ</h5>
                    <p>{current.support || 'Chưa ghi nhận'}</p>
                  </div>
                </div>

                <div style={{ marginTop: '16px', background: '#f4f6fa', padding: '14px', borderRadius: '8px', border: '1px solid #d9e1ee' }}>
                  <h5 style={{ color: '#2a4c82', marginBottom: '6px' }}>➔ Hoạt động rèn luyện tiếp theo</h5>
                  <p>{current.activity || 'Tiếp tục luyện tập viết đoạn văn theo chủ đề'}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Audit Logs */}
          {activeTab === 'logs' && (
            <div className="tab-content">
              <div className="card" style={{ padding: '18px' }}>
                <h4>Lịch sử chỉnh sửa &amp; Phê duyệt</h4>
                <div style={{ marginTop: '12px' }}>
                  {(!current.logs || current.logs.length === 0) ? (
                    <div style={{ color: '#7a8670', fontStyle: 'italic', padding: '10px' }}>
                      Chưa có lịch sử chỉnh sửa nào được ghi nhận.
                    </div>
                  ) : (
                    current.logs.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: '1px solid #eef2ea',
                        }}
                      >
                        <div>
                          <strong>{log.action === 'approved' ? '☑ Giáo viên đã duyệt kết quả' : '✎ Chỉnh sửa điểm'}</strong>
                          <div style={{ fontSize: '13px', color: '#687560' }}>
                            {log.reason || 'Không ghi chú'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#7a8670' }}>
                          {log.at ? new Date(log.at).toLocaleString('vi-VN') : 'Vừa xong'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
