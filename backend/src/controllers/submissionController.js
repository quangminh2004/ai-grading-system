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
// GV duyệt bài, sửa điểm, ghi nhận xét và ghi audit log
export const reviewSubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const {
      state, // 'approved' | 'suggested' | 'new'
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
    } = req.body;

    let sub = await Submission.findOne({ classId, studentId });
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

// POST /api/classes/:classId/submissions/receive-batch
// Nhận tệp từ upload, ghép với học sinh và tự động kích hoạt AI chấm & đề xuất điểm
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
      if (!studentId) continue;

      let sub = await Submission.findOne({ classId, studentId });
      if (!sub) {
        sub = new Submission({
          classId,
          studentId,
          state: 'new',
          custom: true,
        });
      }

      // Thêm attachment
      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
      });

      // TỰ ĐỘNG CHẤM & ĐỀ XUẤT ĐIỂM BẰNG AI
      await autoGradeSubmission(sub);

      await sub.save();
      processed++;
    }

    res.json({
      success: true,
      message: `Đã tiếp nhận ${processed} bài và AI đã hoàn tất chấm, đề xuất điểm!`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/:studentId/grade-ai
// Kích hoạt AI chấm điểm cho một học sinh cụ thể
export const gradeSubmissionWithAI = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { text } = req.body;

    let sub = await Submission.findOne({ classId, studentId });
    if (!sub) {
      sub = new Submission({
        classId,
        studentId,
        state: 'new',
        custom: true,
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
// Kích hoạt AI chấm toàn bộ bài trong lớp
export const gradeAllSubmissionsWithAI = async (req, res) => {
  try {
    const { classId } = req.params;
    const subs = await Submission.find({ classId });
    let count = 0;

    for (const sub of subs) {
      if (sub.state !== 'approved') {
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
