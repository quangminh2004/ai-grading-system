import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getClasses,
  createClass,
  getClassDetails,
  addStudent,
  importRoster,
  resetToSamples,
} from '../controllers/classController.js';
import {
  getAssignment,
  reviewSubmission,
  receiveUploadedFiles,
} from '../controllers/submissionController.js';

const router = express.Router();

// Cấu hình lưu trữ tệp tải lên
const uploadDir = path.resolve('uploads');
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

// Các routes cho Lớp học & Học sinh
router.get('/classes', getClasses);
router.post('/classes', createClass);
router.get('/classes/:classId/full', getClassDetails);
router.post('/classes/:classId/students', addStudent);
router.post('/classes/:classId/roster', importRoster);
router.post('/reset-samples', resetToSamples);

// Các routes cho Tiêu chí & Bài tập
router.get('/assignment', getAssignment);

// Các routes cho Bài nộp & Chấm/Duyệt
router.patch('/classes/:classId/submissions/:studentId/review', reviewSubmission);
router.post(
  '/classes/:classId/submissions/receive-batch',
  upload.array('files', 20),
  receiveUploadedFiles
);

export default router;
