import React from 'react';

export default function Sidebar({ page, setPage, studentCount, onResetSamples }) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setPage('overview'); }}>
        <span className="brand-icon">✳</span>
        <span>
          Chấm <i>&</i> Chữa
          <small>TRƯỜNG TIỂU HỌC THANH LÂN</small>
        </span>
      </a>

      {/* Workspace */}
      <div className="workspace">
        <span className="avatar">TL</span>
        <div>
          Không gian giáo viên
          <small>Dữ liệu: MongoDB Atlas ☁️</small>
        </div>
      </div>

      {/* Navigation */}
      <p className="navlabel">KHÔNG GIAN LÀM VIỆC</p>
      <nav>
        <button
          className={page === 'overview' ? 'active' : ''}
          onClick={() => setPage('overview')}
        >
          <span>▦</span>Tổng quan
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

      {/* Side bottom */}
      <div className="side-bottom">
        <div className="human-icon">✓</div>
        <strong>AI hỗ trợ.<br />Thầy cô quyết định.</strong>
        <p>Mỗi gợi ý đều cần được giáo viên xem xét và xác nhận.</p>
        <button
          className="textbtn"
          style={{ marginTop: '8px', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          onClick={onResetSamples}
          title="Nạp lại dữ liệu bài mẫu lớp 4A, 4B vào MongoDB Atlas"
        >
          ↻ Khôi phục dữ liệu mẫu Atlas
        </button>
      </div>

      {/* Teacher Profile */}
      <div className="teacher">
        <span className="avatar peach">GV</span>
        <div>
          Giáo viên Thanh Lân
          <small>Đang kết nối Cloud DB</small>
        </div>
      </div>
    </aside>
  );
}
