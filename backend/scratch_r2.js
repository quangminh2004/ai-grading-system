// Script thử kết nối Cloudflare R2.
// KHÔNG ghi khóa trực tiếp vào file này — đọc từ biến môi trường (backend/.env).
// Chạy: node backend/scratch_r2.js
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { uploadBufferToR2, deleteFromR2, isR2Configured } from './src/services/r2StorageService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testUpload() {
  if (!isR2Configured()) {
    console.error('Thiếu R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL trong .env');
    process.exit(1);
  }

  const objectKey = 'test-r2-connect.txt';
  const url = await uploadBufferToR2(
    Buffer.from('Hello Cloudflare R2 from Thanh Lan AI!'),
    objectKey,
    'text/plain'
  );
  console.log('Đã upload:', url);

  const pubRes = await fetch(url);
  console.log('Public fetch status:', pubRes.status);
  console.log('Public fetch text:', await pubRes.text());

  await deleteFromR2(objectKey);
}

testUpload().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
