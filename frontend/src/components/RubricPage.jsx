import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { DEFAULT_RUBRIC, RUBRIC_MAX_ITEMS, getRubric, fmtScore } from '../utils/rubric';

const cardStyle = {
  padding: '18px 22px',
  borderRadius: '8px',
  border: '1.5px solid #dce4d5',
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd6c5',
  fontSize: '14.5px',
  fontFamily: 'inherit',
};

const pillStyle = {
  background: '#eef5ea',
  color: '#2d6325',
  padding: '8px 18px',
  borderRadius: '20px',
  fontWeight: '700',
  fontSize: '16px',
  whiteSpace: 'nowrap',
  border: '1px solid #c9dec1',
};

export default function RubricPage({ classroom, onRubricSaved, showToast }) {
  const rubric = getRubric(classroom?.rubric);
  const totalMax = rubric.reduce((s, r) => s + Number(r.max), 0);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  // Đổi lớp → thoát chế độ sửa
  useEffect(() => {
    setEditing(false);
  }, [classroom?.classId]);

  const startEdit = () => {
    setDraft(rubric.map((r) => ({ name: r.name, max: String(r.max), desc: r.desc || '' })));
    setEditing(true);
  };

  const updateItem = (i, field, value) => {
    setDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addItem = () => {
    if (draft.length >= RUBRIC_MAX_ITEMS) return;
    setDraft((prev) => [...prev, { name: '', max: '1', desc: '' }]);
  };

  const removeItem = (i) => {
    if (draft.length <= 1) return;
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  };

  const moveItem = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const draftTotal = draft.reduce((s, r) => s + (Number(r.max) || 0), 0);

  const validateDraft = () => {
    for (let i = 0; i < draft.length; i++) {
      if (!draft[i].name.trim()) return `Tiêu chí ${i + 1} chưa có tên.`;
      const m = Number(draft[i].max);
      if (!Number.isFinite(m) || m <= 0) return `Điểm tối đa của tiêu chí ${i + 1} phải lớn hơn 0.`;
    }
    return null;
  };

  const save = async (payload) => {
    if (!classroom?.classId) return;
    setSaving(true);
    try {
      const res = await api.updateClassRubric(classroom.classId, payload);
      showToast?.(res.message || (res.success ? 'Đã lưu tiêu chí' : 'Lỗi lưu tiêu chí'));
      if (res.success) {
        setEditing(false);
        await onRubricSaved?.();
      }
    } catch (err) {
      showToast?.('Lỗi lưu tiêu chí: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const err = validateDraft();
    if (err) {
      showToast?.(err);
      return;
    }
    save({
      rubric: draft.map((r) => ({ name: r.name.trim(), max: Number(r.max), desc: r.desc.trim() })),
    });
  };

  const handleReset = () => {
    if (!window.confirm('Khôi phục về bộ 4 tiêu chí mặc định (tổng 10 điểm) cho lớp này?')) return;
    save({ reset: true });
  };

  const loadDefaultIntoDraft = () => {
    setDraft(DEFAULT_RUBRIC.map((r) => ({ name: r.name, max: String(r.max), desc: r.desc })));
  };

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">TRỢ LÝ CHẤM CHỮA BÀI · TIÊU CHÍ ĐÁNH GIÁ</div>
          <h1>Khung tiêu chí đánh giá bài viết &amp; Tập làm văn</h1>
          <p className="sub">
            Áp dụng cho {classroom?.label || 'lớp hiện tại'} ·{' '}
            {classroom?.hasCustomRubric ? 'Tiêu chí do giáo viên tùy chỉnh' : 'Bộ tiêu chí mặc định'} · Thang
            điểm: {fmtScore(totalMax)} điểm
          </p>
        </div>
        <div className="actions">
          {!editing ? (
            <>
              <button className="btn primary" onClick={startEdit} disabled={!classroom}>
                ✎ Chỉnh sửa tiêu chí
              </button>
              {classroom?.hasCustomRubric && (
                <button className="btn outline" onClick={handleReset} disabled={saving}>
                  Khôi phục mặc định
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu tiêu chí'}
              </button>
              <button className="btn outline" onClick={() => setEditing(false)} disabled={saving}>
                Hủy
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '1000px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#233a35', fontWeight: '700' }}>
            {editing
              ? `${draft.length} tiêu chí (Tổng ${fmtScore(draftTotal)} điểm)`
              : `${rubric.length} tiêu chí đánh giá bài làm học sinh (Tổng ${fmtScore(totalMax)} điểm)`}
          </h3>
          {editing && (
            <button className="btn outline compact" onClick={loadDefaultIntoDraft} type="button">
              Nạp lại bộ mặc định
            </button>
          )}
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {rubric.map((r, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <strong style={{ fontSize: '16.5px', color: '#273822' }}>
                    {i + 1}. {r.name}
                  </strong>
                  {r.desc && (
                    <p style={{ margin: '6px 0 0 0', color: '#556550', fontSize: '14.5px', lineHeight: '1.6' }}>{r.desc}</p>
                  )}
                </div>
                <div style={pillStyle}>Tối đa {fmtScore(r.max)}đ</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {draft.map((r, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, color: '#273822', paddingTop: '8px', minWidth: '22px' }}>{i + 1}.</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 260px' }}>
                      <span style={{ fontSize: '12.5px', color: '#687560' }}>Tên tiêu chí *</span>
                      <input
                        type="text"
                        value={r.name}
                        maxLength={120}
                        placeholder="Ví dụ: Nội dung & chi tiết"
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ width: '130px' }}>
                      <span style={{ fontSize: '12.5px', color: '#687560' }}>Điểm tối đa *</span>
                      <input
                        type="number"
                        min="0.25"
                        max="100"
                        step="0.25"
                        value={r.max}
                        onChange={(e) => updateItem(i, 'max', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                  <label>
                    <span style={{ fontSize: '12.5px', color: '#687560' }}>Mô tả (AI dùng mô tả này để chấm)</span>
                    <textarea
                      rows="2"
                      maxLength={600}
                      value={r.desc}
                      placeholder="Mô tả yêu cầu của tiêu chí..."
                      onChange={(e) => updateItem(i, 'desc', e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '18px' }}>
                  <button type="button" className="btn outline compact" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Đưa lên" aria-label={`Đưa tiêu chí ${i + 1} lên`}>
                    ↑
                  </button>
                  <button type="button" className="btn outline compact" onClick={() => moveItem(i, 1)} disabled={i === draft.length - 1} title="Đưa xuống" aria-label={`Đưa tiêu chí ${i + 1} xuống`}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn outline compact"
                    onClick={() => removeItem(i)}
                    disabled={draft.length <= 1}
                    title="Xóa tiêu chí"
                    aria-label={`Xóa tiêu chí ${i + 1}`}
                    style={{ color: '#a33a2a' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn outline"
              onClick={addItem}
              disabled={draft.length >= RUBRIC_MAX_ITEMS}
              style={{ alignSelf: 'flex-start' }}
            >
              + Thêm tiêu chí {draft.length >= RUBRIC_MAX_ITEMS ? `(tối đa ${RUBRIC_MAX_ITEMS})` : ''}
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: '24px',
            padding: '16px 18px',
            background: '#fafbfa',
            borderRadius: '8px',
            border: '1px dashed #cbd6c5',
            fontSize: '13.5px',
            color: '#556550',
            lineHeight: '1.7',
          }}
        >
          <b>Ghi chú dành cho giáo viên:</b> Tiêu chí được áp dụng riêng cho từng lớp. AI sẽ chấm theo đúng các tiêu
          chí và mô tả ở trên. Các bài đã chấm trước đó vẫn giữ nguyên tiêu chí cũ; muốn chấm theo tiêu chí mới, thầy
          cô bấm "AI Chấm lại" cho bài đó. Điểm AI đề xuất chỉ để tham khảo, thầy cô có toàn quyền điều chỉnh trước khi
          duyệt.
        </div>
      </div>
    </div>
  );
}
