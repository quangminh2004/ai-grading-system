import React from 'react';

const pageNames = {
  overview: 'Tổng quan',
  intake: 'Nhận bài & chấm AI',
  grading: 'Chấm, chữa bài',
  roster: 'Danh sách lớp',
  profiles: 'Hồ sơ học tập',
  rubric: 'Tiêu chí đánh giá',
};

export default function Header({ page, classes, currentClassId, onSelectClass, onNewClassClick }) {
  return (
    <header>
      <div>
        <span className="breadcrumb">Không gian giáo viên</span>
        <span className="slash">/</span>
        <span id="crumb">{pageNames[page] || 'Trang'}</span>
      </div>
      <div className="head-right">
        <label className="class-picker" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Lớp
          <select
            value={currentClassId}
            onChange={(e) => onSelectClass(e.target.value)}
            aria-label="Chọn lớp"
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.label} ({c.classId})
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn compact outline"
          onClick={onNewClassClick}
          title="Tạo thêm lớp mới"
          style={{ fontSize: '13px', padding: '4px 10px' }}
        >
          + Thêm lớp
        </button>
        <span className="demo-pill" title="Dữ liệu lưu thời gian thực trên MongoDB Atlas">
          <i></i> MongoDB Atlas Live
        </span>
        <span className="avatar small">GV</span>
      </div>
    </header>
  );
}
