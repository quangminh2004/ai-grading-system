import { School } from '../models/School.js';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';

// Đồng bộ các tên trường học đã có từ User & Class sang collection School (nếu chưa có)
const syncExistingSchools = async () => {
  try {
    const [userSchools, classSchools] = await Promise.all([
      User.distinct('school'),
      Class.distinct('school'),
    ]);
    const allNames = Array.from(new Set([...userSchools, ...classSchools].filter(Boolean)));
    for (const name of allNames) {
      const clean = name.trim();
      if (!clean) continue;
      const exists = await School.findOne({ name: clean });
      if (!exists) {
        await School.create({
          name: clean,
          level: clean.includes('THCS') ? 'THCS' : 'Tiểu học',
        });
      }
    }
  } catch (e) {
    console.warn('School sync warning:', e.message);
  }
};

// GET /api/schools
// Lấy danh sách tên trường (cho dropdowns / autocomplete)
export const getSchoolsList = async (req, res) => {
  try {
    await syncExistingSchools();
    const schools = await School.find({ active: true }).sort({ name: 1 }).lean();
    res.json({
      success: true,
      schools: schools.map((s) => s.name),
      schoolDetails: schools,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/schools
// Admin thêm trường học mới vào cơ sở dữ liệu
export const createSchool = async (req, res) => {
  try {
    const { name, code, address, level } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên trường học không được để trống.',
      });
    }

    const cleanName = name.trim();
    const existing = await School.findOne({ name: cleanName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Trường học "${cleanName}" đã tồn tại trong hệ thống.`,
      });
    }

    const newSchool = new School({
      name: cleanName,
      code: code ? code.trim().toUpperCase() : '',
      address: address ? address.trim() : '',
      level: level ? level.trim() : 'Tiểu học',
      createdBy: req.user ? req.user.username : 'admin',
    });

    await newSchool.save();

    res.status(201).json({
      success: true,
      message: `Đã thêm trường "${cleanName}" vào cơ sở dữ liệu!`,
      school: newSchool,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/schools/:id
// Admin cập nhật thông tin trường học
export const updateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, level, active } = req.body;

    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trường học' });
    }

    const oldName = school.name;

    if (name && name.trim() && name.trim() !== oldName) {
      const cleanName = name.trim();
      const duplicate = await School.findOne({ name: cleanName, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Tên trường "${cleanName}" đã được sử dụng bởi trường khác.`,
        });
      }
      school.name = cleanName;

      // Cập nhật tên trường ở các User và Class liên quan
      await User.updateMany({ school: oldName }, { school: cleanName });
      await Class.updateMany({ school: oldName }, { school: cleanName });
    }

    if (code !== undefined) school.code = code.trim().toUpperCase();
    if (address !== undefined) school.address = address.trim();
    if (level !== undefined) school.level = level.trim();
    if (active !== undefined) school.active = active;

    await school.save();

    res.json({
      success: true,
      message: 'Cập nhật thông tin trường học thành công!',
      school,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/schools/:id
// Admin xóa trường học
export const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trường học' });
    }

    // Kiểm tra xem trường học có giáo viên hoặc lớp học nào không
    const [teacherCount, classCount] = await Promise.all([
      User.countDocuments({ school: school.name, role: 'teacher' }),
      Class.countDocuments({ school: school.name }),
    ]);

    if (teacherCount > 0 || classCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì trường "${school.name}" đang có ${teacherCount} giáo viên và ${classCount} lớp học. Hãy chuyển giáo viên/lớp sang trường khác trước.`,
      });
    }

    await School.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Đã xóa trường học "${school.name}" khỏi hệ thống.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/schools-summary
// Báo cáo chi tiết danh mục trường học & lớp học
export const getSchoolsSummary = async (req, res) => {
  try {
    await syncExistingSchools();

    const [schools, users, classes, students, submissions] = await Promise.all([
      School.find().sort({ name: 1 }).lean(),
      User.find({ role: 'teacher' }).lean(),
      Class.find().lean(),
      Student.find().lean(),
      Submission.find().lean(),
    ]);

    const summary = schools.map((sch) => {
      const teachers = users.filter((u) => u.school === sch.name);
      const schoolClasses = classes.filter((c) => c.school === sch.name);
      const classIds = schoolClasses.map((c) => c.classId);

      const schoolStudents = students.filter((s) => classIds.includes(s.classId));
      const schoolSubmissions = submissions.filter((s) => classIds.includes(s.classId));
      const approvedSubmissions = schoolSubmissions.filter((s) => s.state === 'approved');

      return {
        _id: sch._id,
        school: sch.name,
        code: sch.code || '',
        address: sch.address || '',
        level: sch.level || 'Tiểu học',
        active: sch.active,
        teacherCount: teachers.length,
        teachers: teachers.map((t) => ({
          fullName: t.fullName,
          username: t.username,
          email: t.email,
          phone: t.phone,
        })),
        classCount: schoolClasses.length,
        classes: schoolClasses.map((c) => ({
          classId: c.classId,
          label: c.label,
          grade: c.grade,
        })),
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

