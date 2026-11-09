import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AdminStatsPage({ showToast }) {
  const [stats, setStats] = useState(null);
  const [aiProviders, setAiProviders] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadAiProviders();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminStats();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      showToast('Lỗi tải thống kê: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAiProviders = async () => {
    try {
      const res = await api.getAiProvidersStatus();
      if (res.success) {
        setAiProviders(res.providers);
      }
    } catch {
      // bỏ qua nếu lỗi
    }
  };

  return (
    <div className="admin-page-container">
      {/* KPI Cards */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Giáo viên các trường</span>
              <span className="kpi-num">{stats.teachers}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Trường học liên kết</span>
              <span className="kpi-num">{stats.schools}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Lớp học trên hệ thống</span>
              <span className="kpi-num">{stats.classes}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Bài làm đã duyệt</span>
              <span className="kpi-num">{stats.submissions?.approved || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Breakdown */}
      <div className="card admin-table-card" style={{ marginTop: '8px' }}>
        <h3>Báo cáo Tình trạng Chấm Bài Toàn Hệ Thống</h3>
        <p className="card-subtext">
          Tỷ lệ xử lý bài viết của học sinh qua các giai đoạn: Mới nộp, AI gợi ý điểm, Giáo viên đã duyệt.
        </p>

        {stats?.submissions && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '13px', color: '#166534', fontWeight: 'bold' }}>Đã được giáo viên duyệt</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#15803d', margin: '6px 0' }}>
                {stats.submissions.approved} bài
              </div>
              <small style={{ color: '#166534' }}>
                {stats.submissions.total ? Math.round((stats.submissions.approved / stats.submissions.total) * 100) : 0}% trên tổng số
              </small>
            </div>

            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 'bold' }}>AI đã chấm &amp; đề xuất</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1d4ed8', margin: '6px 0' }}>
                {stats.submissions.suggested} bài
              </div>
              <small style={{ color: '#1e40af' }}>Đang chờ các cô xem xét &amp; duyệt</small>
            </div>

            <div style={{ background: '#fefce8', padding: '16px', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <div style={{ fontSize: '13px', color: '#854d0e', fontWeight: 'bold' }}>Bài mới nhận</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#a16207', margin: '6px 0' }}>
                {stats.submissions.new} bài
              </div>
              <small style={{ color: '#854d0e' }}>Chưa chạy quy trình chấm</small>
            </div>
          </div>
        )}
      </div>

      {/* GIÁM SÁT TRẠNG THÁI NHÀ CUNG CẤP AI (AI PROVIDERS STATUS) */}
      <div className="card admin-table-card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Trạng Thái Nhà Cung CẤp AI (AI Providers Health)</h3>
            <p className="card-subtext" style={{ margin: '4px 0 0 0' }}>
              Theo dõi tình trạng hoạt động, hạn mức credit và quyền truy cập của OpenAI &amp; Google Gemini.
            </p>
          </div>
          <button className="btn compact outline" onClick={loadAiProviders}>
            Làm mới
          </button>
        </div>

        {aiProviders && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {/* OpenAI Card */}
            {(() => {
              const op = aiProviders.openai || {};
              const isQuota = op.status === 'insufficient_quota';
              const isActive = op.status === 'active';
              const isInvalid = op.status === 'invalid_key';
              const isRate = op.status === 'rate_limited';
              const isNotCfg = op.status === 'not_configured';

              const bg = isActive ? '#f0fdf4' : (isQuota || isInvalid) ? '#fef2f2' : isRate ? '#fffbeb' : '#f9fafb';
              const border = isActive ? '#bbf7d0' : (isQuota || isInvalid) ? '#fecaca' : isRate ? '#fde68a' : '#e5e7eb';
              const badgeColor = isActive ? '#15803d' : (isQuota || isInvalid) ? '#b91c1c' : isRate ? '#b45309' : '#6b7280';

              return (
                <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>
                      {op.name || 'OpenAI Vision'}
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: badgeColor,
                        background: '#fff',
                        border: `1px solid ${border}`,
                      }}
                    >
                      {isActive
                        ? '● Đang hoạt động'
                        : isQuota
                        ? '● Hết Credit (429)'
                        : isRate
                        ? '● Bị Rate Limit (429)'
                        : isInvalid
                        ? '● Khóa không hợp lệ'
                        : isNotCfg
                        ? '● Chưa cấu hình'
                        : '● Tạm gián đoạn'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '6px' }}>
                    Model: <b>{op.activeModel || 'gpt-4o'}</b>
                  </div>
                  {op.lastError && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', fontSize: '12px', color: '#991b1b', border: '1px solid #fee2e2' }}>
                      <b>Lỗi gần nhất:</b> {op.lastError.errorMessage}
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                        Mã lỗi: {op.lastError.errorCode} {op.lastError.httpStatus ? `(HTTP ${op.lastError.httpStatus})` : ''} · {new Date(op.lastError.timestamp).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Gemini Card */}
            {(() => {
              const gm = aiProviders.gemini || {};
              const isPerm = gm.status === 'permission_denied';
              const isQuota = gm.status === 'insufficient_quota';
              const isActive = gm.status === 'active';
              const isNotCfg = gm.status === 'not_configured';

              const bg = isActive ? '#f0fdf4' : (isPerm || isQuota) ? '#fef2f2' : '#f9fafb';
              const border = isActive ? '#bbf7d0' : (isPerm || isQuota) ? '#fecaca' : '#e5e7eb';
              const badgeColor = isActive ? '#15803d' : (isPerm || isQuota) ? '#b91c1c' : '#6b7280';

              return (
                <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>
                      {gm.name || 'Google Gemini Vision'}
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: badgeColor,
                        background: '#fff',
                        border: `1px solid ${border}`,
                      }}
                    >
                      {isActive
                        ? '● Đang hoạt động'
                        : isPerm
                        ? '● Lỗi Billing / Quyền (403)'
                        : isQuota
                        ? '● Hết hạn mức (429)'
                        : isNotCfg
                        ? '● Chưa cấu hình'
                        : '● Tạm gián đoạn'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '6px' }}>
                    Model: <b>{gm.activeModel || 'gemini-2.5-flash'}</b>
                  </div>
                  {gm.lastError && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', fontSize: '12px', color: '#991b1b', border: '1px solid #fee2e2' }}>
                      <b>Lỗi gần nhất:</b> {gm.lastError.errorMessage}
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                        Mã lỗi: {gm.lastError.errorCode} {gm.lastError.httpStatus ? `(HTTP ${gm.lastError.httpStatus})` : ''} · {new Date(gm.lastError.timestamp).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

