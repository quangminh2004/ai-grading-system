import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { isValidVietnameseText } from '../services/aiGradingService.js';
import { getEffectiveRubric, getSubmissionRubric, validateRubric } from '../config/rubric.js';

/** Bỏ dấu tiếng Việt, lấy slug ngắn từ tên trường (vd: "Trường Tiểu học Yên Nghĩa" → "YENNGHIA"). */
export function toSchoolSlug(schoolName) {
  const raw = String(schoolName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase();
  const withoutPrefix = raw
    .replace(/^TRUONG\s+TIEU\s+HOC\s+/i, '')
    .replace(/^TRUONG\s+/i, '')
    .replace(/[^A-Z0-9]+/g, '');
  return (withoutPrefix || 'TRUONG').slice(0, 12);
}

function sameSchool(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

/**
 * classId phải unique toàn hệ thống (routing + học sinh), nhưng mỗi trường
 * được dùng cùng mã ngắn (4A, 5B…). Nếu mã đã thuộc trường khác → gắn hậu tố trường.
 */
export async function resolveUniqueClassId(preferredId, schoolName) {
  const slug = toSchoolSlug(schoolName);
  const namespaced = `${preferredId}-${slug}`;
  const dupMsg = `Mã lớp ${preferredId} đã tồn tại trong trường của bạn. Vui lòng chọn mã khác.`;

  // Trùng trong cùng trường (kể cả mã đã gắn hậu tố kiểu 4A-YENNGHIA)
  const schoolClasses = await Class.find({ school: schoolName }).select('classId').lean();
  const alreadyInSchool = schoolClasses.some((c) => {
    const id = String(c.classId || '').toUpperCase();
    return id === preferredId || id === namespaced || id.startsWith(namespaced);
  });
  if (alreadyInSchool) {
    return { error: dupMsg };
  }

  const taken = await Class.findOne({ classId: preferredId }).lean();
  if (!taken) {
    return { classId: preferredId };
  }
  if (sameSchool(taken.school, schoolName)) {
    return { error: dupMsg };
  }

  // Trường khác đã dùng mã này → tạo mã hệ thống gắn slug trường
  let finalId = namespaced;
  let n = 2;
  while (await Class.findOne({ classId: finalId }).lean()) {
    finalId = `${namespaced}${n++}`;
  }
  return { classId: finalId, remapped: true, preferredId };
}

// GET /api/classes
// Admin: xem tất cả (có thể lọc ?school=). Giáo viên: chỉ lớp thuộc trường mình, lớp mình tạo hoặc được phân công.
export const getClasses = async (req, res) => {
  try {
    const { school } = req.query;
    let filter = {};

    if (req.user.role === 'admin') {
      if (school) filter.school = school;
    } else {
      const or = [{ teacherUsername: req.user.username }];
      if (req.user.school) or.push({ school: req.user.school });
      if (Array.isArray(req.user.assignedClasses) && req.user.assignedClasses.length) {
        or.push({ classId: { $in: req.user.assignedClasses } });
      }
      filter = { $or: or };
    }

    const classes = await Class.find(filter).sort({ classId: 1 }).lean();

    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes
export const createClass = async (req, res) => {
  try {
    const { classId, label, grade, school } = req.body;
    if (!classId || !label) {
      return res.status(400).json({ success: false, message: 'Thiếu mã lớp hoặc tên lớp' });
    }
    const preferredId = classId.trim().toUpperCase();

    // Giáo viên chỉ được tạo lớp trong trường của mình; Admin được chọn trường
    const schoolName = req.user.role === 'admin'
      ? (school || req.user.school || 'Trường Tiểu học Thanh Lân').trim()
      : (req.user.school || 'Trường Tiểu học Thanh Lân').trim();

    const resolved = await resolveUniqueClassId(preferredId, schoolName);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const newClass = await Class.create({
      classId: resolved.classId,
      label: label.trim(),
      grade: grade || '4',
      school: schoolName,
      teacherUsername: req.user.username,
    });

    res.status(201).json({ success: true, class: newClass });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mã lớp đã tồn tại. Vui lòng chọn mã khác.',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/classes/:classId
export const deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const deleted = await Class.findOneAndDelete({ classId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }

    // Xóa các học sinh và bài nộp liên quan
    await Student.deleteMany({ classId });
    await Submission.deleteMany({ classId });

    res.json({
      success: true,
      message: `Đã xóa lớp ${deleted.label} (${classId}) và toàn bộ dữ liệu bài nộp liên quan.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/classes/:classId/full
// Returns class info + all students with their submissions (nhiều bài mỗi học sinh)
export const getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    const classroom = await Class.findOne({ classId }).lean();
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
    }

    const students = await Student.find({ classId }).sort({ studentId: 1 }).lean();
    // Lấy TẤT CẢ submissions của lớp, sắp xếp theo submissionNumber tăng dần
    const allSubmissions = await Submission.find({ classId }).sort({ submissionNumber: 1 }).lean();

    // Tự động rà soát và làm sạch dữ liệu rác Tesseract OCR cũ hoặc lỗi kỹ thuật cũ
    for (const s of allSubmissions) {
      let needsDbUpdate = false;
      const updateFields = {};

      if (s.text && !isValidVietnameseText(s.text)) {
        console.warn(`[Data Cleanup] Làm sạch văn bản rác OCR cũ ở bài nộp ${s._id} (${s.studentId})`);
        s.text = '';
        updateFields.text = '';
        needsDbUpdate = true;
      }

      if (s.state === 'provider_unavailable' || s.state === 'failed') {
        s.state = (s.scores && s.scores.length > 0) ? 'suggested' : 'needs_review';
        s.errorDetails = null;
        updateFields.state = s.state;
        updateFields.errorDetails = null;
        needsDbUpdate = true;
      }

      const hasErrorPattern = (val) => {
        if (!val || typeof val !== 'string') return false;
        return /gián đoạn|PERMISSION_DENIED|credit|quota|Billing|Sự cố AI/i.test(val);
      };

      if (hasErrorPattern(s.support)) {
        s.support = 'Ảnh bài làm đã được lưu an toàn. Cô giáo có thể bấm "✎ Chỉnh sửa & Duyệt bài" để chấm điểm hoặc bấm "✏️ Sửa văn bản bài làm" để nhập bài.';
        updateFields.support = s.support;
        needsDbUpdate = true;
      }

      if (hasErrorPattern(s.feedback)) {
        s.feedback = 'Bài làm của học sinh đã được lưu trữ an toàn trên hệ thống.';
        updateFields.feedback = s.feedback;
        needsDbUpdate = true;
      }

      if (hasErrorPattern(s.reason)) {
        s.reason = '';
        updateFields.reason = '';
        needsDbUpdate = true;
      }

      if (s.errorDetails) {
        s.errorDetails = null;
        updateFields.errorDetails = null;
        needsDbUpdate = true;
      }

      if (needsDbUpdate) {
        Submission.updateOne({ _id: s._id }, { $set: updateFields }).catch(() => {});
      }
    }

    // Gộp submissions vào từng học sinh — mỗi học sinh có mảng submissions[]
    const classRubric = getEffectiveRubric(classroom);
    const mergedStudents = students.map((std) => {
      const subs = allSubmissions.filter((s) => s.studentId === std.studentId);

      // Bài "đang hoạt động" = bài approved mới nhất, hoặc bài suggested mới nhất, hoặc bài cuối
      const activeSub = subs.find((s) => s.state === 'approved')
        || subs.find((s) => s.state === 'suggested')
        || subs[subs.length - 1]
        || {};

      return {
        id: std.studentId,
        studentMongoId: std._id,
        name: std.name,
        // Dữ liệu từ bài active (để tương thích giao diện cũ)
        submissionId: activeSub._id,
        state: activeSub.state || 'new',
        rubric: getSubmissionRubric(activeSub, classRubric),
        text: activeSub.text || '',
        scores: activeSub.scores || [],
        explain: activeSub.explain || [],
        errors: activeSub.errors || [],
        strength: activeSub.strength || '',
        evidence: activeSub.evidence || '',
        support: activeSub.support || '',
        activity: activeSub.activity || '',
        feedback: activeSub.feedback || '',
        teacherScores: activeSub.teacherScores || null,
        teacherFeedback: activeSub.teacherFeedback || '',
        reason: activeSub.reason || '',
        attachments: activeSub.attachments || [],
        logs: activeSub.logs || [],
        sample: activeSub.sample || false,
        custom: activeSub.custom !== undefined ? activeSub.custom : true,
        // Mảng TẤT CẢ bài nộp của học sinh này
        allSubmissions: subs.map((s) => ({
          _id: s._id,
          submissionNumber: s.submissionNumber || 1,
          submissionLabel: s.submissionLabel || `Bài nộp ${s.submissionNumber || 1}`,
          state: s.state,
          rubric: getSubmissionRubric(s, classRubric),
          scores: s.scores || [],
          teacherScores: s.teacherScores || null,
          text: s.text || '',
          attachments: s.attachments || [],
          logs: s.logs || [],
          createdAt: s.createdAt,
          explain: s.explain || [],
          errors: s.errors || [],
          strength: s.strength || '',
          evidence: s.evidence || '',
          support: s.support || '',
          activity: s.activity || '',
          feedback: s.feedback || '',
          teacherFeedback: s.teacherFeedback || '',
        })),
      };
    });

    res.json({
      success: true,
      classroom: { ...classroom, rubric: classRubric, hasCustomRubric: Boolean(classroom.rubric?.length) },
      students: mergedStudents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/classes/:classId/rubric
// Giáo viên tùy chỉnh bộ tiêu chí đánh giá của lớp (thêm/bớt/sửa tiêu chí, đổi điểm tối đa)
// Gửi { reset: true } để quay về bộ tiêu chí mặc định
export const updateClassRubric = async (req, res) => {
  try {
    const { classId } = req.params;
    const { rubric, reset } = req.body || {};

    let newRubric = [];
    if (!reset) {
      const result = validateRubric(rubric);
      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }
      newRubric = result.rubric;
    }

    const updated = await Class.findOneAndUpdate(
      { classId },
      { $set: { rubric: newRubric } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }

    const effective = getEffectiveRubric(updated);
    const totalMax = effective.reduce((s, r) => s + r.max, 0);
    res.json({
      success: true,
      message: reset
        ? '✓ Đã khôi phục bộ tiêu chí mặc định.'
        : `✓ Đã lưu ${effective.length} tiêu chí đánh giá (tổng ${totalMax} điểm).`,
      rubric: effective,
      hasCustomRubric: newRubric.length > 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/students
export const addStudent = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, studentId } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Tên học sinh không được để trống' });
    }

    const classroom = await Class.findOne({ classId });
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Lớp không tồn tại' });
    }

    let finalId = studentId ? studentId.trim().toUpperCase() : '';
    if (!finalId) {
      const currentCount = await Student.countDocuments({ classId });
      finalId = `HS${String(currentCount + 1).padStart(2, '0')}`;
    }

    const exists = await Student.findOne({ classId, studentId: finalId });
    if (exists) {
      return res.status(400).json({ success: false, message: `Mã học sinh ${finalId} đã tồn tại trong lớp` });
    }

    const student = await Student.create({
      studentId: finalId,
      name: name.trim(),
      classId,
    });

    const defaultAssignment = await Assignment.findOne();
    const submission = await Submission.create({
      studentId: finalId,
      classId,
      assignmentId: defaultAssignment?._id,
      state: 'new',
      text: '',
      scores: [],
      explain: [],
      errors: [],
      attachments: [],
      custom: true,
    });

    res.status(201).json({
      success: true,
      student: {
        id: student.studentId,
        studentMongoId: student._id,
        name: student.name,
        submissionId: submission._id,
        state: 'new',
        scores: [],
        explain: [],
        errors: [],
        attachments: [],
        logs: [],
        custom: true,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/roster
// Nhập danh sách học sinh nhiều dòng
export const importRoster = async (req, res) => {
  try {
    const { classId } = req.params;
    const { rawNames } = req.body;

    if (!rawNames || typeof rawNames !== 'string') {
      return res.status(400).json({ success: false, message: 'Danh sách họ tên không hợp lệ' });
    }

    const lines = rawNames
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const defaultAssignment = await Assignment.findOne();
    let createdCount = 0;

    for (const line of lines) {
      let sId = '';
      let sName = line;

      // check if line starts with code like HS01 - Nguyen Van A or HS01 Nguyen Van A
      const match = line.match(/^([A-Za-z0-9_-]+)[\s:,\t-]+(.+)$/);
      if (match) {
        sId = match[1].trim().toUpperCase();
        sName = match[2].trim();
      }

      if (!sId) {
        const currentCount = await Student.countDocuments({ classId });
        sId = `HS${String(currentCount + 1).padStart(2, '0')}`;
      }

      try {
        await Student.create({
          studentId: sId,
          name: sName,
          classId,
        });

        await Submission.create({
          studentId: sId,
          classId,
          assignmentId: defaultAssignment?._id,
          state: 'new',
          text: '',
          scores: [],
          explain: [],
          errors: [],
          attachments: [],
          custom: true,
        });
        createdCount++;
      } catch (e) {
        // skip duplicate ID
      }
    }

    res.json({ success: true, message: `Đã thêm ${createdCount} học sinh`, count: createdCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
