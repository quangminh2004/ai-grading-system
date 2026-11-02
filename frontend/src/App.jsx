import React, { useState, useEffect } from 'react';
import './style.css';
import './intake.css';

import { api } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OverviewPage from './components/OverviewPage';
import GradingPage from './components/GradingPage';
import IntakePage from './components/IntakePage';
import RosterPage from './components/RosterPage';
import ProfilesPage from './components/ProfilesPage';
import RubricPage from './components/RubricPage';
import EditModal from './components/EditModal';
import LoginPage from './components/LoginPage';
import AdminUsersPage from './components/AdminUsersPage';
import AdminSchoolsPage from './components/AdminSchoolsPage';
import AdminStatsPage from './components/AdminStatsPage';

export default function App() {
  // Trạng thái người dùng đã đăng nhập (lấy từ localStorage nếu có)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('tl_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [page, setPage] = useState('overview');
  const [classes, setClasses] = useState([]);
  const [currentClassId, setCurrentClassId] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editStudent, setEditStudent] = useState(null);

  // Modal tạo lớp mới (dành cho giáo viên)
  const [newClassModal, setNewClassModal] = useState(false);
  const [newClassLabel, setNewClassLabel] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newClassSchool, setNewClassSchool] = useState('');

  // Modal đổi mật khẩu
  const [changePwdModal, setChangePwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // 1. Kiểm tra phiên đăng nhập khi khởi động
  useEffect(() => {
    const token = localStorage.getItem('tl_auth_token');
    if (token) {
      api.getMe()
        .then((res) => {
          if (res.success && res.user) {
            setCurrentUser(res.user);
            localStorage.setItem('tl_auth_user', JSON.stringify(res.user));
          } else {
            handleLogout();
          }
        })
        .catch(() => {
          // Lỗi mạng hoặc server chưa sẵn sàng, giữ phiên nếu có
        });
    }
  }, []);

  // 2. Định tuyến trang mặc định và tải dữ liệu theo vai trò
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === 'admin') {
      // Admin chỉ được ở các trang quản trị
      if (!['admin_users', 'admin_schools', 'admin_stats'].includes(page)) {
        setPage('admin_users');
      }
    } else {
      // Giáo viên chỉ được ở các trang lớp học
      if (['admin_users', 'admin_schools', 'admin_stats'].includes(page)) {
        setPage('overview');
      }
      loadClasses();
    }
  }, [currentUser]);

  const loadClasses = async () => {
    if (currentUser?.role === 'admin') return;
    try {
      const res = await api.getClasses(currentUser?.school);
      if (res.success && res.classes.length) {
        setClasses(res.classes);
        setCurrentClassId((prev) => {
          const exists = res.classes.some((c) => c.classId === prev);
          return exists ? prev : res.classes[0].classId;
        });
      } else {
        setClasses([]);
        setCurrentClassId('');
        setClassroom(null);
        setStudents([]);
      }
    } catch (err) {
      showToast('Không thể kết nối đến Backend: ' + err.message);
    }
  };

  // 3. Tải chi tiết lớp và học sinh mỗi khi đổi lớp (chỉ dành cho giáo viên)
  useEffect(() => {
    if (!currentClassId || currentUser?.role === 'admin') return;
    loadClassDetails(currentClassId);
  }, [currentClassId, currentUser]);

  const loadClassDetails = async (cId) => {
    setLoading(true);
    try {
      const res = await api.getClassDetails(cId);
      if (res.success) {
        setClassroom(res.classroom);
        setStudents(res.students);
        if (res.students.length > 0) {
          setSelectedStudentId((prev) =>
            res.students.some((s) => s.id === prev) ? prev : res.students[0].id
          );
        }
      }
    } catch (err) {
      showToast('Lỗi tải dữ liệu lớp: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập
  const handleLogin = async (username, password) => {
    const res = await api.login({ username, password });
    if (res.success) {
      setCurrentUser(res.user);
      showToast(`Xin chào, ${res.user.fullName}! Đăng nhập thành công.`);
      setPage(res.user.role === 'admin' ? 'admin_users' : 'overview');
      if (res.user.role === 'teacher') {
        await loadClasses();
      }
    }
    return res;
  };

  // Đăng xuất
  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setClasses([]);
    setClassroom(null);
    setStudents([]);
    setCurrentClassId('');
    setPage('overview');
    showToast('Đã đăng xuất an toàn khỏi hệ thống.');
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    try {
      const res = await api.changePassword({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
      });

      if (res.success) {
        showToast('✓ Đổi mật khẩu thành công!');
        setChangePwdModal(false);
        setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showToast(res.message || 'Lỗi đổi mật khẩu');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  // Lưu duyệt / sửa điểm vào MongoDB (Giáo viên)
  const handleSaveReview = async (reviewData) => {
    if (!editStudent) return;
    try {
      // Truyền submissionId để duyệt đúng bài được chọn (nếu học sinh có nhiều bài)
      const dataWithSubId = editStudent.submissionId
        ? { ...reviewData, submissionId: editStudent.submissionId }
        : reviewData;
      const res = await api.reviewSubmission(currentClassId, editStudent.id, dataWithSubId);
      if (res.success) {
        showToast(
          reviewData.state === 'approved'
            ? `✓ Đã duyệt kết quả cho học sinh ${editStudent.name}`
            : `Đã lưu bản nháp điểm cho học sinh ${editStudent.name}`
        );
        setEditStudent(null);
        await loadClassDetails(currentClassId);
      }
    } catch (err) {
      showToast('Lỗi lưu điểm: ' + err.message);
    }
  };

  // Thêm học sinh (Giáo viên)
  const handleAddStudent = async (studentData) => {
    try {
      const res = await api.addStudent(currentClassId, studentData);
      if (res.success) {
        showToast(`Đã thêm học sinh ${studentData.name} vào cơ sở dữ liệu`);
        await loadClassDetails(currentClassId);
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast('Lỗi thêm học sinh: ' + err.message);
    }
  };

  // Nhập danh sách hàng loạt (Giáo viên)
  const handleImportRoster = async (rawNames) => {
    try {
      const res = await api.importRoster(currentClassId, rawNames);
      if (res.success) {
        showToast(res.message);
        await loadClassDetails(currentClassId);
      }
    } catch (err) {
      showToast('Lỗi nhập danh sách: ' + err.message);
    }
  };

  // Tải lên tệp bài làm (Giáo viên)
  const handleUploadBatch = async (formData) => {
    try {
      const res = await api.uploadSubmissions(currentClassId, formData);
      if (res.success) {
        showToast(res.message);
        await loadClassDetails(currentClassId);
        setPage('grading');
      }
    } catch (err) {
      showToast('Lỗi tải lên tệp: ' + err.message);
    }
  };

  // Tạo lớp mới (Giáo viên)
  const handleCreateNewClass = async (e) => {
    e.preventDefault();
    if (!newClassId.trim() || !newClassLabel.trim()) return;
    try {
      const res = await api.createClass({
        classId: newClassId.trim(),
        label: newClassLabel.trim(),
        school: newClassSchool.trim() || currentUser?.school,
      });
      if (res.success) {
        showToast(`✓ Đã tạo lớp ${res.class.label}`);
        setNewClassModal(false);
        setNewClassId('');
        setNewClassLabel('');
        setNewClassSchool('');
        await loadClasses();
        setCurrentClassId(res.class.classId);
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast('Lỗi tạo lớp: ' + err.message);
    }
  };

  // Xuất file CSV các bài đã duyệt (Giáo viên)
  const handleExportCSV = () => {
    const approved = students.filter((s) => s.state === 'approved');
    if (!approved.length) {
      showToast('Chưa có bài nào được giáo viên duyệt để xuất CSV');
      return;
    }

    const headers = [
      'Mã HS',
      'Họ và tên',
      'Điểm Nội dung (/4)',
      'Điểm Bố cục (/2)',
      'Điểm Diễn đạt (/2)',
      'Điểm Chính tả (/2)',
      'Tổng điểm (/10)',
      'Nhận xét của giáo viên',
    ];

    const rows = approved.map((s) => {
      const sc = s.teacherScores || s.scores || [0, 0, 0, 0];
      const sum = sc.reduce((a, b) => a + Number(b), 0);
      return [
        s.id,
        `"${s.name.replace(/"/g, '""')}"`,
        sc[0] ?? '',
        sc[1] ?? '',
        sc[2] ?? '',
        sc[3] ?? '',
        sum,
        `"${(s.teacherFeedback || s.feedback || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Diem_${classroom?.school ? classroom.school.replace(/\s+/g, '_') + '_' : ''}${currentClassId}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất báo cáo CSV cho ${approved.length} học sinh`);
  };

  // ==================== NẾU CHƯA ĐĂNG NHẬP: HIỂN THỊ LOGIN ====================
  if (!currentUser) {
    return (
      <>
        {toastMessage && (
          <div id="toast" style={{ display: 'block', zIndex: 999999 }}>
            {toastMessage}
          </div>
        )}
        <LoginPage onLoginSuccess={handleLogin} />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="app-layout">
      {/* Toast thông báo */}
      {toastMessage && (
        <div id="toast" style={{ display: 'block' }}>
          {toastMessage}
        </div>
      )}

      {/* Sidebar điều hướng (phân quyền nghiêm ngặt Admin vs Giáo viên) */}
      <Sidebar
        page={page}
        setPage={setPage}
        studentCount={students.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Vùng nội dung chính */}
      <div className="app">
        <Header
          page={page}
          classes={classes}
          currentClassId={currentClassId}
          onSelectClass={setCurrentClassId}
          onNewClassClick={() => {
            setNewClassSchool(currentUser?.school || '');
            setNewClassModal(true);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          onChangePasswordClick={() => setChangePwdModal(true)}
        />

        <main id="main">
          {/* ==================== KHU VỰC QUẢN TRỊ ADMIN ==================== */}
          {isAdmin ? (
            <>
              {page === 'admin_users' && (
                <AdminUsersPage showToast={showToast} currentAdmin={currentUser} />
              )}
              {page === 'admin_schools' && (
                <AdminSchoolsPage showToast={showToast} />
              )}
              {page === 'admin_stats' && (
                <AdminStatsPage showToast={showToast} />
              )}
            </>
          ) : (
            /* ==================== KHÔNG GIAN DÀNH CHO GIÁO VIÊN ==================== */
            loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#687560' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
                Đang tải dữ liệu lớp học...
              </div>
            ) : (
              <>
                {page === 'overview' && (
                  <OverviewPage
                    classroom={classroom}
                    students={students}
                    setPage={setPage}
                    onSelectStudent={setSelectedStudentId}
                    onNewClassClick={() => {
                      setNewClassSchool(currentUser?.school || '');
                      setNewClassModal(true);
                    }}
                  />
                )}

                {page === 'grading' && (
                  <GradingPage
                    students={students}
                    selectedId={selectedStudentId}
                    onSelectStudent={setSelectedStudentId}
                    onOpenEditModal={(std) => setEditStudent(std)}
                    onExportCSV={handleExportCSV}
                    currentClassId={currentClassId}
                    onRefreshClass={loadClassDetails}
                    showToast={showToast}
                  />
                )}

                {page === 'intake' && (
                  <IntakePage
                    classroom={classroom}
                    students={students}
                    onUploadBatch={handleUploadBatch}
                    setPage={setPage}
                  />
                )}

                {page === 'roster' && (
                  <RosterPage
                    classroom={classroom}
                    students={students}
                    onAddStudent={handleAddStudent}
                    onImportRoster={handleImportRoster}
                  />
                )}

                {page === 'profiles' && (
                  <ProfilesPage classroom={classroom} students={students} />
                )}

                {page === 'rubric' && <RubricPage />}
              </>
            )
          )}
        </main>

        <footer>
          <span>
            {isAdmin
              ? 'Hệ Thống Trợ Lý Chấm & Chữa Bài AI · Cổng Điều Hành Quản Trị Viên'
              : `Trợ Lý Chấm & Chữa Bài AI · ${currentUser?.school || 'Không Gian Giáo Viên'}`}
          </span>
          <span>Nền tảng Quản lý &amp; Đánh giá Học tập Trực tuyến</span>
        </footer>
      </div>

      {/* Modal Chỉnh Sửa & Duyệt Điểm (Giáo viên) */}
      {!isAdmin && editStudent && (
        <EditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSave={handleSaveReview}
        />
      )}

      {/* Modal Thêm Lớp Mới (Giáo viên) */}
      {!isAdmin && newClassModal && (
        <div className="modal-backdrop" onClick={() => setNewClassModal(false)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo lớp học mới</h3>
              <button className="modal-close-btn" onClick={() => setNewClassModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateNewClass} className="modal-form">
              <div className="form-group">
                <label>Trường học:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trường Tiểu học Thanh Lân"
                  value={newClassSchool}
                  onChange={(e) => setNewClassSchool(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Mã lớp (ví dụ: 4C, 5A):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 4C"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                />
              </div>

              <div className="form-group">
                <label>Tên hiển thị (ví dụ: Lớp 4C):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lớp 4C"
                  value={newClassLabel}
                  onChange={(e) => setNewClassLabel(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNewClassModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  ✓ Tạo lớp học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {changePwdModal && (
        <div className="modal-backdrop" onClick={() => setChangePwdModal(false)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đổi mật khẩu tài khoản</h3>
              <button className="modal-close-btn" onClick={() => setChangePwdModal(false)}>✕</button>
            </div>
            <form onSubmit={handleChangePassword} className="modal-form">
              <div className="form-group">
                <label>Mật khẩu hiện tại *</label>
                <input
                  type="password"
                  required
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu mới (tối thiểu 6 ký tự) *</label>
                <input
                  type="password"
                  required
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setChangePwdModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Xác nhận đổi mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
