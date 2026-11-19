import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtScore, sumScores, rubricMaxTotal } from '../utils/rubric';

/* ─── Hằng màu ─────────────────────────────────────────── */
const COLOR_STRONG  = '#4caf50'; // ≥ 80 %
const COLOR_MEDIUM  = '#ff9800'; // 50–79 %
const COLOR_WEAK    = '#f44336'; // < 50 %
const COLOR_BG_GRID = '#e8ede4';
const COLOR_FILL    = 'rgba(76,175,80,0.18)';
const COLOR_STROKE  = '#4caf50';

function pct(score, max) {
  if (!max) return 0;
  return Math.min(1, score / max);
}

function levelColor(ratio) {
  if (ratio >= 0.8) return COLOR_STRONG;
  if (ratio >= 0.5) return COLOR_MEDIUM;
  return COLOR_WEAK;
}

function levelLabel(ratio) {
  if (ratio >= 0.8) return 'Tốt';
  if (ratio >= 0.5) return 'Trung bình';
  return 'Cần cải thiện';
}

/* ─── Radar Chart (SVG thuần) ───────────────────────────── */
function RadarChart({ rubric, avgScores }) {
  const W = 260, H = 260, cx = 130, cy = 130, R = 95;
  const n = rubric.length;
  if (n < 3) return null;

  // Toạ độ đỉnh đa giác với trục lên trên (−π/2)
  const angle = (i) => (2 * Math.PI * i) / n - Math.PI / 2;
  const pt = (i, r) => [
    cx + r * Math.cos(angle(i)),
    cy + r * Math.sin(angle(i)),
  ];

  // Lưới nền 4 cấp
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPolygons = gridLevels.map((lv) =>
    rubric.map((_, i) => pt(i, R * lv)).map((p) => p.join(',')).join(' ')
  );

  // Đa giác điểm học sinh
  const ratios = rubric.map((r, i) => pct(avgScores[i] ?? 0, r.max));
  const dataPoints = rubric.map((_, i) => pt(i, R * ratios[i]));
  const dataPolygon = dataPoints.map((p) => p.join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
      {/* Lưới nền */}
      {gridPolygons.map((pts, gi) => (
        <polygon key={gi} points={pts} fill="none" stroke={COLOR_BG_GRID} strokeWidth={1} />
      ))}
      {/* Trục từ tâm */}
      {rubric.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={COLOR_BG_GRID} strokeWidth={1} />;
      })}
      {/* Vùng điểm */}
      <polygon points={dataPolygon} fill={COLOR_FILL} stroke={COLOR_STROKE} strokeWidth={2} />
      {/* Điểm tròn */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={levelColor(ratios[i])} stroke="#fff" strokeWidth={1.5} />
      ))}
      {/* Nhãn tiêu chí */}
      {rubric.map((r, i) => {
        const [x, y] = pt(i, R + 20);
        const anchor = x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle';
        // Rút ngắn tên tiêu chí nếu dài
        const shortName = r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name;
        return (
          <text
            key={i} x={x} y={y}
            textAnchor={anchor} dominantBaseline="middle"
            fontSize={10} fill="#445240" fontFamily="inherit"
          >
            {shortName}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── Bar Chart – tiến bộ điểm tổng qua các bài ────────── */
function ScoreTrendBars({ grades }) {
  if (!grades.length) return null;
  const barW = 48, gap = 20, padL = 36, padB = 36, padT = 16, chartH = 140;
  const totalW = padL + grades.length * (barW + gap) + gap;
  const maxScore = Math.max(...grades.map((g) => rubricMaxTotal(g.rubric)));

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + padB + padT}`} width="100%" style={{ maxWidth: totalW }}>
      {/* Đường lưới ngang */}
      {[0, 0.25, 0.5, 0.75, 1].map((lv) => {
        const y = padT + chartH * (1 - lv);
        return (
          <g key={lv}>
            <line x1={padL} y1={y} x2={totalW} y2={y} stroke={COLOR_BG_GRID} strokeWidth={lv === 0 || lv === 1 ? 1.5 : 0.8} />
            <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#7a8670">
              {fmtScore(maxScore * lv)}
            </text>
          </g>
        );
      })}
      {/* Cột từng bài */}
      {grades.map((g, i) => {
        const total = sumScores(g.teacherScores);
        const maxT = rubricMaxTotal(g.rubric);
        const ratio = pct(total, maxT);
        const bh = Math.max(4, chartH * ratio);
        const x = padL + gap + i * (barW + gap);
        const y = padT + chartH - bh;
        const color = levelColor(ratio);
        const label = g.submissionLabel || `Bài ${g.submissionNumber}`;
        const shortLabel = label.length > 8 ? label.slice(0, 7) + '…' : label;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={color} fillOpacity={0.85} />
            {/* Điểm trên cột */}
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill={color} fontWeight="600">
              {fmtScore(total)}
            </text>
            {/* Nhãn bài */}
            <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize={9} fill="#445240">
              {shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Panel phân tích điểm mạnh / yếu ──────────────────── */
function StrengthWeaknessPanel({ rubric, avgScores }) {
  if (!rubric.length) return null;
  const ratios = rubric.map((r, i) => ({ name: r.name, ratio: pct(avgScores[i] ?? 0, r.max) }));
  const strong = ratios.filter((r) => r.ratio >= 0.8).map((r) => r.name);
  const medium = ratios.filter((r) => r.ratio >= 0.5 && r.ratio < 0.8).map((r) => r.name);
  const weak   = ratios.filter((r) => r.ratio < 0.5).map((r) => r.name);

  const Tag = ({ label, color }) => (
    <span style={{
      display: 'inline-block', background: color + '22',
      color, border: `1px solid ${color}55`,
      borderRadius: 12, padding: '2px 10px', fontSize: 12, margin: '2px 4px 2px 0',
    }}>{label}</span>
  );

  return (
    <div style={{ marginTop: 12 }}>
      {strong.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#445240', fontWeight: 600 }}>💪 Điểm mạnh: </span>
          {strong.map((n) => <Tag key={n} label={n} color={COLOR_STRONG} />)}
        </div>
      )}
      {medium.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#445240', fontWeight: 600 }}>📌 Khá: </span>
          {medium.map((n) => <Tag key={n} label={n} color={COLOR_MEDIUM} />)}
        </div>
      )}
      {weak.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#445240', fontWeight: 600 }}>🔧 Cần cải thiện: </span>
          {weak.map((n) => <Tag key={n} label={n} color={COLOR_WEAK} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Tính điểm trung bình từng tiêu chí ───────────────── */
function computeAvgScores(grades) {
  if (!grades.length) return { rubric: [], avgScores: [] };
  // Lấy rubric từ bài đầu (giả sử cùng rubric)
  const rubric = grades[0].rubric || [];
  const sums = rubric.map(() => 0);
  const counts = rubric.map(() => 0);
  grades.forEach((g) => {
    (g.teacherScores || []).forEach((s, i) => {
      if (i < sums.length) { sums[i] += s; counts[i]++; }
    });
  });
  const avgScores = sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
  return { rubric, avgScores };
}

/* ─── Component chính ───────────────────────────────────── */
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
        if (list.length) setSelectedKey(childKey(list[0]));
      } catch (err) {
        showToast?.('Lỗi kết nối: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedKey) { setGrades([]); setChildInfo(null); return; }
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
    return () => { cancelled = true; };
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

  const { rubric, avgScores } = computeAvgScores(grades);
  const hasChart = grades.length >= 1 && rubric.length >= 3;

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

      {/* Chọn học sinh */}
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
        <>
          {/* ── Biểu đồ phân tích (chỉ hiện khi có bài) ── */}
          {hasChart && (
            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
              <h2 style={{ marginTop: 0, fontSize: '17px', color: '#2d3c2b' }}>
                📊 Phân tích năng lực của con
              </h2>
              <p style={{ fontSize: 13, color: '#687560', marginTop: -8, marginBottom: 20 }}>
                Dựa trên{' '}
                <strong>{grades.length} bài</strong> giáo viên đã duyệt.
                Điểm trung bình từng tiêu chí:
              </p>

              {/* Thẻ tiêu chí */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {rubric.map((r, i) => {
                  const ratio = pct(avgScores[i] ?? 0, r.max);
                  const color = levelColor(ratio);
                  return (
                    <div key={r.name + i} style={{
                      flex: '1 1 160px', background: color + '11',
                      border: `1.5px solid ${color}44`,
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <div style={{ fontSize: 12, color: '#445240', fontWeight: 600, marginBottom: 4 }}>
                        {r.name}
                      </div>
                      {/* Thanh tiến trình */}
                      <div style={{ background: '#e3e8dc', borderRadius: 4, height: 8, marginBottom: 6 }}>
                        <div style={{
                          width: `${Math.round(ratio * 100)}%`,
                          background: color, borderRadius: 4, height: 8,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color, fontWeight: 700 }}>
                          {fmtScore(avgScores[i])} / {fmtScore(r.max)}
                        </span>
                        <span style={{ color: '#888' }}>{levelLabel(ratio)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Radar + Bar charts */}
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Radar */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#445240', marginBottom: 8, textAlign: 'center' }}>
                    Biểu đồ mạng nhện – Trung bình tiêu chí
                  </div>
                  <RadarChart rubric={rubric} avgScores={avgScores} />
                </div>

                {/* Bar chart tiến bộ */}
                <div style={{ flex: '1 1 240px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#445240', marginBottom: 8 }}>
                    Điểm tổng từng bài nộp
                  </div>
                  <ScoreTrendBars grades={grades} />

                  {/* Chú thích màu */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    {[
                      { color: COLOR_STRONG, label: 'Tốt (≥ 80%)' },
                      { color: COLOR_MEDIUM, label: 'Khá (50–79%)' },
                      { color: COLOR_WEAK,   label: 'Cần cố gắng (< 50%)' },
                    ].map(({ color, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5a6a58' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Điểm mạnh / yếu */}
              <StrengthWeaknessPanel rubric={rubric} avgScores={avgScores} />
            </div>
          )}

          {/* ── Bảng lịch sử điểm ── */}
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
        </>
      )}
    </div>
  );
}
