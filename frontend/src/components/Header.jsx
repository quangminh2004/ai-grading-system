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
  parent_home: 'Điểm số của con',
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
  const isParent = currentUser?.role === 'parent';
  const isTeacher = currentUser?.role === 'teacher';

  const breadcrumb = isAdmin
    ? 'Khu vực Quản trị'
    : isParent
    ? 'Cổng phụ huynh'
    : 'Không gian Giáo viên';

  const avatarLetters = isAdmin ? 'AD' : isParent ? 'PH' : 'GV';
  const roleLabel = isAdmin ? 'Quản trị viên' : isParent ? 'Phụ huynh' : 'Giáo viên';

  return (
    <header className="main-header">
      <div className="head-left">
        <span className="breadcrumb">{breadcrumb}</span>
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
        {isTeacher && classes.length > 0 && (
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
              {avatarLetters}
            </span>
            <div className="user-meta-header">
              <span className="user-name">{currentUser?.fullName || 'Người dùng'}</span>
              <span className="user-role-label">{roleLabel}</span>
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
