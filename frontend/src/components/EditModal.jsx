import React, { useState } from 'react';
import { getRubric, fmtScore } from '../utils/rubric';

export default function EditModal({ student, classRubric, onClose, onSave }) {
  // Bài đã chấm theo bộ tiêu chí nào thì sửa theo bộ đó; bài chưa chấm dùng tiêu chí hiện tại của lớp
  const rubric = getRubric(student.rubric || classRubric);
  const maxTotal = rubric.reduce((s, r) => s + Number(r.max), 0);

  const existing = student.teacherScores?.length ? student.teacherScores : student.scores;
  const initialScores = rubric.map((r, i) =>
    existing?.length === rubric.length ? Number(existing[i]) || 0 : 0
  );
  const [scores, setScores] = useState(initialScores);
  const [feedback, setFeedback] = useState(
    student.teacherFeedback || student.feedback || ''
  );
  const [reason, setReason] = useState(
    student.reason || 'Giáo viên đã đọc bài, xác nhận điểm và nhận xét phù hợp.'
  );

  const handleScoreChange = (index, val) => {
    const next = [...scores];
    next[index] = Math.max(0, Math.min(rubric[index].max, parseFloat(val) || 0));
    setScores(next);
  };

  const totalScore = scores.reduce((sum, s) => sum + (Number(s) || 0), 0);

  const handleSubmit = (stateToSet) => {
    onSave({
      state: stateToSet, // 'approved' | 'suggested'
      teacherScores: scores,
      teacherFeedback: feedback,
      reason,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #eef2ea',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              Duyệt bài học sinh: {student.name} ({student.id})
            </h3>
            <small style={{ color: '#7a8670' }}>Đánh giá và ghi nhận xét chính thức</small>
          </div>
          <button
            className="iconbtn"
            onClick={onClose}
            style={{ fontSize: '20px', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ✕
          </button>
        </div>

        {/* Rubric inputs */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Chấm điểm theo {rubric.length} tiêu chí:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {rubric.map((r, i) => (
              <div
                key={i}
                style={{
                  background: '#f8faf6',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8dc',
                }}
              >
                <label htmlFor={`score-${i}`} style={{ fontSize: '13px', color: '#556550', marginBottom: '4px', display: 'block' }}>
                  {r.name} (Tối đa {fmtScore(r.max)}đ)
                </label>
                <input
                  id={`score-${i}`}
                  type="number"
                  step="0.25"
                  min="0"
                  max={r.max}
                  value={scores[i] ?? 0}
                  onChange={(e) => handleScoreChange(i, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '15px',
                    fontWeight: 'bold',
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '12px',
              textAlign: 'right',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#2b5120',
            }}
          >
            Tổng điểm: {totalScore.toFixed(2)} / {fmtScore(maxTotal)}
          </div>
        </div>

        {/* Teacher Feedback textarea */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Lời nhận xét của giáo viên:
          </label>
          <textarea
            rows="3"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
            placeholder="Nhập nhận xét gửi cho học sinh…"
          />
        </div>

        {/* Reason / Note textarea */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Ghi chú nhật ký duyệt (Audit Log):
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '13px',
            }}
            placeholder="Lý do điều chỉnh hoặc ghi chú nội bộ…"
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn outline" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn secondary"
            onClick={() => handleSubmit('suggested')}
            title="Lưu lại điểm chỉnh sửa nhưng chưa duyệt chính thức"
          >
            Lưu bản nháp
          </button>
          <button
            className="btn primary"
            onClick={() => handleSubmit('approved')}
            title="Xác nhận giáo viên đã duyệt bài này"
          >
            Lưu &amp; Xác nhận Duyệt
          </button>
        </div>
      </div>
    </div>
  );
}
