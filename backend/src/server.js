import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files (sample attachments and uploads)
app.use('/samples', express.static(path.resolve('samples')));
app.use('/uploads', express.static(path.resolve('uploads')));

// Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Thanh Lân Chấm Chữa AI - Backend',
    database: 'MongoDB Atlas',
    time: new Date().toISOString(),
  });
});

// Start server after DB connection
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 BACKEND SERVER ĐANG CHẠY TẠI: http://localhost:${PORT}`);
      console.log(`📡 MongoDB Atlas: Đã kết nối thành công`);
      console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Không thể khởi động server:', error.message);
    process.exit(1);
  }
};

startServer();
