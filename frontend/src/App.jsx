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

export default function App() {
  const [page, setPage] = useState('overview');
  const [classes, setClasses] = useState([]);
  const [currentClassId, setCurrentClassId] = useState('4A');
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [editStudent, setEditStudent] = useState(null);
  const [newClassModal, setNewClassModal] = useState(false);
  const [newClassLabel, setNewClassLabel] = useState('');
  const [newClassId, setNewClassId] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // 1. Tải danh sách lớp lúc khởi động
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const res = await api.getClasses();
      if (res.success && res.classes.length) {
        setClasses(res.classes);
        if (!currentClassId) {
          setCurrentClassId(res.classes[0].classId);
        }
      }
    } catch (err) {
      showToast('Không thể kết nối đến Backend: ' + err.message);
    }
  };

  // 2. Tải chi tiết lớp và học sinh mỗi khi đổi lớp
  useEffect(() => {
    if (!currentClassId) return;
    loadClassDetails(currentClassId);
  }, [currentClassId]);

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

  // Lưu duyệt / sửa điểm vào MongoDB Atlas
  const handleSaveReview = async (reviewData) => {
    if (!editStudent) return;
    try {
      const res = await api.reviewSubmission(currentClassId, editStudent.id, reviewData);
      if (res.success) {
        showToast(
          reviewData.state === 'approved'
            ? `✓ Đã duyệt kết quả cho học sinh ${editStudent.name} vào MongoDB Atlas`
            : `Đã lưu bản nháp điểm cho học sinh ${editStudent.name}`
        );
        setEditStudent(null);
        await loadClassDetails(currentClassId);
      }
    } catch (err) {
      showToast('Lỗi lưu điểm: ' + err.message);
    }
  };

  // Thêm học sinh
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

  // Nhập danh sách hàng loạt
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

  // Tải lên tệp bài làm
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

  // Khôi phục dữ liệu mẫu
  const handleResetSamples = async () => {
    if (!window.confirm('Khôi phục toàn bộ bài mẫu và dữ liệu lớp 4A, 4B trên MongoDB Atlas?')) {
      return;
    }
    try {
      const res = await api.resetSamples();
      if (res.success) {
        showToast('✓ Đã khôi phục dữ liệu mẫu thành công vào MongoDB Atlas!');
        await loadClasses();
        await loadClassDetails(currentClassId || '4A');
      }
    } catch (err) {
      showToast('Lỗi khôi phục: ' + err.message);
    }
  };

  // Tạo lớp mới
  const handleCreateNewClass = async (e) => {
    e.preventDefault();
    if (!newClassId.trim() || !newClassLabel.trim()) return;
    try {
      const res = await api.createClass({
        classId: newClassId.trim(),
        label: newClassLabel.trim(),
      });
      if (res.success) {
        showToast(`Đã tạo lớp ${res.class.label}`);
        setNewClassModal(false);
        setNewClassId('');
        setNewClassLabel('');
        await loadClasses();
        setCurrentClassId(res.class.classId);
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast('Lỗi tạo lớp: ' + err.message);
    }
  };

  // Xuất file CSV các bài đã duyệt
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

    // Thêm BOM UTF-8 để mở tiếng Việt trên Microsoft Excel không bị lỗi font
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Diem_${currentClassId}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất báo cáo CSV cho ${approved.length} học sinh`);
  };

  return (
    <div className="app-layout">
      {/* Toast */}
      {toastMessage && (
        <div id="toast" style={{ display: 'block' }}>
          {toastMessage}
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        page={page}
        setPage={setPage}
        studentCount={students.length}
        onResetSamples={handleResetSamples}
      />

      {/* Main Container */}
      <div className="app">
        <Header
          page={page}
          classes={classes}
          currentClassId={currentClassId}
          onSelectClass={setCurrentClassId}
          onNewClassClick={() => setNewClassModal(true)}
        />

        <main id="main">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#687560' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              Đang đồng bộ dữ liệu với MongoDB Atlas...
            </div>
          ) : (
            <>
              {page === 'overview' && (
                <OverviewPage
                  classroom={classroom}
                  students={students}
                  setPage={setPage}
                  onSelectStudent={setSelectedStudentId}
                />
              )}

              {page === 'grading' && (
                <GradingPage
                  students={students}
                  selectedId={selectedStudentId}
                  onSelectStudent={setSelectedStudentId}
                  onOpenEditModal={(std) => setEditStudent(std)}
                  onExportCSV={handleExportCSV}
                />
              )}

              {page === 'intake' && (
                <IntakePage
                  classroom={classroom}
                  students={students}
                  onUploadBatch={handleUploadBatch}
                  onResetSamples={handleResetSamples}
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
          )}
        </main>

        <footer>
          <span>Thanh Lân · Chấm &amp; Chữa AI (Phiên bản đầy đủ BE + FE + MongoDB Atlas)</span>
          <span>Dữ liệu thời gian thực · Cập nhật đám mây</span>
        </footer>
      </div>

      {/* Modal Chỉnh Sửa & Duyệt Điểm */}
      {editStudent && (
        <EditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSave={handleSaveReview}
        />
      )}

      {/* Modal Thêm Lớp Mới */}
      {newClassModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="card"
            style={{
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
              background: '#fff',
              borderRadius: '10px',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>Tạo lớp học mới</h3>
            <form onSubmit={handleCreateNewClass} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Mã lớp (ví dụ: 4C, 5A):
                </label>
                <input
                  type="text"
                  required
                  placeholder="4C"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Tên hiển thị (ví dụ: Lớp 4C):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Lớp 4C"
                  value={newClassLabel}
                  onChange={(e) => setNewClassLabel(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn outline" onClick={() => setNewClassModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn primary">
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
