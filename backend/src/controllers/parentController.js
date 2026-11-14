import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import { Submission } from '../models/Submission.js';
import { DEFAULT_RUBRIC, getSubmissionRubric } from '../config/rubric.js';

const normalizeStudentIds = (studentIds) => {
  if (!Array.isArray(studentIds)) return [];
  return [
    ...new Set(
      studentIds
        .map((id) => (typeof id === 'string' ? id.trim().toUpperCase() : ''))
        .filter(Boolean)
    ),
  ];
};

const parentInClassFilter = (classId) => ({
  role: 'parent',
  children: { $elemMatch: { classId } },
});

const toParentSafeJSON = (user, classId) => {
  const safe = user.toSafeJSON ? user.toSafeJSON() : user;
  const childrenInClass = (safe.children || []).filter((c) => c.classId === classId);
  return {
    id: safe._id?.toString?.() || safe.id,
    username: safe.username,
    fullName: safe.fullName,
    phone: safe.phone || '',
    email: safe.email || '',
    active: safe.active,
    school: safe.school,
    children: childrenInClass,
    createdAt: safe.createdAt,
  };
};

// POST /api/classes/:classId/parents
export const createParentForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { username, password, fullName, phone, studentIds } = req.body;
    const classroom = req.classroom;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ: Tên đăng nhập, Mật khẩu và Họ tên.',
      });
    }

    const ids = normalizeStudentIds(studentIds);
    if (!ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một học sinh để gắn với phụ huynh.',
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

    const students = await Student.find({ classId, studentId: { $in: ids } }).lean();
    if (students.length !== ids.length) {
      const found = new Set(students.map((s) => s.studentId));
      const missing = ids.filter((id) => !found.has(id));
      return res.status(400).json({
        success: false,
        message: `Học sinh không thuộc lớp này: ${missing.join(', ')}`,
      });
    }

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Tên đăng nhập "${cleanUsername}" đã được sử dụng. Vui lòng chọn tên khác.`,
      });
    }

    const parent = new User({
      username: cleanUsername,
      password,
      fullName: fullName.trim(),
      role: 'parent',
      school: classroom.school || req.user.school || 'Trường Tiểu học Thanh Lân',
      phone: phone ? String(phone).trim() : '',
      assignedClasses: [],
      children: ids.map((studentId) => ({ classId, studentId })),
      createdBy: req.user?.username || 'system',
    });

    await parent.save();

    res.status(201).json({
      success: true,
      message: `Tạo tài khoản phụ huynh cho ${fullName.trim()} thành công!`,
      parent: toParentSafeJSON(parent, classId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/classes/:classId/parents
export const listParentsForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const parents = await User.find(parentInClassFilter(classId)).sort({ fullName: 1 });
    res.json({
      success: true,
      parents: parents.map((p) => toParentSafeJSON(p, classId)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/classes/:classId/parents/:userId
// Cập nhật danh sách con trong phạm vi lớp này; giữ nguyên con ở lớp khác.
export const updateParentChildrenForClass = async (req, res) => {
  try {
    const { classId, userId } = req.params;
    const { studentIds, fullName, phone, active } = req.body;

    const parent = await User.findById(userId);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản phụ huynh.' });
    }

    const hasChildInClass = (parent.children || []).some((c) => c.classId === classId);
    if (!hasChildInClass && studentIds === undefined) {
      return res.status(404).json({
        success: false,
        message: 'Phụ huynh này chưa gắn với học sinh nào trong lớp.',
      });
    }

    if (studentIds !== undefined) {
      const ids = normalizeStudentIds(studentIds);
      if (ids.length) {
        const students = await Student.find({ classId, studentId: { $in: ids } }).lean();
        if (students.length !== ids.length) {
          const found = new Set(students.map((s) => s.studentId));
          const missing = ids.filter((id) => !found.has(id));
          return res.status(400).json({
            success: false,
            message: `Học sinh không thuộc lớp này: ${missing.join(', ')}`,
          });
        }
      }

      const otherChildren = (parent.children || []).filter((c) => c.classId !== classId);
      parent.children = [
        ...otherChildren,
        ...ids.map((studentId) => ({ classId, studentId })),
      ];
    }

    if (fullName !== undefined) parent.fullName = String(fullName).trim();
    if (phone !== undefined) parent.phone = String(phone).trim();
    if (active !== undefined) parent.active = Boolean(active);

    await parent.save();

    res.json({
      success: true,
      message: 'Cập nhật phụ huynh thành công!',
      parent: toParentSafeJSON(parent, classId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/parents/:userId/reset-password
export const resetParentPasswordForClass = async (req, res) => {
  try {
    const { classId, userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    const parent = await User.findById(userId);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản phụ huynh.' });
    }

    const hasChildInClass = (parent.children || []).some((c) => c.classId === classId);
    if (!hasChildInClass) {
      return res.status(403).json({
        success: false,
        message: 'Phụ huynh này không thuộc lớp của bạn.',
      });
    }

    parent.password = String(newPassword);
    await parent.save();

    res.json({
      success: true,
      message: `Đã đặt lại mật khẩu cho phụ huynh ${parent.fullName}.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/parent/me/children
export const getMyChildren = async (req, res) => {
  try {
    const links = Array.isArray(req.user.children) ? req.user.children : [];
    if (!links.length) {
      return res.json({ success: true, children: [] });
    }

    const classIds = [...new Set(links.map((c) => c.classId))];
    const studentKeys = links.map((c) => ({ classId: c.classId, studentId: c.studentId }));

    const [classes, students] = await Promise.all([
      Class.find({ classId: { $in: classIds } }).lean(),
      Student.find({
        $or: studentKeys.map((k) => ({ classId: k.classId, studentId: k.studentId })),
      }).lean(),
    ]);

    const classMap = Object.fromEntries(classes.map((c) => [c.classId, c]));
    const studentMap = Object.fromEntries(
      students.map((s) => [`${s.classId}::${s.studentId}`, s])
    );

    const children = links.map((link) => {
      const student = studentMap[`${link.classId}::${link.studentId}`];
      const classroom = classMap[link.classId];
      return {
        classId: link.classId,
        studentId: link.studentId,
        studentName: student?.name || link.studentId,
        classLabel: classroom?.label || link.classId,
        school: classroom?.school || req.user.school || '',
      };
    });

    res.json({ success: true, children });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sumScores = (scores) =>
  (Array.isArray(scores) ? scores : []).reduce((s, n) => s + (Number(n) || 0), 0);

// GET /api/parent/children/:classId/:studentId/grades
export const getChildGrades = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const sid = String(studentId).trim().toUpperCase();

    const [student, classroom, submissions] = await Promise.all([
      Student.findOne({ classId, studentId: sid }).lean(),
      Class.findOne({ classId }).lean(),
      Submission.find({ classId, studentId: sid, state: 'approved' })
        .sort({ submissionNumber: 1, updatedAt: 1 })
        .lean(),
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy học sinh.',
      });
    }

    const grades = submissions.map((sub) => {
      const rubricFull = getSubmissionRubric(sub, classroom?.rubric) || DEFAULT_RUBRIC;
      const rubric = rubricFull.map((r) => ({ name: r.name, max: r.max }));
      const teacherScores = Array.isArray(sub.teacherScores) ? sub.teacherScores : [];
      return {
        submissionNumber: sub.submissionNumber,
        submissionLabel: sub.submissionLabel || `Bài nộp ${sub.submissionNumber}`,
        updatedAt: sub.updatedAt,
        rubric,
        teacherScores,
        total: sumScores(teacherScores),
        teacherFeedback: sub.teacherFeedback || '',
      };
    });

    res.json({
      success: true,
      child: {
        classId,
        studentId: sid,
        studentName: student.name,
        classLabel: classroom?.label || classId,
      },
      grades,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
