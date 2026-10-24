import mongoose from 'mongoose';
import dns from 'dns';

// Fix DNS resolution on Windows for mongodb+srv SRV lookup
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('DNS server override warning:', e.message);
}

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI chưa được thiết lập trong .env');
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Atlas connected: ${conn.connection.host} [DB: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`❌ Lỗi kết nối MongoDB Atlas: ${error.message}`);
    process.exit(1);
  }
};
