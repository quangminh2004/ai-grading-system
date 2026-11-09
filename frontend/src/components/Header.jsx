import React, { useState } from 'react';

const pageNames = {
  overview: 'Tổng quan lớp học',
  intake: 'Nhận bài & chấm AI',
  grading: 'Chấm, chữa bài',
  roster: 'Danh sách lớp',
  profiles: 'Hồ sơ học tập',
  rubric: 'Tiêu chí đánh giá',
  admin_users: 'Quản lý Giáo viên & Tài khoản',
  admin_schools: 'Danh mục Trường Học & Lớp Học',
  admin_stats: 'Báo cáo & Thống kê Toàn Hệ Thống',
};

export default function Header({
  page,
  classes,
  currentClassId,
  onSelectClass,
  onNewClassClick,
  currentUser,
  onLogout,
  onChangePasswordClick,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="main-header">
      <div className="head-left">
        <span className="breadcrumb">
          {isAdmin ? 'Khu vực Quản trị' : 'Không gian Giáo viên'}
        </span>
        <span className="slash">/</span>
        <span id="crumb" className="crumb-active">{pageNames[page] || 'Trang'}</span>

        {currentUser?.school && (
          <span className="school-pill" title={`Đơn vị: ${currentUser.school}`}>
            {currentUser.school}
          </span>
        )}
      </div>

      <div className="head-right">
        {/* Chỉ Giáo viên mới có bộ chọn lớp học & nút thêm lớp */}
        {!isAdmin && classes.length > 0 && (
          <>
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
          </>
        )}

        {/* User Profile & Menu */}
        <div className="user-profile-menu-container">
          <button
            type="button"
            className="user-profile-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Tùy chọn tài khoản"
          >
            <span className={`avatar small ${isAdmin ? 'peach' : ''}`}>
              {isAdmin ? 'AD' : 'GV'}
            </span>
            <div className="user-meta-header">
              <span className="user-fullname">{currentUser?.fullName || 'Người dùng'}</span>
              <span className="user-role-label">
                {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
              </span>
            </div>
            <span className="dropdown-arrow">▾</span>
          </button>

          {showUserMenu && (
            <div className="user-dropdown-dropdown" onClick={() => setShowUserMenu(false)}>
              <div className="user-dropdown-info">
                <strong>{currentUser?.fullName}</strong>
                <small>@{currentUser?.username}</small>
                <div className="school-sub">{currentUser?.school}</div>
              </div>
              <div className="user-dropdown-divider" />
              <button
                type="button"
                className="user-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(false);
                  onChangePasswordClick();
                }}
              >
                Đổi mật khẩu
              </button>
              <button
                type="button"
                className="user-dropdown-item logout"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(false);
                  onLogout();
                }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
