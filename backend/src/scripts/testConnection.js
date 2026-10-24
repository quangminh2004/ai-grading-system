import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Fix for Windows querySrv ECONNREFUSED when local DNS doesn't resolve SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Cannot set custom DNS:', e.message);
}

dotenv.config();

const uri = process.env.MONGODB_URI;

console.log('Testing connection to MongoDB Atlas...');
console.log('URI prefix:', uri.split('@')[1] ? '...@' + uri.split('@')[1] : 'Invalid URI');

try {
  await mongoose.connect(uri);
  console.log('✅ KẾT NỐI MONGODB ATLAS THÀNH CÔNG!');
  console.log('Database name:', mongoose.connection.name);
  console.log('Host:', mongoose.connection.host);
  await mongoose.disconnect();
  console.log('Đã đóng kết nối an toàn.');
  process.exit(0);
} catch (error) {
  console.error('❌ LỖI KẾT NỐI MONGODB ATLAS:', error.message);
  if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
    console.error('-> Sai username hoặc password.');
  } else if (error.message.includes('querySrv ETIMEOUT') || error.message.includes('ETIMEDOUT') || error.message.includes('whitelist')) {
    console.error('-> Lỗi mạng hoặc IP của bạn chưa được cấp phép trong Network Access (0.0.0.0/0) trên Atlas.');
  }
  process.exit(1);
}
