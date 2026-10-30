import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';

const JWT_SECRET = process.env.JWT_SECRET || 'thanh_lan_ai_grading_jwt_secret_key_2026_super_secure';

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này đã bị tạm khóa. Vui lòng liên hệ Admin.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        school: user.school,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng nhập: ' + error.message,
    });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }
    res.json({
      success: true,
      user: req.user.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/auth/schools
export const getSchools = async (req, res) => {
  try {
    const userSchools = await User.distinct('school');
    const classSchools = await Class.distinct('school');
    const all = Array.from(new Set([...userSchools, ...classSchools].filter(Boolean)));
    res.json({ success: true, schools: all });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

