import React, { useState, useEffect, useRef } from 'react';
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
  const [activeTab, setActiveTab] = useState('review');
  const [gradingAI, setGradingAI] = useState(false);
  const [uploadingDirect, setUploadingDirect] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState('');
  // Index bài nộp đang xem của học sinh hiện tại (0 = bài đầu tiên)
  const [activeSubIdx, setActiveSubIdx] = useState(0);

  const fileInputRef = useRef(null);

  const current = students.find((s) => s.id === selectedId) || students[0];

  // Khi đổi học sinh → reset về bài mới nhất
  useEffect(() => {
    if (current) {
      const subs = current.allSubmissions || [];
      setActiveSubIdx(subs.length > 0 ? subs.length - 1 : 0);
      setEditedText('');
      setIsEditingText(false);
    }
  }, [current?.id]);

  // Bài nộp đang được xem
  const allSubs = current?.allSubmissions || [];
  // Nếu có allSubmissions dùng nó, nếu không fallback về dữ liệu student
  const activeSub = allSubs.length > 0 ? allSubs[activeSubIdx] || allSubs[allSubs.length - 1] : null;

  // Dữ liệu hiển thị: ưu tiên activeSub (bài được chọn), fallback sang student gốc
  const displayData = activeSub || {
    state: current?.state || 'new',
    text: current?.text || '',
    scores: current?.scores || [],
    teacherScores: current?.teacherScores || null,
    explain: current?.explain || [],
    errors: current?.errors || [],
    strength: current?.strength || '',
    evidence: current?.evidence || '',
    support: current?.support || '',
    activity: current?.activity || '',
    feedback: current?.feedback || '',
    teacherFeedback: current?.teacherFeedback || '',
    attachments: current?.attachments || [],
    logs: current?.logs || [],
  };

  // Nạp bài ảnh trực tiếp cho học sinh hiện tại từ bất kỳ tệp nào
  const handleDirectUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !current || !currentClassId) return;

    setUploadingDirect(true);
    showToast?.('⏳ Đang nạp tệp lên và AI đang đọc chữ, phân tích & chấm điểm...');
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await api.uploadStudentSubmission(currentClassId, current.id, formData);
      if (res.success) {
        showToast?.(res.message || '✓ Đã tải bài lên và AI đã hoàn tất chấm điểm!');
        if (onRefreshClass) {
          await onRefreshClass(currentClassId);
        }
      } else {
        showToast?.(res.message || 'Lỗi khi tải tệp');
      }
    } catch (err) {
      showToast?.('Lỗi tải tệp: ' + err.message);
    } finally {
      setUploadingDirect(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGradeAI = async () => {
    if (!current || !currentClassId) return;
    setGradingAI(true);
    try {
      const textToSend = isEditingText ? editedText : (displayData.text || undefined);
      const submissionIdToSend = activeSub?._id;

      const res = await api.gradeWithAI(currentClassId, current.id, textToSend, submissionIdToSend);
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

  const currentScores = displayData.teacherScores || displayData.scores || [];
  const currentTotal = total(currentScores);

  return (
    <div className="layout grading-layout">
      {/* Ẩn input file để nạp bài trực tiếp từ máy tính */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        accept="image/png,image/jpeg,application/pdf"
        onChange={handleDirectUpload}
      />

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
            const subs = s.allSubmissions || [];
            const hasScores = (s.teacherScores || s.scores)?.length > 0;
            const scoreSum = hasScores ? total(s.teacherScores || s.scores) : null;
            const hasAttachments = s.attachments?.length > 0 || subs.some((sb) => sb.attachments?.length > 0);
            const subCount = subs.length;
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
                    {subCount > 1 && (
                      <span style={{ fontSize: '11px', color: '#2d5a22', background: '#eaf4e6', padding: '1px 7px', borderRadius: '10px', fontWeight: 'bold' }}>
                        {subCount} bài
                      </span>
                    )}
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
                        displayData.state === 'approved'
                          ? 'approved'
                          : displayData.state === 'suggested' || (displayData.teacherScores || displayData.scores)?.length > 0
                          ? 'suggested'
                          : displayData.attachments?.length > 0
                          ? 'waiting'
                          : 'new'
                      }`}
                      style={{ marginLeft: '6px' }}
                    >
                      {displayData.state === 'approved'
                        ? 'Đã duyệt'
                        : displayData.state === 'suggested' || (displayData.teacherScores || displayData.scores)?.length > 0
                        ? 'Chờ GV duyệt'
                        : displayData.attachments?.length > 0
                        ? 'Chờ AI chấm'
                        : 'Chưa có bài'}
                    </span>
                  </span>
                  <span>•</span>
                  <span>Tổng số bài đã nộp: <b>{allSubs.length || (displayData.attachments?.length ? 1 : 0)} bài</b></span>
                </div>
              </div>
            </div>

            <div className="detail-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Nút nạp ảnh bài làm trực tiếp cho học sinh này */}
              <button
                className="btn secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingDirect}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#e8f4e5',
                  color: '#24561c',
                  border: '1px solid #a8d49a',
                  fontWeight: '600',
                }}
                title="Tải ảnh bài làm (chụp từ điện thoại/máy ảnh/PDF) cho học sinh này từ bất kỳ thư mục nào"
              >
                <span>{uploadingDirect ? '⏳' : '📤'}</span>
                <span>{uploadingDirect ? 'Đang nạp & chấm...' : 'Nạp bài ảnh mới'}</span>
              </button>

              {/* Nút kích hoạt chấm AI */}
              <button
                className="btn secondary"
                onClick={handleGradeAI}
                disabled={gradingAI || uploadingDirect}
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
                    : (displayData.scores?.length > 0 ? 'AI Chấm lại' : 'Chấm bài bằng AI')}
                </span>
              </button>

              <button
                className="btn primary"
                onClick={() => onOpenEditModal({ ...current, ...displayData, submissionId: activeSub?._id })}
              >
                <span>✎</span> Chỉnh sửa & Duyệt bài
              </button>
              <button className="btn outline" onClick={onExportCSV}>
                Xuất CSV
              </button>
            </div>
          </div>

          {/* Thanh chuyển đổi giữa các bài nộp (nếu học sinh có nhiều bài) */}
          {allSubs.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 14px',
              background: '#f8faf6',
              borderRadius: '8px',
              border: '1px solid #e1e9dc',
              overflowX: 'auto',
              marginBottom: '12px',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: '#4a5b44', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                📋 Các lần nộp ({allSubs.length} bài):
              </span>
              {allSubs.map((sb, idx) => {
                const sbTotal = total(sb.teacherScores || sb.scores);
                const hasScore = (sb.teacherScores || sb.scores)?.length > 0;
                const isSelected = activeSubIdx === idx;
                return (
                  <button
                    key={sb._id || idx}
                    onClick={() => { setActiveSubIdx(idx); setIsEditingText(false); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: `2px solid ${isSelected ? '#3d6333' : '#c8d6c0'}`,
                      background: isSelected ? '#3d6333' : '#fff',
                      color: isSelected ? '#fff' : '#2b5120',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>{sb.submissionLabel || `Bài ${idx + 1}`}</span>
                    {hasScore && (
                      <span style={{
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#eef5ec',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '11px',
                      }}>
                        {fmt(sbTotal)}/10
                      </span>
                    )}
                    {sb.state === 'approved' && <span>✓ Đã duyệt</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              Bài làm & Chấm chữa
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
              Nhật ký duyệt ({displayData.logs?.length || 0})
            </button>
          </div>

          {/* TAB 1: Review */}
          {activeTab === 'review' && (
            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Score summary banner */}
              <div
                style={{
                  background: displayData.state === 'approved' ? '#ebf4e6' : '#fff9ea',
                  border: `1px solid ${displayData.state === 'approved' ? '#bcd4af' : '#ebd49d'}`,
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#55634e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {displayData.teacherScores ? 'Điểm chính thức (Giáo viên duyệt)' : 'Điểm đề xuất từ AI'}
                    {activeSub?.submissionLabel && ` · ${activeSub.submissionLabel}`}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#273822' }}>
                    {currentScores.length ? fmt(currentTotal) : '—'}
                    <span style={{ fontSize: '16px', color: '#7a8670' }}> / 10 điểm</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {displayData.state === 'approved' ? (
                    <div style={{ color: '#2f5926', fontWeight: 'bold' }}>
                      ✓ Đã được giáo viên xác nhận
                    </div>
                  ) : currentScores.length > 0 ? (
                    <div style={{ color: '#8d6313', fontStyle: 'italic' }}>
                      ⏳ Cần giáo viên kiểm tra và bấm duyệt
                    </div>
                  ) : (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                      📭 Chưa có bài làm hoặc chưa có điểm
                    </div>
                  )}
                </div>
              </div>

              {/* Tệp đính kèm & Ảnh/PDF */}
              {displayData.attachments?.length > 0 ? (
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>Tệp bài làm gốc ({displayData.attachments.length} tệp)</h4>
                    <button
                      className="btn compact outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingDirect}
                      style={{ fontSize: '12px' }}
                    >
                      + Nạp thêm bài mới cho em này
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {displayData.attachments.map((att, idx) => (
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
                  {displayData.attachments[0] &&
                    (displayData.attachments[0].type?.includes('image') ||
                      displayData.attachments[0].name?.match(/\.(png|jpe?g)$/i)) && (
                      <div style={{ marginTop: '14px', textAlign: 'center', background: '#fafbfa', padding: '10px', borderRadius: '8px', border: '1px solid #e3e8dc' }}>
                        <img
                          src={getFileUrl(displayData.attachments[0].filePath, displayData.attachments[0].sampleUrl)}
                          alt="Bài làm gốc"
                          style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                </div>
              ) : (
                /* Card tải ảnh trực tiếp khi học sinh chưa có bài */
                <div
                  className="card"
                  style={{
                    padding: '28px 20px',
                    textAlign: 'center',
                    border: '2px dashed #b5c7aa',
                    background: '#fafbfa',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📷</div>
                  <strong style={{ fontSize: '16px' }}>Học sinh này chưa có tệp bài làm gốc</strong>
                  <p style={{ margin: '8px auto 14px auto', maxWidth: '500px', fontSize: '13px', color: '#687560' }}>
                    Bấm vào đây để tải ảnh chụp bài làm (PNG, JPG, PDF) từ máy tính của bạn. AI sẽ tự động đọc chữ bằng OCR và đề xuất điểm ngay lập tức.
                  </p>
                  <button
                    className="btn primary"
                    disabled={uploadingDirect}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    {uploadingDirect ? '⏳ Đang nạp tệp...' : '📤 Tải ảnh bài làm lên ngay'}
                  </button>
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
                          setEditedText(displayData.text || '');
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
                    {displayData.text ? (
                      displayData.text
                    ) : (
                      <div style={{ color: '#888', fontStyle: 'italic' }}>
                        Chưa có nội dung bài làm. Bấm nút <b>"📤 Nạp bài ảnh mới"</b> ở trên hoặc <b>"✏️ Sửa văn bản bài làm"</b> để AI tiến hành đọc và chấm điểm.
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
                    const exp = displayData.explain?.[i] || '';
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
              {displayData.errors?.length > 0 && (
                <div className="card" style={{ padding: '18px' }}>
                  <h4>Lỗi và gợi ý chữa ({displayData.errors.length} điểm cần lưu ý)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    {displayData.errors.map((err, i) => (
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

              {/* Nhận xét */}
              <div className="card" style={{ padding: '18px' }}>
                <h4>Lời nhận xét & Động viên</h4>
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
                  {displayData.teacherFeedback || displayData.feedback || 'Chưa có lời nhận xét.'}
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
                    <h5 style={{ color: '#2d6325', marginBottom: '6px' }}>✓ Điểm mạnh & Nét riêng</h5>
                    <p>{displayData.strength || 'Chưa ghi nhận'}</p>
                    {displayData.evidence && (
                      <div style={{ fontSize: '13px', color: '#556850', marginTop: '8px' }}>
                        <b>Dẫn chứng trong bài:</b> {displayData.evidence}
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#fff9f0', padding: '14px', borderRadius: '8px', border: '1px solid #f2dfc2' }}>
                    <h5 style={{ color: '#8a5c1b', marginBottom: '6px' }}>▲ Nội dung cần hỗ trợ</h5>
                    <p>{displayData.support || 'Chưa ghi nhận'}</p>
                  </div>
                </div>

                <div style={{ marginTop: '16px', background: '#f4f6fa', padding: '14px', borderRadius: '8px', border: '1px solid #d9e1ee' }}>
                  <h5 style={{ color: '#2a4c82', marginBottom: '6px' }}>➔ Hoạt động rèn luyện tiếp theo</h5>
                  <p>{displayData.activity || 'Tiếp tục luyện tập viết đoạn văn theo chủ đề'}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Audit Logs */}
          {activeTab === 'logs' && (
            <div className="tab-content">
              <div className="card" style={{ padding: '18px' }}>
                <h4>Lịch sử chỉnh sửa & Phê duyệt</h4>
                <div style={{ marginTop: '12px' }}>
                  {(!displayData.logs || displayData.logs.length === 0) ? (
                    <div style={{ color: '#7a8670', fontStyle: 'italic', padding: '10px' }}>
                      Chưa có lịch sử chỉnh sửa nào được ghi nhận.
                    </div>
                  ) : (
                    displayData.logs.map((log, idx) => (
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
                          <strong>{log.action === 'approved' ? '☑ Giáo viên đã duyệt kết quả' : log.action === 'ocr_failed' ? '⚠ OCR không đọc được' : '✎ Chỉnh sửa điểm'}</strong>
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
