import React from 'react';

export default function Sidebar({
  page,
  setPage,
  studentCount,
  currentUser,
  onLogout,
}) {
  const isAdmin = currentUser?.role === 'admin';
  const schoolShort = currentUser?.school
    ? currentUser.school.toUpperCase()
    : 'HỆ THỐNG TRỢ LÝ CHẤM & CHỮA';

  const avatarLetters = isAdmin
    ? 'AD'
    : (currentUser?.fullName || 'GV')
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setPage(isAdmin ? 'admin_users' : 'overview');
        }}
      >
        <span className="brand-icon">✳</span>
        <span>
          Chấm <i>&</i> Chữa AI
        </span>
      </a>

      {/* Workspace Profile Header */}
      <div className="workspace">
        <span className={`avatar ${isAdmin ? 'peach' : ''}`}>{avatarLetters}</span>
        <div>
          {isAdmin ? 'Quản trị viên Hệ thống' : (currentUser?.fullName || 'Giáo viên')}
          <small>
            {isAdmin ? 'Trung tâm Quản trị Admin' : 'Giáo viên'}
          </small>
        </div>
      </div>

      {/* ========================================================
          MENU DÀNH RIÊNG CHO QUẢN TRỊ VIÊN (ADMIN)
          ======================================================== */}
      {isAdmin && (
        <>
          <p className="navlabel">CHỨC NĂNG QUẢN TRỊ</p>
          <nav>
            <button
              className={page === 'admin_users' ? 'active' : ''}
              onClick={() => setPage('admin_users')}
            >
              <span>☷</span>Quản lý Giáo viên
            </button>
            <button
              className={page === 'admin_schools' ? 'active' : ''}
              onClick={() => setPage('admin_schools')}
            >
              <span>▦</span>Danh mục Trường &amp; Lớp
            </button>
            <button
              className={page === 'admin_stats' ? 'active' : ''}
              onClick={() => setPage('admin_stats')}
            >
              <span>▤</span>Báo cáo &amp; Thống kê
            </button>
          </nav>
        </>
      )}

      {/* ========================================================
          MENU DÀNH RIÊNG CHO GIÁO VIÊN (TEACHER)
          ======================================================== */}
      {!isAdmin && (
        <>
          <p className="navlabel">KHÔNG GIAN GIÁO VIÊN</p>
          <nav>
            <button
              className={page === 'overview' ? 'active' : ''}
              onClick={() => setPage('overview')}
            >
              <span>▦</span>Tổng quan lớp học
            </button>
            <button
              className={page === 'intake' ? 'active' : ''}
              onClick={() => setPage('intake')}
            >
              <span>⇧</span>Nhận bài &amp; chấm AI
            </button>
            <button
              className={page === 'grading' ? 'active' : ''}
              onClick={() => setPage('grading')}
            >
              <span>▤</span>Chấm, chữa bài <b id="navcount">{studentCount}</b>
            </button>
            <button
              className={page === 'roster' ? 'active' : ''}
              onClick={() => setPage('roster')}
            >
              <span>☷</span>Danh sách lớp
            </button>
            <button
              className={page === 'profiles' ? 'active' : ''}
              onClick={() => setPage('profiles')}
            >
              <span>◉</span>Hồ sơ học tập
            </button>
            <button
              className={page === 'rubric' ? 'active' : ''}
              onClick={() => setPage('rubric')}
            >
              <span>☷</span>Tiêu chí đánh giá
            </button>
          </nav>
        </>
      )}

      {/* Profile & Logout */}
      <div className="teacher" style={{ marginTop: 'auto' }}>
        <span className={`avatar ${isAdmin ? 'peach' : ''}`}>{avatarLetters}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.fullName || 'Người dùng'}
          </div>
          <small style={{ color: 'var(--muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
          </small>
        </div>
        <button
          className="btn-sidebar-logout"
          onClick={onLogout}
          title="Đăng xuất khỏi hệ thống"
        >
          Thoát
        </button>
      </div>
    </aside>
  );
}
