import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'thanh_lan_ai_grading_jwt_secret_key_2026_super_secure';

// Middleware xác thực token đăng nhập
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại trên hệ thống.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
      });
    }

    req.user = user;
    req.userId = user._id;
    req.role = user.role;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc lỗi xác thực.',
    });
  }
};

// Middleware kiểm tra quyền Quản trị viên (Admin)
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền thực hiện.',
    });
  }
  next();
};

// Middleware tùy chọn (nếu có token thì gán req.user, không có thì vẫn cho qua)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.active) {
        req.user = user;
        req.userId = user._id;
        req.role = user.role;
      }
    }
  } catch (e) {
    // Không ném lỗi nếu là optional
  }
  next();
};

