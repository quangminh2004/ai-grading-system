import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import bcrypt from 'bcryptjs';

// GET /api/admin/users
// Danh sách tất cả người dùng (Admin xem)
export const getAllUsers = async (req, res) => {
  try {
    const { role, school, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (school) filter.school = school;
    if (search) {
      // Thoát ký tự đặc biệt của regex để tránh ReDoS và tìm đúng chuỗi người dùng nhập
      const escaped = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { username: { $regex: escaped, $options: 'i' } },
        { school: { $regex: escaped, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Đếm số lớp thuộc từng trường / giáo viên
    const classes = await Class.find().lean();
    const usersWithStats = users.map((u) => {
      const teacherClasses = classes.filter(
        (c) => c.teacherUsername === u.username || c.school === u.school
      );
      return {
        ...u,
        classCount: teacherClasses.length,
      };
    });

    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/users/create-teacher
// Admin tạo tài khoản cho các cô giáo
export const createTeacher = async (req, res) => {
  try {
    const { username, password, fullName, school, email, phone, assignedClasses } = req.body;

    if (!username || !password || !fullName || !school) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ: Tên đăng nhập, Mật khẩu, Họ tên và Trường học.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập phải có ít nhất 3 ký tự.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.',
      });
    }

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Tên đăng nhập "${cleanUsername}" đã được sử dụng. Vui lòng chọn tên khác.`,
      });
    }

    const newTeacher = new User({
      username: cleanUsername,
      password, // pre-save hook sẽ tự hash
      fullName: fullName.trim(),
      role: 'teacher',
      school: school.trim(),
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [],
      createdBy: req.user ? req.user.username : 'admin',
    });

    await newTeacher.save();

    res.status(201).json({
      success: true,
      message: `Tạo tài khoản giáo viên cho ${fullName} thành công!`,
      user: newTeacher.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/users/:id
// Sửa thông tin tài khoản
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, school, email, phone, role, active, assignedClasses } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (fullName !== undefined) user.fullName = fullName.trim();
    if (school !== undefined) user.school = school.trim();
    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (phone !== undefined) user.phone = phone.trim();
    // Chỉ cho phép hai vai trò hợp lệ, và không ai tự đổi vai trò/khóa chính tài khoản của mình
    const isSelf = req.user && req.user._id.toString() === id;
    if (role !== undefined) {
      if (!['admin', 'teacher'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
      }
      if (isSelf && role !== user.role) {
        return res.status(400).json({
          success: false,
          message: 'Bạn không thể tự thay đổi vai trò của chính mình.',
        });
      }
      user.role = role;
    }
    if (active !== undefined) {
      if (isSelf && active === false) {
        return res.status(400).json({
          success: false,
          message: 'Bạn không thể tự khóa tài khoản của chính mình.',
        });
      }
      user.active = active;
    }
    if (assignedClasses !== undefined) user.assignedClasses = assignedClasses;

    await user.save();

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công!',
      user: user.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/users/:id/reset-password
// Admin đặt lại mật khẩu cho giáo viên
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({
      success: true,
      message: `Đã đặt lại mật khẩu cho tài khoản ${user.username}!`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/users/:id
// Xóa tài khoản
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự xóa tài khoản của chính mình!',
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({
      success: true,
      message: `Đã xóa tài khoản ${user.username} khỏi hệ thống.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/stats
// Thống kê tổng quan hệ thống
export const getAdminStats = async (req, res) => {
  try {
    const [
      teacherCount,
      adminCount,
      classes,
      studentCount,
      submissions,
      schools,
    ] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'admin' }),
      Class.find().lean(),
      Student.countDocuments(),
      Submission.find().lean(),
      User.distinct('school'),
    ]);

    const approvedCount = submissions.filter((s) => s.state === 'approved').length;
    const suggestedCount = submissions.filter((s) => s.state === 'suggested').length;
    const newCount = submissions.filter((s) => s.state === 'new').length;

    res.json({
      success: true,
      stats: {
        teachers: teacherCount,
        admins: adminCount,
        schools: schools.length,
        classes: classes.length,
        students: studentCount,
        submissions: {
          total: submissions.length,
          approved: approvedCount,
          suggested: suggestedCount,
          new: newCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// GET /api/admin/schools-summary
// Thống kê chi tiết theo từng trường học (Admin xem)
export const getSchoolsSummary = async (req, res) => {
  try {
    const [users, classes, students, submissions] = await Promise.all([
      User.find({ role: 'teacher' }).lean(),
      Class.find().lean(),
      Student.find().lean(),
      Submission.find().lean(),
    ]);

    // Lấy danh sách tên tất cả các trường
    const schoolSet = new Set();
    users.forEach((u) => u.school && schoolSet.add(u.school));
    classes.forEach((c) => c.school && schoolSet.add(c.school));

    const schoolList = Array.from(schoolSet).sort();

    const summary = schoolList.map((schoolName) => {
      const teachers = users.filter((u) => u.school === schoolName);
      const schoolClasses = classes.filter((c) => c.school === schoolName);
      const classIds = schoolClasses.map((c) => c.classId);

      const schoolStudents = students.filter((s) => classIds.includes(s.classId));
      const schoolSubmissions = submissions.filter((s) => classIds.includes(s.classId));
      const approvedSubmissions = schoolSubmissions.filter((s) => s.state === 'approved');

      return {
        school: schoolName,
        teacherCount: teachers.length,
        teachers: teachers.map((t) => ({ fullName: t.fullName, username: t.username, email: t.email, phone: t.phone })),
        classCount: schoolClasses.length,
        classes: schoolClasses.map((c) => ({ classId: c.classId, label: c.label })),
        studentCount: schoolStudents.length,
        submissionCount: schoolSubmissions.length,
        approvedCount: approvedSubmissions.length,
      };
    });

    res.json({ success: true, schools: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
