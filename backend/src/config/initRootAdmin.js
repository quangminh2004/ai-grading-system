import { User } from '../models/User.js';
import { Assignment } from '../models/Assignment.js';
import { Class } from '../models/Class.js';
import { runSeed } from '../scripts/seed.js';

export const ensureRootAdmin = async () => {
  try {
    const classCount = await Class.countDocuments();
    if (classCount === 0) {
      console.log('🌱 Cơ sở dữ liệu mới khởi tạo: Đang tự động nạp dữ liệu mẫu ban đầu (Lớp học, Giáo viên, Học sinh)...');
      await runSeed();
      console.log('✅ Đã nạp thành công dữ liệu mẫu vào cơ sở dữ liệu!');
      return;
    }

    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      console.log('📌 Chưa có tài khoản Admin, đang khởi tạo tài khoản Quản trị viên chính thức...');
      const rootAdmin = new User({
        username: 'admin',
        password: 'admin@123',
        fullName: 'Quản trị viên Hệ thống',
        role: 'admin',
        school: 'Phòng Giáo dục & Đào tạo',
        email: 'admin@giaoduc.edu.vn',
        active: true,
      });
      await rootAdmin.save();
      console.log('✅ Đã tạo tài khoản Admin mặc định: admin / admin@123');
    }

    const assignmentCount = await Assignment.countDocuments();
    if (assignmentCount === 0) {
      await Assignment.create({
        title: 'Viết đoạn văn ngắn miêu tả một cây bóng mát hoặc cây hoa/cây ăn quả',
        subject: 'Tiếng Việt 4',
        grade: '4',
      });
      console.log('✅ Đã tạo khung tiêu chí chấm chuẩn.');
    }
  } catch (error) {
    console.error('Lỗi khởi tạo tài khoản Admin gốc:', error.message);
  }
};

