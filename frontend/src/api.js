const getApiBase = () => {
  if (typeof window !== 'undefined') {
    // Nếu chạy frontend ở Vite dev server (port 5173), trỏ đến backend port 5000
    if (window.location.port === '5173') {
      return 'http://localhost:5000/api';
    }
    // Khi chạy production / deploy trên server, luôn dùng relative path /api
    return '/api';
  }
  return '/api';
};

const API_BASE = getApiBase();

export const getFileUrl = (filePath, sampleUrl) => {
  if (sampleUrl) return sampleUrl;
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `http://localhost:5000${filePath}`;
  }
  return filePath;
};

const getToken = () => localStorage.getItem('tl_auth_token');

const authHeaders = (isJson = true) => {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // ==================== XÁC THỰC (AUTH) ====================
  login: async (credentials) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('tl_auth_token', data.token);
      localStorage.setItem('tl_auth_user', JSON.stringify(data.user));
    }
    return data;
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  logout: () => {
    localStorage.removeItem('tl_auth_token');
    localStorage.removeItem('tl_auth_user');
  },

  changePassword: async (passwords) => {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(passwords),
    });
    return res.json();
  },

  getSchools: async () => {
    const res = await fetch(`${API_BASE}/schools`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  createSchool: async (schoolData) => {
    const res = await fetch(`${API_BASE}/schools`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(schoolData),
    });
    return res.json();
  },

  updateSchool: async (id, schoolData) => {
    const res = await fetch(`${API_BASE}/schools/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(schoolData),
    });
    return res.json();
  },

  deleteSchool: async (id) => {
    const res = await fetch(`${API_BASE}/schools/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  // ==================== QUẢN TRỊ ADMIN (USERS) ====================
  getUsers: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/admin/users?${query}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  createTeacher: async (teacherData) => {
    const res = await fetch(`${API_BASE}/admin/users/create-teacher`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(teacherData),
    });
    return res.json();
  },

  updateUser: async (id, userData) => {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(userData),
    });
    return res.json();
  },

  resetUserPassword: async (id, newPassword) => {
    const res = await fetch(`${API_BASE}/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ newPassword }),
    });
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  getAdminStats: async () => {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  getSchoolsSummary: async () => {
    const res = await fetch(`${API_BASE}/admin/schools-summary`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // ==================== LỚP HỌC & HỌC SINH ====================
  getClasses: async (school) => {
    const url = school ? `${API_BASE}/classes?school=${encodeURIComponent(school)}` : `${API_BASE}/classes`;
    const res = await fetch(url, {
      headers: authHeaders(),
    });
    return res.json();
  },

  createClass: async (data) => {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteClass: async (classId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  getClassDetails: async (classId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/full`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  addStudent: async (classId, studentData) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/students`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(studentData),
    });
    return res.json();
  },

  importRoster: async (classId, rawNames) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/roster`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ rawNames }),
    });
    return res.json();
  },

  getAssignment: async () => {
    const res = await fetch(`${API_BASE}/assignment`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  reviewSubmission: async (classId, studentId, reviewData) => {
    // reviewData có thể chứa submissionId để duyệt bài cụ thể
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/review`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(reviewData),
    });
    return res.json();
  },

  uploadSubmissions: async (classId, formData) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/receive-batch`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json();
  },

  uploadStudentSubmission: async (classId, studentId, formData) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json();
  },

  addAttachments: async (classId, studentId, submissionId, formData) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (submissionId) {
      formData.append('submissionId', submissionId);
    }

    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json();
  },

  deleteAttachment: async (classId, studentId, submissionId, attachmentKey, filePath) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/attachments`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ submissionId, attachmentKey, filePath }),
    });
    return res.json();
  },

  gradeWithAI: async (classId, studentId, text, submissionId, forceReOcr = false) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/grade-ai`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, submissionId, forceReOcr }),
    });
    return res.json();
  },

  gradeAllWithAI: async (classId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/grade-all-ai`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  retrySubmission: async (classId, studentId, submissionId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/retry`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ submissionId }),
    });
    return res.json();
  },

  retryAllFailed: async (classId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/retry-failed`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  deleteSubmission: async (classId, studentId, submissionId) => {
    const res = await fetch(`${API_BASE}/classes/${classId}/submissions/${studentId}/${submissionId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  getAiProvidersStatus: async () => {
    const res = await fetch(`${API_BASE}/ai/providers-status`, {
      method: 'GET',
      headers: authHeaders(),
    });
    return res.json();
  },
};
