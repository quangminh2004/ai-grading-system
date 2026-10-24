import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { Student } from '../models/Student.js';

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
      message: 'Cập nhật và lưu vào MongoDB Atlas thành công',
      submission: sub,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/receive-batch
// Nhận tệp từ upload, ghép với học sinh và lưu vào MongoDB
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

      // Nếu bài chưa có kết quả, trạng thái là new chờ đọc
      if (sub.state === 'new') {
        sub.custom = true;
      }

      await sub.save();
      processed++;
    }

    res.json({
      success: true,
      message: `Đã tiếp nhận ${processed} tệp vào cơ sở dữ liệu`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
