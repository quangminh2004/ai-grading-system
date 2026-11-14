import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtScore, sumScores, rubricMaxTotal } from '../utils/rubric';

export default function ParentGradesPage({ showToast }) {
  const [children, setChildren] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [grades, setGrades] = useState([]);
  const [childInfo, setChildInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);

  const childKey = (c) => `${c.classId}::${c.studentId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getMyChildren();
        if (!res.success) {
          showToast?.(res.message || 'Không tải được danh sách con.');
          return;
        }
        if (cancelled) return;
        const list = res.children || [];
        setChildren(list);
        if (list.length) {
          setSelectedKey(childKey(list[0]));
        }
      } catch (err) {
        showToast?.('Lỗi kết nối: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedKey) {
      setGrades([]);
      setChildInfo(null);
      return;
    }
    const [classId, studentId] = selectedKey.split('::');
    let cancelled = false;
    (async () => {
      setLoadingGrades(true);
      try {
        const res = await api.getChildGrades(classId, studentId);
        if (!res.success) {
          showToast?.(res.message || 'Không tải được điểm.');
          return;
        }
        if (cancelled) return;
        setChildInfo(res.child || null);
        setGrades(res.grades || []);
      } catch (err) {
        showToast?.('Lỗi tải điểm: ' + err.message);
      } finally {
        if (!cancelled) setLoadingGrades(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#687560' }}>
        Đang tải thông tin...
      </div>
    );
  }

  if (!children.length) {
    return (
      <div>
        <div className="pagehead">
          <div>
            <div className="eyebrow">CỔNG PHỤ HUYNH</div>
            <h1>Con của tôi</h1>
            <p className="sub">
              Tài khoản chưa được gắn với học sinh nào. Vui lòng liên hệ giáo viên chủ nhiệm.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">CỔNG PHỤ HUYNH</div>
          <h1>Điểm số của con</h1>
          <p className="sub">
            Chỉ hiển thị các bài giáo viên đã duyệt: điểm và nhận xét.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
          Chọn học sinh
        </label>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          style={{ minWidth: '280px', padding: '8px 12px' }}
          aria-label="Chọn học sinh"
        >
          {children.map((c) => (
            <option key={childKey(c)} value={childKey(c)}>
              {c.studentName} · {c.classLabel} ({c.studentId})
            </option>
          ))}
        </select>
      </div>

      {loadingGrades ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#687560' }}>
          Đang tải điểm...
        </div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>
            {childInfo
              ? `${childInfo.studentName} · ${childInfo.classLabel}`
              : 'Lịch sử điểm'}
          </h2>

          {!grades.length ? (
            <p style={{ color: '#687560' }}>
              Chưa có bài nào được giáo viên duyệt điểm.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: '32%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '2px solid #e3e8dc', color: '#66755e' }}>
                  <th style={{ padding: '12px' }}>Bài nộp</th>
                  <th style={{ padding: '12px' }}>Điểm</th>
                  <th style={{ padding: '12px' }}>Chi tiết tiêu chí</th>
                  <th style={{ padding: '12px' }}>Nhận xét giáo viên</th>
                  <th style={{ padding: '12px' }}>Ngày duyệt</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => {
                  const maxTotal = rubricMaxTotal(g.rubric);
                  const total = sumScores(g.teacherScores);
                  return (
                    <tr
                      key={`${g.submissionNumber}-${g.updatedAt}`}
                      style={{ borderBottom: '1px solid #eef2ea', verticalAlign: 'top' }}
                    >
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        {g.submissionLabel || `Bài ${g.submissionNumber}`}
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <strong>{fmtScore(total)}</strong>
                        <span style={{ color: '#7a8670' }}> / {fmtScore(maxTotal)}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                          {(g.rubric || []).map((r, i) => (
                            <li key={r.name + i} style={{ whiteSpace: 'nowrap' }}>
                              {r.name}: {fmtScore(g.teacherScores?.[i] ?? 0)}/{fmtScore(r.max)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', lineHeight: 1.45 }}>
                        {g.teacherFeedback || '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#7a8670', whiteSpace: 'nowrap' }}>
                        {g.updatedAt
                          ? new Date(g.updatedAt).toLocaleDateString('vi-VN')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
