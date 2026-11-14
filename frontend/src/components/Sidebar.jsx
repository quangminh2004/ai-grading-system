import React from 'react';

export default function Sidebar({
  page,
  setPage,
  studentCount,
  currentUser,
  onLogout,
}) {
  const isAdmin = currentUser?.role === 'admin';
  const isParent = currentUser?.role === 'parent';
  const isTeacher = currentUser?.role === 'teacher';

  const avatarLetters = isAdmin
    ? 'AD'
    : isParent
    ? 'PH'
    : (currentUser?.fullName || 'GV')
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const roleLabel = isAdmin ? 'Quản trị viên' : isParent ? 'Phụ huynh' : 'Giáo viên';
  const workspaceTitle = isAdmin
    ? 'Quản trị viên Hệ thống'
    : isParent
    ? (currentUser?.fullName || 'Phụ huynh')
    : (currentUser?.fullName || 'Giáo viên');
  const workspaceSub = isAdmin
    ? 'Trung tâm Quản trị Admin'
    : isParent
    ? 'Cổng phụ huynh'
    : 'Giáo viên';

  return (
    <aside className="sidebar">
      {/* Brand */}
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          if (isAdmin) setPage('admin_users');
          else if (isParent) setPage('parent_home');
          else setPage('overview');
        }}
      >
        <span className="brand-icon">
          <img
            src="/samples/Thales_STEM_logo_decal_trong_5000px.png"
            alt="Thales STEM"
            style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '10px' }}
          />
        </span>
        <span>
          Chấm <i>&</i> Chữa AI
        </span>
      </a>

      {/* Workspace Profile Header */}
      <div className="workspace">
        <span className={`avatar ${isAdmin ? 'peach' : ''}`}>{avatarLetters}</span>
        <div>
          {workspaceTitle}
          <small>{workspaceSub}</small>
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
          MENU DÀNH RIÊNG CHO PHỤ HUYNH
          ======================================================== */}
      {isParent && (
        <>
          <p className="navlabel">CỔNG PHỤ HUYNH</p>
          <nav>
            <button
              className={page === 'parent_home' ? 'active' : ''}
              onClick={() => setPage('parent_home')}
            >
              <span>◉</span>Con của tôi
            </button>
          </nav>
        </>
      )}

      {/* ========================================================
          MENU DÀNH RIÊNG CHO GIÁO VIÊN (TEACHER)
          ======================================================== */}
      {isTeacher && (
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
            {roleLabel}
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
