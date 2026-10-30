import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AdminStatsPage({ showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
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

  return (
    <div className="admin-page-container">
      {/* KPI Cards */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon teacher">👩‍🏫</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.teachers}</span>
              <span className="kpi-label">Giáo viên các trường</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon school">🏫</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.schools}</span>
              <span className="kpi-label">Trường học liên kết</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon classes">📚</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.classes}</span>
              <span className="kpi-label">Lớp học trên hệ thống</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon approved">✓</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.submissions?.approved || 0}</span>
              <span className="kpi-label">Bài làm đã duyệt</span>
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
              <div style={{ fontSize: '13px', color: '#166534', fontWeight: 'bold' }}>✓ Đã được giáo viên duyệt</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#15803d', margin: '6px 0' }}>
                {stats.submissions.approved} bài
              </div>
              <small style={{ color: '#166534' }}>
                {stats.submissions.total ? Math.round((stats.submissions.approved / stats.submissions.total) * 100) : 0}% trên tổng số
              </small>
            </div>

            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 'bold' }}>🤖 AI đã chấm &amp; đề xuất</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1d4ed8', margin: '6px 0' }}>
                {stats.submissions.suggested} bài
              </div>
              <small style={{ color: '#1e40af' }}>Đang chờ các cô xem xét &amp; duyệt</small>
            </div>

            <div style={{ background: '#fefce8', padding: '16px', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <div style={{ fontSize: '13px', color: '#854d0e', fontWeight: 'bold' }}>📄 Bài mới nhận</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#a16207', margin: '6px 0' }}>
                {stats.submissions.new} bài
              </div>
              <small style={{ color: '#854d0e' }}>Chưa chạy quy trình chấm</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

