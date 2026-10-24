const API_BASE = 'http://localhost:5000/api';

export const api = {
  // Lấy danh sách lớp
  getClasses: async () => {
    const res = await fetch(`${API_BASE}/classes`);
    return res.json();
  },

  // Tạo lớp mới
  createClass: async (data) => {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Lấy chi tiết lớp (gồm học sinh và bài nộp từ MongoDB Atlas)
  getClassDetails: async (classId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/full`);
    return res.json();
  },

  // Thêm học sinh
  addStudent: async (classId, studentData) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    return res.json();
  },

  // Nhập danh sách học sinh hàng loạt
  importRoster: async (classId, rawNames) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/roster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNames }),
    });
    return res.json();
  },

  // Lấy tiêu chí và bài tập
  getAssignment: async () => {
    const res = await fetch(`${API_BASE}/assignment`);
    return res.json();
  },

  // Giáo viên chấm / sửa / duyệt bài và ghi log vào MongoDB Atlas
  reviewSubmission: async (classId, studentId, reviewData) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData),
    });
    return res.json();
  },

  // Tải lên tệp bài làm và ghép với học sinh
  uploadSubmissions: async (classId, formData) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/receive-batch`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Khôi phục dữ liệu mẫu
  resetSamples: async () => {
    const res = await fetch(`${API_BASE}/reset-samples`, { method: 'POST' });
    return res.json();
  },
};
