import React, { useState, useEffect, useRef } from 'react';
import { getFileUrl, api } from '../api';
import ImageEditorModal from './ImageEditorModal';
import { compressImageFile } from '../utils/imageOptimizer';
import { getRubric, rubricMaxTotal } from '../utils/rubric';

const total = (a) => (a || []).reduce((s, n) => s + Number(n), 0);
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function GradingPage({
  students,
  classRubric,
  selectedId,
  onSelectStudent,
  onOpenEditModal,
  onExportXLSX,
  currentClassId,
  onRefreshClass,
  showToast,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('review');
  const [gradingAI, setGradingAI] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [uploadingDirect, setUploadingDirect] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState('');
  // Index bài nộp đang xem của học sinh hiện tại (0 = bài đầu tiên)
  const [activeSubIdx, setActiveSubIdx] = useState(0);
  // Quản lý xem trang ảnh bài làm (khi có nhiều ảnh / đa trang)
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [viewAllImages, setViewAllImages] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  // Quản lý Modal Popup xác nhận xóa bài nộp (thay thế window.confirm localhost)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subToDelete, setSubToDelete] = useState(null);
  const [deletingSub, setDeletingSub] = useState(false);

  // Quản lý Modal Popup xác nhận xóa từng ảnh trong bài nộp
  const [showDeleteAttModal, setShowDeleteAttModal] = useState(false);
  const [attToDelete, setAttToDelete] = useState(null);
  const [deletingAtt, setDeletingAtt] = useState(false);

  // Phân biệt chế độ upload: 'new' (Tải bài mới) hoặc 'append' (Thêm ảnh vào bài này)
  const [uploadMode, setUploadMode] = useState('new');
  const addMoreFilesInputRef = useRef(null);

  // Quản lý Modal Popup xác nhận AI chấm cả lớp
  const [showGradeAllModal, setShowGradeAllModal] = useState(false);

  // Quản lý Trình cắt ảnh & Xoay ảnh 360 độ trước khi nạp
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [filesToEdit, setFilesToEdit] = useState([]);

  const fileInputRef = useRef(null);
  const pillsContainerRef = useRef(null);
  const isDraggingPillsRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  const cleanPedagogicalText = (txt, fallback = '') => {
    if (!txt || typeof txt !== 'string') return fallback;
    if (/gián đoạn|PERMISSION_DENIED|credit|quota|Billing|Sự cố AI/i.test(txt)) {
      return fallback || 'Ảnh bài làm đã được lưu trữ an toàn. Cô giáo có thể bấm "✎ Chỉnh sửa & Duyệt bài" để kiểm tra và cho điểm.';
    }
    return txt;
  };

  const handleMouseDownPills = (e) => {
    if (!pillsContainerRef.current) return;
    isDraggingPillsRef.current = true;
    dragStartXRef.current = e.pageX - pillsContainerRef.current.offsetLeft;
    dragScrollLeftRef.current = pillsContainerRef.current.scrollLeft;
  };

  const handleMouseMovePills = (e) => {
    if (!isDraggingPillsRef.current || !pillsContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - pillsContainerRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    pillsContainerRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeavePills = () => {
    isDraggingPillsRef.current = false;
  };

  const handleWheelPills = (e) => {
    if (pillsContainerRef.current) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        pillsContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const current = students.find((s) => s.id === selectedId) || students[0];

  // Khi đổi học sinh → reset về bài mới nhất và trang ảnh đầu tiên
  useEffect(() => {
    if (current) {
      const subs = current.allSubmissions || [];
      setActiveSubIdx(subs.length > 0 ? subs.length - 1 : 0);
      setActiveImageIdx(0);
      setViewAllImages(false);
      setEditedText('');
      setIsEditingText(false);
      // Giữ trang ở đầu khi chuyển học sinh, không bị cuộn xuống
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [current?.id]);

  // Khi đổi bài nộp → reset trang ảnh về đầu và chỉ cuộn ngang trong container thanh bài nộp
  // (TUYỆT ĐỐI không gọi scrollIntoView làm trôi cả trang web màn hình)
  useEffect(() => {
    setActiveImageIdx(0);
    if (pillsContainerRef.current) {
      const buttons = pillsContainerRef.current.querySelectorAll('button');
      const targetBtn = buttons[activeSubIdx];
      if (targetBtn) {
        const container = pillsContainerRef.current;
        const btnLeft = targetBtn.offsetLeft;
        const btnWidth = targetBtn.offsetWidth;
        const containerWidth = container.offsetWidth;
        container.scrollTo({
          left: btnLeft - containerWidth / 2 + btnWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeSubIdx]);

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

  // Nạp bài ảnh trực tiếp cho học sinh hiện tại từ bất kỳ tệp nào (mode: 'new' | 'append')
  const handleDirectUpload = (e, mode = 'new') => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !current || !currentClassId) return;

    setUploadMode(mode);

    // Kiểm tra nếu có tệp hình ảnh -> Mở Modal Cắt & Xoay 360 độ để giáo viên chỉnh sửa trước khi nạp
    const hasImage = files.some((f) => f.type.startsWith('image/'));
    if (hasImage) {
      setFilesToEdit(files);
      setShowImageEditor(true);
      return;
    }

    // Nếu chỉ là PDF -> Nạp trực tiếp
    executeUploadFiles(files, mode);
  };

  // Thực hiện gửi các tệp (đã cắt/xoay) lên máy chủ
  const executeUploadFiles = async (filesToUpload, explicitMode) => {
    if (!filesToUpload || !filesToUpload.length || !current || !currentClassId) return;
    const mode = explicitMode || uploadMode;

    setUploadingDirect(true);
    showToast?.(mode === 'append' ? '⏳ Đang tối ưu và tải thêm ảnh...' : '⏳ Đang tối ưu và tải bài làm lên...');
    try {
      const optimizedFiles = await Promise.all(
        filesToUpload.map((f) => compressImageFile(f))
      );

      const formData = new FormData();
      optimizedFiles.forEach((f) => formData.append('files', f));

      let res;
      if (mode === 'append' && activeSub?._id) {
        res = await api.addAttachments(currentClassId, current.id, activeSub._id, formData);
      } else {
        res = await api.uploadStudentSubmission(currentClassId, current.id, formData);
      }

      if (res.success) {
        showToast?.(res.message || '✓ Đã tải ảnh lên thành công. Thầy cô bấm "⚡ Chấm bài bằng AI" để bắt đầu chấm điểm!');
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
      setShowImageEditor(false);
      setFilesToEdit([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (addMoreFilesInputRef.current) addMoreFilesInputRef.current.value = '';
    }
  };

  const handleGradeAI = async () => {
    if (!current || !currentClassId) return;

    if (displayData.state === 'approved') {
      showToast?.('Bài làm này đã được giáo viên duyệt, không thể chấm lại bằng AI.');
      return;
    }

    // Kiểm tra xem bài hiện tại có ảnh hoặc văn bản chưa
    const hasContent = (displayData.attachments && displayData.attachments.length > 0) || Boolean(displayData.text?.trim()) || Boolean(editedText?.trim());
    if (!hasContent) {
      showToast?.(`⚠️ Em ${current.name} (${current.id}) chưa có ảnh bài làm. Thầy cô vui lòng tải ảnh vào trước khi bấm chấm AI.`);
      return;
    }

    setGradingAI(true);
    showToast?.(`⏳ AI đang đọc bài làm viết tay của em ${current.name} (${current.id}) và chấm điểm...`);
    try {
      const textToSend = isEditingText ? editedText : (displayData.text || undefined);
      const submissionIdToSend = activeSub?._id;

      // forceReOcr = true để AI đọc lại toàn bộ ảnh hiện có và chấm DUY NHẤT bài này của học sinh này
      const res = await api.gradeWithAI(currentClassId, current.id, textToSend, submissionIdToSend, true);
      if (res.success) {
        showToast?.(res.message || `✓ AI đã chấm và đề xuất điểm bài làm của em ${current.name} thành công!`);
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

  const handleSaveEditedText = async () => {
    if (!current || !currentClassId) return;
    setSavingText(true);
    try {
      const res = await api.reviewSubmission(currentClassId, current.id, {
        submissionId: activeSub?._id,
        text: editedText,
        reason: 'Giáo viên chỉnh sửa văn bản bài làm',
      });
      if (res.success) {
        showToast?.('✓ Đã cập nhật văn bản bài làm!');
        setIsEditingText(false);
        if (onRefreshClass) await onRefreshClass(currentClassId);
      } else {
        showToast?.(res.message || 'Lỗi khi lưu văn bản bài làm');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setSavingText(false);
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!current || !currentClassId || !activeSub?._id || !attToDelete) return;
    setDeletingAtt(true);
    try {
      showToast?.('⏳ Đang xóa ảnh...');
      const res = await api.deleteAttachment(
        currentClassId,
        current.id,
        activeSub._id,
        attToDelete.key,
        attToDelete.filePath
      );
      if (res.success) {
        showToast?.(res.message || '✓ Đã xóa ảnh khỏi bài làm thành công!');
        setShowDeleteAttModal(false);
        setAttToDelete(null);
        if (activeImageIdx > 0) {
          setActiveImageIdx((prev) => prev - 1);
        }
        if (onRefreshClass) {
          await onRefreshClass(currentClassId);
        }
      } else {
        showToast?.(res.message || 'Chưa thể xóa ảnh');
      }
    } catch (err) {
      showToast?.('Lỗi xóa ảnh: ' + err.message);
    } finally {
      setDeletingAtt(false);
    }
  };

  const handleReOcrWithAI = async () => {
    if (!current || !currentClassId) return;
    setGradingAI(true);
    showToast?.('⏳ AI đang quét và đọc lại toàn bộ ảnh bài làm...');
    try {
      const submissionIdToSend = activeSub?._id;
      const res = await api.gradeWithAI(currentClassId, current.id, undefined, submissionIdToSend, true);
      if (res.success) {
        showToast?.(res.message || '✓ AI đã đọc lại toàn bộ bài làm và cập nhật điểm!');
        setIsEditingText(false);
        if (onRefreshClass) await onRefreshClass(currentClassId);
      } else {
        showToast?.(res.message || 'Lỗi khi yêu cầu AI đọc lại ảnh');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setGradingAI(false);
    }
  };

  const handleRetrySubmission = async () => {
    if (!current || !currentClassId) return;
    setGradingAI(true);
    showToast?.('⏳ Đang thử lại đọc và chấm bài bằng AI Vision...');
    try {
      const submissionIdToSend = activeSub?._id;
      const res = await api.retrySubmission(currentClassId, current.id, submissionIdToSend);
      if (res.success) {
        showToast?.(res.message || '✓ Thử lại thành công! AI đã chấm bài.');
        if (onRefreshClass) await onRefreshClass(currentClassId);
      } else {
        showToast?.(res.message || 'Thử lại chưa thành công.');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setGradingAI(false);
    }
  };

  const handleDeleteSubmission = () => {
    if (!current || !currentClassId) return;
    const currentSub = activeSub || displayData;
    const subId = currentSub?._id || currentSub?.submissionId;

    if (!subId) {
      showToast?.('Không tìm thấy mã bài nộp để xóa');
      return;
    }

    setSubToDelete(currentSub);
    setShowDeleteModal(true);
  };

  const confirmDeleteSubmission = async () => {
    if (!current || !currentClassId || !subToDelete) return;
    const subId = subToDelete._id || subToDelete.submissionId;
    if (!subId) return;

    setDeletingSub(true);
    try {
      showToast?.('⏳ Đang xóa bài nộp...');
      const res = await api.deleteSubmission(currentClassId, current.id, subId);
      if (res.success) {
        showToast?.(res.message || '✓ Đã xóa bài nộp thành công!');
        setShowDeleteModal(false);
        setSubToDelete(null);
        if (activeSubIdx > 0) {
          setActiveSubIdx((prev) => prev - 1);
        }
        if (onRefreshClass) {
          await onRefreshClass(currentClassId);
        }
      } else {
        showToast?.(res.message || 'Chưa thể xóa bài nộp');
      }
    } catch (err) {
      showToast?.('Lỗi khi xóa bài nộp: ' + err.message);
    } finally {
      setDeletingSub(false);
    }
  };

  const handleGradeAllAI = () => {
    if (!currentClassId) return;
    setShowGradeAllModal(true);
  };

  const confirmGradeAllAI = async () => {
    setShowGradeAllModal(false);
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
  // Bộ tiêu chí của bài đang xem (bài đã chấm giữ tiêu chí lúc chấm; bài mới dùng tiêu chí lớp)
  const rubric = getRubric(displayData.rubric || current?.rubric || classRubric);
  const rubricTotal = rubricMaxTotal(rubric);

  return (
    <div className="layout grading-layout">
      {/* Ẩn input file để Tải bài mới (tạo lần nộp mới) */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        accept="image/png,image/jpeg,application/pdf"
        onChange={(e) => handleDirectUpload(e, 'new')}
      />

      {/* Ẩn input file để Thêm ảnh bổ sung vào bài đang xem (khi thiếu ảnh) */}
      <input
        type="file"
        ref={addMoreFilesInputRef}
        style={{ display: 'none' }}
        multiple
        accept="image/png,image/jpeg"
        onChange={(e) => handleDirectUpload(e, 'append')}
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
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Details of Selected Student */}
      {current && (
        <div className="detail" style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>
          {/* Header of Detail */}
          <div
            className="detail-head card"
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              minWidth: 0,
              gap: '14px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
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
                        ? 'Chờ GV chấm'
                        : 'Chưa có bài'}
                    </span>
                  </span>
                  <span>•</span>
                  <span>Tổng số bài đã nộp: <b>{allSubs.length || (displayData.attachments?.length ? 1 : 0)} bài</b></span>
                </div>
              </div>
            </div>

            <div className="detail-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Nút tải bài mới (thay thế nút nạp bài ảnh mới theo yêu cầu) */}
              <button
                className="btn secondary"
                onClick={() => {
                  setUploadMode('new');
                  fileInputRef.current?.click();
                }}
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
                title="Tải ảnh bài làm mới (chụp từ điện thoại/máy ảnh/PDF) cho học sinh này"
              >
                <span>{uploadingDirect && uploadMode === 'new' ? 'Đang tải bài...' : 'Tải bài mới'}</span>
              </button>

              {/* Nút kích hoạt chấm AI - Chỉ hiển thị khi bài chưa được giáo viên duyệt */}
              {displayData.state !== 'approved' && (
                <button
                  className="btn secondary"
                  onClick={handleGradeAI}
                  disabled={gradingAI || uploadingDirect}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#2d6325',
                    color: '#ffffff',
                    border: '1px solid #20481a',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(45,99,37,0.25)',
                  }}
                  title="Kích hoạt AI đọc toàn bộ ảnh bài làm và chấm điểm theo 4 tiêu chí"
                >
                  <span>
                    {gradingAI
                      ? 'AI đang chấm bài...'
                      : (displayData.scores?.length > 0 ? 'AI Chấm lại' : 'Chấm bài bằng AI')}
                  </span>
                </button>
              )}

              <button
                className="btn primary"
                onClick={() => onOpenEditModal({ ...current, ...displayData, submissionId: activeSub?._id })}
              >
                Chỉnh sửa & Duyệt bài
              </button>
              <button
                className="btn outline"
                onClick={onExportXLSX}
                title="Xuất bảng điểm các bài đã duyệt ra file Excel (.xlsx)"
              >
                Xuất XLSX
              </button>

              {/* Nút xóa bài nộp hiện tại */}
              {(activeSub?._id || displayData?.submissionId) && (
                <button
                  className="btn outline"
                  onClick={handleDeleteSubmission}
                  style={{
                    color: '#c53030',
                    borderColor: '#fca5a5',
                    background: '#fff8f8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Xóa vĩnh viễn bài nộp đang xem của học sinh"
                >
                  Xóa bài này
                </button>
              )}
            </div>
          </div>

          {/* Thanh chuyển đổi giữa các bài nộp (nếu học sinh có nhiều bài) */}
          {allSubs.length > 1 && (
            <div
              className="submissions-box"
              style={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                background: '#f9fbf7',
                borderRadius: '10px',
                border: '1.5px solid #d8e5d3',
                padding: '10px 14px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13.5px', color: '#274b1e', fontWeight: '700' }}>
                    Danh sách các lần nộp ({allSubs.length} bài làm):
                  </span>
                  <span
                    style={{
                      fontSize: '11.5px',
                      background: '#e3ece0',
                      color: '#2a5320',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}
                  >
                    Đang xem bài {activeSubIdx + 1}/{allSubs.length}
                  </span>
                </div>

                <span style={{ fontSize: '12px', color: '#5b6e57', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Kéo thanh cuộn ngang bên dưới để xem thêm các bài khác
                </span>
              </div>

              {/* Dải cuộn ngang (horizontal scrollbar) to, rõ ràng, dễ cuộn và kéo bằng chuột */}
              <div
                ref={pillsContainerRef}
                className="sub-pills-track"
                onMouseDown={handleMouseDownPills}
                onMouseMove={handleMouseMovePills}
                onMouseUp={handleMouseUpOrLeavePills}
                onMouseLeave={handleMouseUpOrLeavePills}
                onWheel={handleWheelPills}
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  paddingBottom: '10px',
                  paddingTop: '4px',
                  boxSizing: 'border-box',
                  cursor: 'grab',
                  userSelect: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {allSubs.map((sb, idx) => {
                  const isSelected = activeSubIdx === idx;
                  const labelText = sb.submissionLabel || `Bài nộp lần ${sb.submissionNumber || idx + 1}`;
                  return (
                    <button
                      key={sb._id || idx}
                      onClick={() => {
                        setActiveSubIdx(idx);
                        setIsEditingText(false);
                      }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '20px',
                        border: `1.5px solid ${isSelected ? '#35632a' : '#c3d3be'}`,
                        background: isSelected ? '#35632a' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#284e20',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: isSelected ? '0 2px 6px rgba(40,80,35,0.28)' : '0 1px 2px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Xem bài nộp lần ${sb.submissionNumber || idx + 1}`}
                    >
                      <span>{labelText}</span>
                      {sb.state === 'approved' && (
                        <span
                          style={{
                            background: isSelected ? 'rgba(255,255,255,0.25)' : '#eef5ec',
                            color: isSelected ? '#ffffff' : '#28664e',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
                    <span style={{ fontSize: '16px', color: '#7a8670' }}> / {fmt(rubricTotal)} điểm</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {displayData.state === 'approved' ? (
                    <div style={{ color: '#2f5926', fontWeight: 'bold', fontSize: '13px' }}>
                      Đã được giáo viên xác nhận
                    </div>
                  ) : currentScores.length > 0 ? (
                    <div style={{ color: '#8d6313', fontStyle: 'italic', fontSize: '13px' }}>
                      Cần giáo viên kiểm tra và bấm duyệt
                    </div>
                  ) : displayData.attachments?.length > 0 ? (
                    <div style={{ color: '#44643b', fontSize: '13px', fontWeight: '550' }}>
                      Đã có {displayData.attachments.length} ảnh bài làm • Bấm <b>"Chấm bài bằng AI"</b> ở trên để bắt đầu chấm
                    </div>
                  ) : (
                    <div style={{ color: '#888', fontStyle: 'italic', fontSize: '13px' }}>
                      Chưa có bài làm hoặc chưa có điểm
                    </div>
                  )}
                </div>
              </div>

              {/* Tệp đính kèm & Ảnh/PDF */}
              {displayData.attachments?.length > 0 ? (
                (() => {
                  const imageAttachments = displayData.attachments.filter(
                    (att) => att.type?.includes('image') || att.name?.match(/\.(png|jpe?g|webp)$/i)
                  );
                  const currentImage = imageAttachments[activeImageIdx] || imageAttachments[0];

                  return (
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <h4 style={{ margin: 0 }}>
                          Tệp bài làm gốc ({displayData.attachments.length} tệp{imageAttachments.length > 1 ? ` · ${imageAttachments.length} trang ảnh` : ''})
                        </h4>
                        {/* Nút thêm ảnh nếu thiếu trang */}
                        <button
                          className="btn compact outline"
                          onClick={() => {
                            setUploadMode('append');
                            addMoreFilesInputRef.current?.click();
                          }}
                          disabled={uploadingDirect}
                          style={{
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#2b5120',
                            borderColor: '#82b071',
                            fontWeight: '600',
                          }}
                          title="Tải thêm ảnh vào bài làm này nếu học sinh viết nhiều trang hoặc còn thiếu ảnh"
                        >
                          <span>{uploadingDirect && uploadMode === 'append' ? 'Đang thêm ảnh...' : '+ Thêm ảnh vào bài này'}</span>
                        </button>
                      </div>

                      {/* Danh sách các tệp đính kèm - Hiển thị gọn gàng, nút xóa rõ ràng */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {displayData.attachments.map((att, idx) => {
                          const isImg = att.type?.includes('image') || att.name?.match(/\.(png|jpe?g|webp)$/i);
                          const imgIdx = isImg ? imageAttachments.findIndex((img) => img.filePath === att.filePath && img.name === att.name) : -1;
                          const isSelectedImg = isImg && imgIdx === activeImageIdx && !viewAllImages;

                          // Tên hiển thị ngắn gọn, thân thiện (tránh tên hash quá dài làm vỡ khung)
                          const isCropped = att.name?.includes('_cropped');
                          const displayName = isImg && imgIdx >= 0
                            ? `Trang ảnh ${imgIdx + 1}${isCropped ? ' (Đã cắt/xoay)' : ''}`
                            : (att.name && att.name.length > 25
                                ? att.name.slice(0, 16) + '...' + att.name.slice(att.name.lastIndexOf('.'))
                                : (att.name || `Tệp ${idx + 1}`));

                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                if (isImg && imgIdx >= 0) {
                                  setActiveImageIdx(imgIdx);
                                  setViewAllImages(false);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: isSelectedImg ? '#dcebd2' : '#f2f5ee',
                                border: isSelectedImg ? '1.5px solid #6b9e59' : '1px solid #d4dfcd',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: isImg ? 'pointer' : 'default',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                transition: 'all 0.15s ease',
                              }}
                              title={att.name || ''}
                            >
                              <span style={{ fontWeight: '650', color: '#274b1e', fontSize: '13.5px' }}>
                                {displayName}
                              </span>

                              <a
                                href={getFileUrl(att.filePath, att.sampleUrl)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: '#346b28',
                                  textDecoration: 'underline',
                                  fontSize: '12px',
                                  marginLeft: '2px',
                                }}
                                title="Mở xem tệp gốc trên tab mới"
                              >
                                [Xem gốc]
                              </a>

                              {/* Nút xóa ảnh rõ ràng, nền đỏ viền đỏ, luôn hiển thị đầy đủ không bị tràn */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAttToDelete(att);
                                  setShowDeleteAttModal(true);
                                }}
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
                                  color: '#b91c1c',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  marginLeft: '6px',
                                  lineHeight: 1.2,
                                  flexShrink: 0,
                                }}
                                title={`Xóa tệp "${att.name}" khỏi bài làm`}
                              >
                                ✕ Xóa
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* KHU VỰC HIỂN THỊ ẢNH BÀI LÀM */}
                      {imageAttachments.length > 0 && (
                        <div style={{ marginTop: '14px', background: '#fafbfa', padding: '12px', borderRadius: '8px', border: '1px solid #e3e8dc' }}>
                          {/* Thanh điều hướng và công cụ thao tác ảnh */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #ebf0e6', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {imageAttachments.length > 1 && (
                                <>
                                  <button
                                    className="btn compact outline"
                                    style={{ fontSize: '12px', padding: '4px 10px' }}
                                    disabled={activeImageIdx <= 0 || viewAllImages}
                                    onClick={() => setActiveImageIdx((prev) => Math.max(0, prev - 1))}
                                  >
                                    ◀ Trang trước
                                  </button>
                                  <span style={{ fontWeight: '600', color: '#2b5120', fontSize: '13px' }}>
                                    {viewAllImages
                                      ? `Tất cả ${imageAttachments.length} trang`
                                      : `Trang ${activeImageIdx + 1} / ${imageAttachments.length}`}
                                  </span>
                                  <button
                                    className="btn compact outline"
                                    style={{ fontSize: '12px', padding: '4px 10px' }}
                                    disabled={activeImageIdx >= imageAttachments.length - 1 || viewAllImages}
                                    onClick={() => setActiveImageIdx((prev) => Math.min(imageAttachments.length - 1, prev + 1))}
                                  >
                                    Trang sau ▶
                                  </button>
                                </>
                              )}
                              {imageAttachments.length === 1 && (
                                <span style={{ fontWeight: '600', color: '#2b5120', fontSize: '13px' }}>
                                  Trang 1 / 1: {currentImage?.name}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {imageAttachments.length > 1 && (
                                <button
                                  className="btn compact"
                                  style={{ fontSize: '12px', padding: '4px 10px', background: viewAllImages ? '#2b5120' : '#eef2ea', color: viewAllImages ? '#fff' : '#2b5120' }}
                                  onClick={() => setViewAllImages(!viewAllImages)}
                                >
                                  {viewAllImages ? 'Xem từng trang' : 'Xem tất cả các trang'}
                                </button>
                              )}
                              {!viewAllImages && currentImage && (
                                <>
                                  <button
                                    className="btn compact outline"
                                    style={{ fontSize: '12px', padding: '4px 10px' }}
                                    onClick={() => setZoomImageUrl(getFileUrl(currentImage.filePath, currentImage.sampleUrl))}
                                  >
                                    Phóng to
                                  </button>
                                  <button
                                    className="btn compact outline"
                                    style={{
                                      fontSize: '12px',
                                      padding: '4px 10px',
                                      color: '#dc2626',
                                      borderColor: '#fca5a5',
                                      background: '#fff8f8',
                                      fontWeight: '600',
                                    }}
                                    onClick={() => {
                                      setAttToDelete(currentImage);
                                      setShowDeleteAttModal(true);
                                    }}
                                    title="Xóa trang ảnh này khỏi bài làm nếu thừa hoặc chụp nhầm"
                                  >
                                    Xóa ảnh này
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Chế độ 1: Xem tất cả các trang cuộn dọc */}
                          {viewAllImages ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {imageAttachments.map((img, i) => (
                                <div key={i} style={{ textAlign: 'center', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e0e5d8' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
                                    <span style={{ fontWeight: '600', fontSize: '13px', color: '#2b5120' }}>
                                      Trang {i + 1}: {img.name}
                                    </span>
                                    <button
                                      className="btn compact outline"
                                      style={{ fontSize: '11px', padding: '2px 8px' }}
                                      onClick={() => setZoomImageUrl(getFileUrl(img.filePath, img.sampleUrl))}
                                    >
                                      Phóng to trang này
                                    </button>
                                  </div>
                                  <img
                                    src={getFileUrl(img.filePath, img.sampleUrl)}
                                    alt={`Trang ${i + 1}`}
                                    style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: '4px', cursor: 'zoom-in' }}
                                    onClick={() => setZoomImageUrl(getFileUrl(img.filePath, img.sampleUrl))}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            /* Chế độ 2: Xem từng trang (kèm thumbnails bên dưới) */
                            <div>
                              {currentImage && (
                                <div style={{ textAlign: 'center' }}>
                                  <img
                                    src={getFileUrl(currentImage.filePath, currentImage.sampleUrl)}
                                    alt={`Bài làm - Trang ${activeImageIdx + 1}`}
                                    style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '4px', cursor: 'zoom-in' }}
                                    onClick={() => setZoomImageUrl(getFileUrl(currentImage.filePath, currentImage.sampleUrl))}
                                    title="Bấm vào để phóng to toàn màn hình"
                                  />
                                </div>
                              )}

                              {/* Dải thumbnail thu nhỏ nếu có nhiều trang */}
                              {imageAttachments.length > 1 && (
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', overflowX: 'auto', padding: '6px 0' }}>
                                  {imageAttachments.map((img, i) => {
                                    const isActive = i === activeImageIdx;
                                    return (
                                      <div
                                        key={i}
                                        onClick={() => setActiveImageIdx(i)}
                                        style={{
                                          border: isActive ? '2px solid #2b5120' : '2px solid #ccd5c5',
                                          borderRadius: '6px',
                                          padding: '2px',
                                          background: isActive ? '#e8f0e2' : '#fff',
                                          cursor: 'pointer',
                                          textAlign: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        <img
                                          src={getFileUrl(img.filePath, img.sampleUrl)}
                                          alt={`Thumbnail ${i + 1}`}
                                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                                        />
                                        <span style={{ fontSize: '11px', fontWeight: isActive ? '700' : '500', color: isActive ? '#2b5120' : '#666' }}>
                                          Trang {i + 1}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
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
                  <strong style={{ fontSize: '16.5px', display: 'block', color: '#273822' }}>Học sinh này chưa có tệp bài làm gốc</strong>
                  <p style={{ margin: '8px auto 14px auto', maxWidth: '520px', fontSize: '13.5px', color: '#687560' }}>
                    Bấm vào đây để tải ảnh chụp bài làm (PNG, JPG, PDF) từ máy tính. Sau khi tải ảnh, thầy cô có thể xem lại, thêm/xóa ảnh rồi bấm <b>"Chấm bài bằng AI"</b> để bắt đầu chấm.
                  </p>
                  <button
                    className="btn primary"
                    disabled={uploadingDirect}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadMode('new');
                      fileInputRef.current?.click();
                    }}
                  >
                    {uploadingDirect ? 'Đang nạp tệp...' : 'Tải ảnh bài làm lên'}
                  </button>
                </div>
              )}

              {/* Nội dung bài văn đã trích xuất */}
              <div className="card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4>Nội dung bài làm của học sinh</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        Sửa văn bản bài làm
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {displayData.state !== 'approved' ? (
                          <button
                            className="btn compact primary"
                            style={{ fontSize: '12px', padding: '3px 9px' }}
                            onClick={handleGradeAI}
                            disabled={gradingAI}
                          >
                            AI Chấm bài này
                          </button>
                        ) : (
                          <button
                            className="btn compact primary"
                            style={{ fontSize: '12px', padding: '3px 9px' }}
                            onClick={handleSaveEditedText}
                            disabled={savingText}
                          >
                            {savingText ? 'Đang lưu...' : 'Lưu văn bản'}
                          </button>
                        )}
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
                      rows={7}
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
                      {displayData.state !== 'approved' ? (
                        <>Thầy cô có thể chỉnh sửa lỗi OCR rồi bấm <b>"AI Chấm bài này"</b> để AI phân tích lại điểm số và nhận xét.</>
                      ) : (
                        <>Bài làm đã được giáo viên duyệt. Thầy cô có thể chỉnh sửa lỗi nhận dạng OCR rồi bấm <b>"Lưu văn bản"</b> để cập nhật nội dung.</>
                      )}
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
                      <div style={{ whiteSpace: 'pre-wrap' }}>{displayData.text}</div>
                    ) : (
                      <div style={{ padding: '12px 14px', background: '#fff9ea', border: '1px solid #f0dfa8', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 6px 0', color: '#8a6214', fontWeight: '600', fontSize: '14px' }}>
                          Bài làm chưa được chấm điểm
                        </p>
                        <p style={{ margin: '0', fontSize: '13px', color: '#6e541b', lineHeight: '1.6' }}>
                          • Thầy cô kiểm tra các trang ảnh ở trên (có thể thêm ảnh hoặc xóa ảnh nhầm).<br />
                          • Sau đó bấm nút <b>"Chấm bài bằng AI"</b> ở thanh công cụ phía trên để AI đọc toàn bộ ảnh và đề xuất điểm.<br />
                          • Hoặc bấm <b>"Sửa văn bản bài làm"</b> để nhập/sửa nội dung bằng tay.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tiêu chí đánh giá */}
              <div className="card" style={{ padding: '18px' }}>
                <h4>Điểm theo {rubric.length} tiêu chí đánh giá</h4>
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
                            {score} / {fmt(r.max)} điểm
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
                  {cleanPedagogicalText(displayData.teacherFeedback || displayData.feedback, 'Bài làm của học sinh đã được ghi nhận trên hệ thống.')}
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
                    <h5 style={{ color: '#2d6325', marginBottom: '6px' }}>Điểm mạnh & Nét riêng</h5>
                    <p>{cleanPedagogicalText(displayData.strength, 'Bài viết hoàn chỉnh, nét chữ rõ ràng và đúng chủ đề.')}</p>
                    {displayData.evidence && (
                      <div style={{ fontSize: '13px', color: '#556850', marginTop: '8px' }}>
                        <b>Dẫn chứng trong bài:</b> {displayData.evidence}
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#fff9f0', padding: '14px', borderRadius: '8px', border: '1px solid #f2dfc2' }}>
                    <h5 style={{ color: '#8a5c1b', marginBottom: '6px' }}>Nội dung cần hỗ trợ</h5>
                    <p>{cleanPedagogicalText(displayData.support, 'Rèn luyện thêm cách dùng từ gợi tả và dấu câu hợp lý.')}</p>
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

      {/* MODAL LIGHTBOX XEM PHÓNG TO ẢNH BÀI LÀM */}
      {zoomImageUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '24px',
              display: 'flex',
              gap: '12px',
              zIndex: 100000,
            }}
          >
            <a
              href={zoomImageUrl}
              target="_blank"
              rel="noreferrer"
              className="btn compact outline"
              style={{ background: '#fff', color: '#1f3e16', borderColor: '#fff', fontWeight: 'bold' }}
              onClick={(e) => e.stopPropagation()}
            >
              ↗ Mở tab mới
            </a>
            <button
              className="btn compact"
              style={{ background: '#ffffff', color: '#111', fontWeight: 'bold', fontSize: '14px', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              onClick={() => setZoomImageUrl(null)}
            >
              ✕ Đóng (ESC)
            </button>
          </div>
          <div
            style={{
              maxWidth: '94vw',
              maxHeight: '90vh',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImageUrl}
              alt="Bài làm gốc phóng to"
              style={{
                maxWidth: '92vw',
                maxHeight: '88vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL POPUP XÁC NHẬN XÓA BÀI NỘP (CHUẨN GIAO DIỆN HIỆN ĐẠI, THAY THẾ LOCALHOST CONFIRM) */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => !deletingSub && setShowDeleteModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#fff',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header popup */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}
              >
                Xóa
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#111827', fontWeight: '700' }}>
                  Xác nhận xóa bài nộp
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  Hành động này sẽ xóa dữ liệu lần nộp bài này
                </p>
              </div>
              <button
                type="button"
                onClick={() => !deletingSub && setShowDeleteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Nội dung thông báo */}
            <div
              style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #fed7d7',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#374151',
              }}
            >
              Thầy cô có chắc chắn muốn xóa bài làm:
              <div style={{ margin: '6px 0', fontWeight: 'bold', color: '#991b1b', fontSize: '15px' }}>
                {subToDelete?.submissionLabel || `Bài nộp ${activeSubIdx + 1}`} — Em {current?.name} ({current?.id})
              </div>
              <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                Tệp ảnh bài làm và toàn bộ điểm số của lần nộp này sẽ bị xóa khỏi hệ thống.
              </div>
            </div>

            {/* Các nút hành động */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn outline"
                disabled={deletingSub}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '550',
                  color: '#4b5563',
                  borderColor: '#d1d5db',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={deletingSub}
                onClick={confirmDeleteSubmission}
                style={{
                  padding: '9px 20px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingSub ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP XÁC NHẬN XÓA ẢNH KHỎI BÀI LÀM */}
      {showDeleteAttModal && attToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => !deletingAtt && setShowDeleteAttModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#fff',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}
              >
                Xóa
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#111827', fontWeight: '700' }}>
                  Xóa ảnh khỏi bài làm?
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  Học sinh: <b>{current?.name}</b> ({current?.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => !deletingAtt && setShowDeleteAttModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #fed7d7',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '18px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#374151',
              }}
            >
              Thầy cô có chắc muốn xóa tệp ảnh:
              <div style={{ margin: '4px 0', fontWeight: 'bold', color: '#991b1b', wordBreak: 'break-all' }}>
                {attToDelete.name}
              </div>
              <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                Ảnh này sẽ bị gỡ bỏ khỏi bài làm của học sinh.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn outline"
                disabled={deletingAtt}
                onClick={() => setShowDeleteAttModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '550',
                  color: '#4b5563',
                  borderColor: '#d1d5db',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={deletingAtt}
                onClick={confirmDeleteAttachment}
                style={{
                  padding: '9px 20px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingAtt ? 'Đang xóa...' : 'Xác nhận xóa ảnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP XÁC NHẬN CHẤM CẢ LỚP */}
      {showGradeAllModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setShowGradeAllModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#fff',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#eaf4e6',
                  color: '#28664e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}
              >
                ⚡
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#111827', fontWeight: '700' }}>
                  AI Chấm bài cả lớp
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  Tự động phân tích và đề xuất điểm theo 4 tiêu chí
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGradeAllModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', marginBottom: '20px' }}>
              Thầy cô có muốn kích hoạt Trợ lý AI tự động đọc và chấm tất cả các bài làm chưa duyệt trong lớp không?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn outline"
                onClick={() => setShowGradeAllModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '550',
                  color: '#4b5563',
                  borderColor: '#d1d5db',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={confirmGradeAllAI}
                style={{
                  padding: '9px 20px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Bắt đầu chấm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRÌNH CẮT ẢNH & XOAY ẢNH 360 ĐỘ TRƯỚC KHI NẠP BÀI */}
      <ImageEditorModal
        isOpen={showImageEditor}
        files={filesToEdit}
        studentName={current?.name}
        onClose={() => {
          setShowImageEditor(false);
          setFilesToEdit([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (addMoreFilesInputRef.current) addMoreFilesInputRef.current.value = '';
        }}
        onComplete={(croppedFiles) => {
          executeUploadFiles(croppedFiles, uploadMode);
        }}
      />
    </div>
  );
}
