import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getClasses,
  createClass,
  deleteClass,
  getClassDetails,
  addStudent,
  importRoster,
  updateClassRubric,
} from '../controllers/classController.js';
import {
  getAssignment,
  reviewSubmission,
  receiveUploadedFiles,
  uploadStudentSubmission,
  addAttachmentsToSubmission,
  deleteAttachmentFromSubmission,
  gradeSubmissionWithAI,
  gradeAllSubmissionsWithAI,
  retrySubmission,
  retryAllFailedSubmissions,
  getAiProvidersStatus,
  deleteSubmission,
} from '../controllers/submissionController.js';
import {
  login,
  getMe,
  changePassword,
} from '../controllers/authController.js';
import {
  getAllUsers,
  createTeacher,
  updateUser,
  resetUserPassword,
  deleteUser,
  getAdminStats,
} from '../controllers/userController.js';
import {
  getSchoolsList,
  createSchool,
  updateSchool,
  deleteSchool,
  getSchoolsSummary,
} from '../controllers/schoolController.js';
import { requireAuth, requireAdmin, requireClassAccess } from '../middleware/auth.js';

const router = express.Router();

// Thư mục lưu ảnh upload — dùng __dirname để đảm bảo đúng dù chạy từ bất kỳ đâu
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// backend/uploads (cùng cấp với src/)
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// ==================== AUTH & SCHOOLS ROUTES ====================
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getMe);
router.post('/auth/change-password', requireAuth, changePassword);
router.get('/schools', getSchoolsList);
router.post('/schools', requireAuth, requireAdmin, createSchool);
router.put('/schools/:id', requireAuth, requireAdmin, updateSchool);
router.delete('/schools/:id', requireAuth, requireAdmin, deleteSchool);

// ==================== ADMIN ROUTES ====================
router.get('/admin/users', requireAuth, requireAdmin, getAllUsers);
router.post('/admin/users/create-teacher', requireAuth, requireAdmin, createTeacher);
router.put('/admin/users/:id', requireAuth, requireAdmin, updateUser);
router.post('/admin/users/:id/reset-password', requireAuth, requireAdmin, resetUserPassword);
router.delete('/admin/users/:id', requireAuth, requireAdmin, deleteUser);
router.get('/admin/stats', requireAuth, requireAdmin, getAdminStats);
router.get('/admin/schools-summary', requireAuth, requireAdmin, getSchoolsSummary);

// ==================== LỚP HỌC & HỌC SINH ====================
// Tất cả route lớp học bắt buộc đăng nhập; route có :classId còn kiểm tra quyền với lớp đó
// (requireAuth/requireClassAccess đặt TRƯỚC multer để không ghi tệp khi chưa xác thực)
const classAccess = [requireAuth, requireClassAccess];

router.get('/classes', requireAuth, getClasses);
router.post('/classes', requireAuth, createClass);
router.delete('/classes/:classId', ...classAccess, deleteClass);
router.get('/classes/:classId/full', ...classAccess, getClassDetails);
router.post('/classes/:classId/students', ...classAccess, addStudent);
router.post('/classes/:classId/roster', ...classAccess, importRoster);
router.put('/classes/:classId/rubric', ...classAccess, updateClassRubric);

// ==================== TIÊU CHÍ & BÀI TẬP ====================
router.get('/assignment', requireAuth, getAssignment);

// ==================== BÀI NỘP & CHẤM/DUYỆT ====================
router.get('/ai/providers-status', requireAuth, getAiProvidersStatus);
router.get('/admin/ai-providers/status', requireAuth, requireAdmin, getAiProvidersStatus);

router.post(
  '/classes/:classId/submissions/receive-batch',
  ...classAccess,
  upload.array('files', 20),
  receiveUploadedFiles
);
router.post('/classes/:classId/submissions/grade-all-ai', ...classAccess, gradeAllSubmissionsWithAI);
router.post('/classes/:classId/submissions/retry-failed', ...classAccess, retryAllFailedSubmissions);

router.post(
  '/classes/:classId/submissions/:studentId/upload',
  ...classAccess,
  upload.array('files', 10),
  uploadStudentSubmission
);

// Quản lý đính kèm ảnh (Thêm / Xóa ảnh) - PHẢI ĐẶT TRƯỚC wildcard /:submissionId
router.post(
  '/classes/:classId/submissions/:studentId/attachments',
  ...classAccess,
  upload.array('files', 10),
  addAttachmentsToSubmission
);
router.delete(
  '/classes/:classId/submissions/:studentId/attachments',
  ...classAccess,
  deleteAttachmentFromSubmission
);

router.patch('/classes/:classId/submissions/:studentId/review', ...classAccess, reviewSubmission);
router.post('/classes/:classId/submissions/:studentId/grade-ai', ...classAccess, gradeSubmissionWithAI);
router.post('/classes/:classId/submissions/:studentId/retry', ...classAccess, retrySubmission);

// Xóa bài nộp (Wildcard /:submissionId) - PHẢI ĐẶT SAU CÙNG để không nuốt route /attachments
router.delete('/classes/:classId/submissions/:studentId/:submissionId', ...classAccess, deleteSubmission);
router.delete('/classes/:classId/submissions/:submissionId', ...classAccess, deleteSubmission);

export default router;
