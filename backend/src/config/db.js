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

// Sửa lỗi DNS trên Windows cho địa chỉ mongodb+srv
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('DNS server override warning:', e.message);
}

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI chưa được thiết lập trong file .env');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Atlas connected: ${conn.connection.host} [DB: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`\n❌ LỖI KẾT NỐI MONGODB ATLAS: ${error.message}`);
    console.error(`--------------------------------------------------------------------`);
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error(`👉 NGUYÊN NHÂN: Sai tên đăng nhập hoặc mật khẩu Database User trên Atlas.`);
      console.error(`   Vui lòng vào cloud.mongodb.com -> Database Access -> kiểm tra hoặc Edit Password.`);
    } else if (error.message.includes('whitelist') || error.message.includes('timed out') || error.message.includes('Could not connect')) {
      console.error(`👉 NGUYÊN NHÂN: IP mạng hiện tại chưa được cấp quyền trong MongoDB Atlas.`);
      console.error(`   Vui lòng vào cloud.mongodb.com -> Network Access -> Add IP Address: 0.0.0.0/0`);
    }
    console.error(`--------------------------------------------------------------------\n`);
    process.exit(1);
  }
};
