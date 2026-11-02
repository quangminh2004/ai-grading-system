import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { Student } from '../models/Student.js';
import { autoGradeSubmission } from '../services/aiGradingService.js';

// GET /api/assignment
export const getAssignment = async (req, res) => {
  try {
    let assignment = await Assignment.findOne();
    if (!assignment) {
      assignment = await Assignment.create({});
    }
    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/classes/:classId/submissions/:studentId/review
// GV duyệt bài theo submissionId cụ thể (hoặc bài mới nhất nếu không có)
export const reviewSubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const {
      state,
      teacherScores,
      teacherFeedback,
      reason,
      text,
      scores,
      explain,
      errors,
      strength,
      evidence,
      support,
      activity,
      submissionId, // ID cụ thể của bài muốn duyệt (optional)
    } = req.body;

    // Nếu có submissionId cụ thể thì duyệt bài đó, không thì lấy bài mới nhất
    let sub;
    if (submissionId) {
      sub = await Submission.findById(submissionId);
    } else {
      // Lấy bài suggested mới nhất, hoặc bài mới nhất
      sub = await Submission.findOne({ classId, studentId, state: 'suggested' }).sort({ submissionNumber: -1 })
        || await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp' });
    }

    if (state !== undefined) sub.state = state;
    if (teacherScores !== undefined) sub.teacherScores = teacherScores;
    if (teacherFeedback !== undefined) sub.teacherFeedback = teacherFeedback;
    if (reason !== undefined) sub.reason = reason;
    if (text !== undefined) sub.text = text;
    if (scores !== undefined) sub.scores = scores;
    if (explain !== undefined) sub.explain = explain;
    if (errors !== undefined) sub.errors = errors;
    if (strength !== undefined) sub.strength = strength;
    if (evidence !== undefined) sub.evidence = evidence;
    if (support !== undefined) sub.support = support;
    if (activity !== undefined) sub.activity = activity;

    // Ghi nhật ký thao tác (audit log)
    const logEntry = {
      at: new Date(),
      action: state === 'approved' ? 'approved' : 'edited',
      scores: teacherScores || sub.scores,
      reason: reason || (state === 'approved' ? 'Giáo viên duyệt kết quả' : 'Chỉnh sửa'),
    };
    sub.logs.push(logEntry);

    await sub.save();

    res.json({
      success: true,
      message: 'Cập nhật và lưu kết quả thành công',
      submission: sub,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/:studentId/upload
// Tải lên trực tiếp 1 hoặc nhiều tệp bài làm cho 1 học sinh cụ thể (không cần khớp tên file)
export const uploadStudentSubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    let files = req.files || [];
    if (!files.length && req.file) files = [req.file];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Chưa chọn tệp ảnh/PDF nào để tải lên' });
    }

    const student = await Student.findOne({ classId, studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh trong lớp' });
    }

    const existingCount = await Submission.countDocuments({ classId, studentId });
    const submissionNumber = existingCount + 1;

    const sub = new Submission({
      classId,
      studentId,
      state: 'new',
      custom: true,
      submissionNumber,
      submissionLabel: submissionNumber === 1 ? 'Bài nộp' : `Bài nộp lần ${submissionNumber}`,
    });

    for (const file of files) {
      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
      });
    }

    console.log(`📥 Upload trực tiếp cho ${studentId} (${student.name}) - ${files.length} tệp. Chấm AI...`);

    // Tự động kích hoạt AI chấm bài ngay
    await autoGradeSubmission(sub);
    await sub.save();

    res.json({
      success: true,
      message: `Đã nạp bài cho em ${student.name} (${submissionNumber === 1 ? 'Bài nộp đầu tiên' : `Bài nộp lần ${submissionNumber}`}) và AI đã chấm xong!`,
      submission: sub,
    });
  } catch (error) {
    console.error('Lỗi uploadStudentSubmission:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/receive-batch
// Nhận tệp từ upload — MỖI LẦN UPLOAD TẠO BÀI NỘP MỚI (không ghi đè bài cũ)
export const receiveUploadedFiles = async (req, res) => {
  try {
    const { classId } = req.params;
    const files = req.files || [];
    const mapping = JSON.parse(req.body.mapping || '{}'); // { [filename]: studentId }

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên' });
    }

    let processed = 0;

    for (const file of files) {
      const studentId = mapping[file.originalname];
      if (!studentId) {
        console.log(`⚠️ Không tìm thấy học sinh cho tệp: ${file.originalname}`);
        continue;
      }

      // Đếm số bài đã nộp của học sinh này để tạo submissionNumber tăng dần
      const existingCount = await Submission.countDocuments({ classId, studentId });
      const submissionNumber = existingCount + 1;

      // TẠO BÀI NỘP MỚI — không ghi đè bài cũ
      const sub = new Submission({
        classId,
        studentId,
        state: 'new',
        custom: true,
        submissionNumber,
        submissionLabel: submissionNumber === 1 ? 'Bài nộp' : `Bài nộp lại lần ${submissionNumber - 1}`,
      });

      // Thêm tệp đính kèm
      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
      });

      console.log(`📥 Tạo bài nộp ${submissionNumber} cho ${studentId} — file: ${file.originalname} → ${file.filename}`);

      // TỰ ĐỘNG CHẤM & ĐỀ XUẤT ĐIỂM BẰNG AI
      await autoGradeSubmission(sub);

      await sub.save();
      processed++;
    }

    if (processed === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có tệp nào được ghép với học sinh. Hãy chọn học sinh tương ứng cho từng tệp.',
      });
    }

    res.json({
      success: true,
      message: `Đã tiếp nhận ${processed} bài nộp mới và AI đã hoàn tất chấm, đề xuất điểm!`,
    });
  } catch (error) {
    console.error('Lỗi receive-batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/:studentId/grade-ai
// Kích hoạt AI chấm điểm — theo submissionId cụ thể hoặc bài mới nhất
export const gradeSubmissionWithAI = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { text, submissionId } = req.body;

    let sub;
    if (submissionId) {
      sub = await Submission.findById(submissionId);
    } else {
      // Lấy bài suggested mới nhất hoặc bài mới nhất
      sub = await Submission.findOne({ classId, studentId, state: { $in: ['new', 'suggested'] } })
        .sort({ submissionNumber: -1 });
    }

    // Nếu không có bài và cũng không có text gửi lên → báo lỗi rõ ràng
    if (!sub && !text) {
      return res.status(400).json({
        success: false,
        message: 'Học sinh này chưa có bài làm. Vui lòng upload ảnh bài hoặc nhập văn bản trước.',
      });
    }

    // Nếu có text nhưng không có submission → tạo mới
    if (!sub) {
      const existingCount = await Submission.countDocuments({ classId, studentId });
      sub = new Submission({
        classId,
        studentId,
        state: 'new',
        custom: true,
        submissionNumber: existingCount + 1,
        submissionLabel: existingCount === 0 ? 'Bài nộp' : `Bài nộp lại lần ${existingCount}`,
      });
    }

    // Nếu không có text mới và bài không có text lẫn attachment → báo lỗi
    if (!text && !sub.text?.trim() && (!sub.attachments || sub.attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Chưa có bài làm để chấm. Vui lòng upload ảnh bài hoặc nhập văn bản trước.',
      });
    }

    if (text !== undefined) {
      sub.text = text;
    }

    await autoGradeSubmission(sub);
    await sub.save();

    res.json({
      success: true,
      message: 'AI đã chấm và đề xuất điểm bài làm thành công!',
      submission: sub,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/grade-all-ai
// Kích hoạt AI chấm toàn bộ bài trong lớp (bài chưa duyệt, bài mới nhất của mỗi HS)
export const gradeAllSubmissionsWithAI = async (req, res) => {
  try {
    const { classId } = req.params;

    // Lấy tất cả học sinh của lớp
    const students = await Student.find({ classId }).lean();
    let count = 0;

    for (const std of students) {
      // Lấy bài mới nhất chưa duyệt của học sinh
      const sub = await Submission.findOne({
        classId,
        studentId: std.studentId,
        state: { $in: ['new', 'suggested'] },
      }).sort({ submissionNumber: -1 });

      if (sub && (sub.text?.trim() || sub.attachments?.length > 0)) {
        await autoGradeSubmission(sub);
        await sub.save();
        count++;
      }
    }

    res.json({
      success: true,
      message: `AI đã chấm xong ${count} bài làm trong lớp!`,
      count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
