import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đảm bảo nạp đầy đủ .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const connectDB = async () => {
  try {
    const uri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      process.env.MONGODB_URL ||
      process.env.MONGO_PRIVATE_URL ||
      process.env.DATABASE_URL;

    if (!uri) {
      throw new Error(
        'Chưa cấu hình MONGODB_URI hoặc MONGO_URL. Vui lòng thêm biến môi trường MONGODB_URI hoặc liên kết dịch vụ MongoDB trên Railway.'
      );
    }

    // Chỉ ghi đè DNS server trên Windows cục bộ khi kết nối mongodb+srv://
    // Tuyệt đối không ghi đè trên môi trường Linux / Railway vì sẽ làm hỏng DNS nội bộ (*.railway.internal)
    if (process.platform === 'win32' && !process.env.RAILWAY_ENVIRONMENT && uri.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (e) {
        console.warn('DNS server override warning:', e.message);
      }
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host} [DB: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`\n❌ LỖI KẾT NỐI MONGODB: ${error.message}`);
    console.error(`--------------------------------------------------------------------`);
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error(`👉 NGUYÊN NHÂN: Sai tên đăng nhập hoặc mật khẩu Database User.`);
    } else if (error.message.includes('whitelist') || error.message.includes('timed out') || error.message.includes('Could not connect')) {
      console.error(`👉 NGUYÊN NHÂN: Chưa kết nối được tới host MongoDB hoặc IP chưa được cấp quyền.`);
    }
    console.error(`--------------------------------------------------------------------\n`);
    process.exit(1);
  }
};
