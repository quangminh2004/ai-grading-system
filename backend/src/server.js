import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { ensureRootAdmin } from './config/initRootAdmin.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải cấu hình từ .env từ nhiều vị trí khả dĩ để đảm bảo tương thích khi deploy
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: '*' }));
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
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(path.resolve('uploads')));

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
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 HỆ THỐNG TRỢ LÝ CHẤM CHỮA BÀI AI`);
      console.log(`🌐 Web App & API: http://localhost:${PORT}`);
      console.log(`📡 Cơ sở dữ liệu: Đã kết nối trực tuyến`);
      console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
      console.log(`👑 Đăng nhập Admin: admin / admin@123`);
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
