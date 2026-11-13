import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { ensureRootAdmin } from './config/initRootAdmin.js';
import { requireAuth } from './middleware/auth.js';
import { Class } from './models/Class.js';
import { Submission } from './models/Submission.js';
import { canAccessClass } from './middleware/auth.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải cấu hình từ .env: ưu tiên backend/.env trước rồi đến root .env
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });
dotenv.config({ override: false });

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
// CORS: mặc định cho phép same-origin và dev nội bộ; trong production cấu hình thêm qua CORS_ORIGINS
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (devOrigins.includes(origin) || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return cb(null, true);
    }
    return cb(null, false);
  },
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files (sample attachments and uploads)
const uploadsDir = path.resolve(__dirname, '../uploads');
const samplesDir = path.resolve(__dirname, '../samples');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/samples', express.static(samplesDir));
app.use('/samples', express.static(path.resolve('samples')));

// Ảnh bài làm của học sinh là dữ liệu nhạy cảm: chỉ phục vụ khi người dùng đã đăng nhập
// VÀ có quyền với lớp chứa bài nộp đó. Token truyền qua ?token= vì thẻ <img> không gửi được header.
app.get('/uploads/:filename', requireAuth, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const sub = await Submission.findOne({
      'attachments.filePath': { $regex: `${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
    }).lean();

    if (sub) {
      const classroom = await Class.findOne({ classId: sub.classId }).lean();
      if (!canAccessClass(req.user, classroom)) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem tệp này.' });
      }
    } else if (req.user.role !== 'admin') {
      // Tệp không thuộc bài nộp nào: chỉ Admin được xem (tránh lộ file mồ côi)
      return res.status(404).json({ success: false, message: 'Không tìm thấy tệp.' });
    }

    const candidateDirs = [uploadsDir, path.resolve('uploads'), path.resolve('backend/uploads')];
    const fileDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, filename)));
    if (!fileDir) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tệp.' });
    }
    res.sendFile(path.join(fileDir, filename));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải tệp.' });
  }
});

// Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Trợ lý Chấm & Chữa Bài AI (Đa Trường Học · RBAC Admin & Giáo Viên)',
    database: 'connected',
    time: new Date().toISOString(),
  });
});

// Phục vụ giao diện React Frontend khi chạy chung server
const frontendDistCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve('../frontend/dist'),
  path.resolve('frontend/dist'),
  path.resolve('./dist'),
];

let activeFrontendDist = frontendDistCandidates.find((dir) =>
  fs.existsSync(path.join(dir, 'index.html'))
);

if (activeFrontendDist) {
  console.log(`📦 Đã kích hoạt phục vụ giao diện Web từ: ${activeFrontendDist}`);
  app.use(express.static(activeFrontendDist));

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/samples') ||
      req.path.startsWith('/uploads') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(activeFrontendDist, 'index.html'));
  });
}

// Khởi động máy chủ sau khi kết nối cơ sở dữ liệu MongoDB Atlas
const startServer = async () => {
  try {
    await connectDB();
    await ensureRootAdmin();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 HỆ THỐNG TRỢ LÝ CHẤM CHỮA BÀI AI`);
      console.log(`🌐 Web App & API: http://0.0.0.0:${PORT}`);
      console.log(`📡 Cơ sở dữ liệu: Đã kết nối trực tuyến`);
      console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`⚠️ Cổng ${PORT} đang có tiến trình khác sử dụng. Đang chờ giải phóng cổng...`);
      } else {
        console.error('Lỗi máy chủ:', err.message);
      }
    });
  } catch (error) {
    console.error('Không thể khởi động server:', error.message);
    process.exit(1);
  }
};

startServer();
