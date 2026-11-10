import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { Student } from '../models/Student.js';
import { autoGradeSubmission } from '../services/aiGradingService.js';
import { aiProviderTracker } from '../services/aiErrorHandler.js';
import { uploadBufferToR2, deleteFromR2, isR2Configured } from '../services/r2StorageService.js';
import { getEffectiveRubric, getSubmissionRubric, normalizeScores } from '../config/rubric.js';

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

    // Nếu có submissionId cụ thể thì duyệt bài đó (chỉ trong đúng lớp/học sinh), không thì lấy bài mới nhất
    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId, studentId });
    }
    if (!sub) {
      // Lấy bài suggested mới nhất, hoặc bài mới nhất
      sub = await Submission.findOne({ classId, studentId, state: 'suggested' }).sort({ submissionNumber: -1 })
        || await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp' });
    }

    // Kiểm tra điểm giáo viên nhập theo đúng bộ tiêu chí của bài (hoặc bộ tiêu chí hiện tại của lớp)
    let normalizedTeacherScores;
    if (Array.isArray(teacherScores)) {
      const classRubric = getEffectiveRubric(req.classroom);
      const subRubric = getSubmissionRubric(sub, classRubric);
      let targetRubric = null;
      if (teacherScores.length === subRubric.length) targetRubric = subRubric;
      else if (teacherScores.length === classRubric.length) targetRubric = classRubric;

      normalizedTeacherScores = targetRubric ? normalizeScores(teacherScores, targetRubric) : null;
      if (!normalizedTeacherScores) {
        return res.status(400).json({
          success: false,
          message: 'Số điểm không khớp với số tiêu chí đánh giá. Vui lòng tải lại trang và chấm lại.',
        });
      }
      sub.rubric = targetRubric;
    }

    if (state !== undefined) sub.state = state;
    if (normalizedTeacherScores !== undefined) sub.teacherScores = normalizedTeacherScores;
    else if (teacherScores === null) sub.teacherScores = null;
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
      scores: normalizedTeacherScores || sub.scores,
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
      let finalFilePath = `/uploads/${file.filename}`;
      if (isR2Configured()) {
        try {
          const buf = fs.readFileSync(file.path);
          finalFilePath = await uploadBufferToR2(buf, file.filename, file.mimetype);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (r2Err) {
          console.warn('⚠️ Lỗi upload lên Cloudflare R2, fallback lưu tạm cục bộ:', r2Err.message);
        }
      }

      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: finalFilePath,
        fileSize: file.size,
      });
    }

    console.log(`📥 Tải bài mới cho ${studentId} (${student.name}) - ${files.length} tệp. Chờ giáo viên bấm Chấm AI.`);

    // KHÔNG tự động chấm ngay theo quy trình mới: Upload ảnh xong -> có thể thêm/xóa ảnh -> bấm nút Chấm AI thì mới bắt đầu chấm
    await sub.save();

    res.json({
      success: true,
      message: `✓ Đã tải ${files.length} tệp ảnh bài làm cho em ${student.name} (${submissionNumber === 1 ? 'Bài nộp đầu tiên' : `Bài nộp lần ${submissionNumber}`}). Thầy cô có thể thêm/xóa ảnh hoặc bấm "⚡ Chấm bài bằng AI" để bắt đầu chấm.`,
      submission: sub,
    });
  } catch (error) {
    console.error('Lỗi uploadStudentSubmission:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/:studentId/attachments
// Tải thêm ảnh bổ sung vào bài nộp đang xem (nếu thiếu ảnh)
export const addAttachmentsToSubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { submissionId } = req.body;
    let files = req.files || [];
    if (!files.length && req.file) files = [req.file];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Chưa chọn tệp ảnh nào để thêm' });
    }

    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId, studentId });
    }
    if (!sub) {
      sub = await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp để thêm ảnh' });
    }

    for (const file of files) {
      let finalFilePath = `/uploads/${file.filename}`;
      if (isR2Configured()) {
        try {
          const buf = fs.readFileSync(file.path);
          finalFilePath = await uploadBufferToR2(buf, file.filename, file.mimetype);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (r2Err) {
          console.warn('⚠️ Lỗi upload lên Cloudflare R2, fallback lưu tạm cục bộ:', r2Err.message);
        }
      }

      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: finalFilePath,
        fileSize: file.size,
      });
    }

    console.log(`📥 Thêm ${files.length} ảnh vào bài nộp ${sub._id} (${studentId}). Tổng ảnh hiện tại: ${sub.attachments.length}`);
    await sub.save();

    res.json({
      success: true,
      message: `✓ Đã thêm ${files.length} ảnh vào bài làm thành công! (Hiện có ${sub.attachments.length} tệp)`,
      submission: sub,
    });
  } catch (error) {
    console.error('Lỗi addAttachmentsToSubmission:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/classes/:classId/submissions/:studentId/attachments
// Xóa 1 ảnh khỏi bài nộp (nếu thừa hoặc nạp nhầm)
export const deleteAttachmentFromSubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { submissionId, attachmentKey, filePath } = req.body;

    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId, studentId });
    }
    if (!sub) {
      sub = await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp' });
    }

    const index = sub.attachments.findIndex(
      (att) => (attachmentKey && att.key === attachmentKey) || (filePath && att.filePath === filePath)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tệp ảnh cần xóa' });
    }

    const [removed] = sub.attachments.splice(index, 1);

    // Xóa file trên Cloudflare R2 hoặc trên đĩa cục bộ
    if (removed && removed.filePath) {
      if (removed.filePath.startsWith('http')) {
        deleteFromR2(removed.filePath);
      } else {
        try {
          const fname = path.basename(removed.filePath);
          const candidatePaths = [
            path.resolve('backend/uploads', fname),
            path.resolve('uploads', fname),
          ];
          for (const p of candidatePaths) {
            if (fs.existsSync(p)) fs.unlinkSync(p);
          }
        } catch (err) {
          console.warn('Lỗi xóa tệp trên đĩa:', err.message);
        }
      }
    }

    console.log(`🗑️ Đã xóa 1 tệp ảnh khỏi bài nộp ${sub._id}. Còn lại ${sub.attachments.length} tệp.`);
    await sub.save();

    res.json({
      success: true,
      message: '✓ Đã xóa ảnh khỏi bài làm thành công!',
      submission: sub,
      remainingAttachments: sub.attachments.length,
    });
  } catch (error) {
    console.error('Lỗi deleteAttachmentFromSubmission:', error);
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

      let finalFilePath = `/uploads/${file.filename}`;
      if (isR2Configured()) {
        try {
          const buf = fs.readFileSync(file.path);
          finalFilePath = await uploadBufferToR2(buf, file.filename, file.mimetype);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (r2Err) {
          console.warn('⚠️ Lỗi upload lên Cloudflare R2, fallback lưu tạm cục bộ:', r2Err.message);
        }
      }

      // Thêm tệp đính kèm
      sub.attachments.push({
        key: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.originalname,
        type: file.mimetype,
        filePath: finalFilePath,
        fileSize: file.size,
      });

      console.log(`📥 Tạo bài nộp ${submissionNumber} cho ${studentId} — file: ${file.originalname} → ${file.filename}`);

      // LƯU BÀI NỘP Ở TRẠNG THÁI MỚI 'new' (CHỜ GIÁO VIÊN BẤM CHẤM TỪNG EM)
      // Tuyệt đối KHÔNG tự động gọi autoGradeSubmission cho cả danh sách ở đây
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
      message: `Đã tiếp nhận ${processed} bài nộp mới! Bài đã được lưu an toàn. Thầy cô bấm vào từng học sinh rồi chọn "Chấm bài bằng AI" để bắt đầu chấm.`,
    });
  } catch (error) {
    console.error('Lỗi receive-batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/:studentId/grade-ai
// Kích hoạt AI chấm điểm — CHỈ CHẤM DUY NHẤT BÀI NÀY CỦA HỌC SINH NÀY (hỗ trợ forceReOcr)
export const gradeSubmissionWithAI = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { text, submissionId, forceReOcr } = req.body;

    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId, studentId });
    }
    if (!sub) {
      // Lấy bài chưa duyệt mới nhất của đúng học sinh này
      sub = await Submission.findOne({ classId, studentId, state: { $in: ['new', 'suggested', 'needs_review', 'provider_unavailable'] } })
        .sort({ submissionNumber: -1 });
    }
    if (!sub) {
      // Fallback bài mới nhất của đúng học sinh này
      sub = await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    // Nếu không có bài và cũng không có text gửi lên → báo lỗi rõ ràng
    if (!sub && !text) {
      return res.status(400).json({
        success: false,
        message: 'Học sinh này chưa có bài làm. Vui lòng upload ảnh bài hoặc nhập văn bản trước.',
      });
    }

    // Nếu có text nhưng không có submission → tạo mới cho đúng học sinh này
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
        message: 'Chưa có tệp ảnh bài làm để chấm. Vui lòng upload ảnh bài trước.',
      });
    }

    if (text !== undefined) {
      sub.text = text;
    }

    // CHỈ CHẤM DUY NHẤT BÀI NỘP CỦA HỌC SINH NÀY (theo bộ tiêu chí của lớp)
    await autoGradeSubmission(sub, { forceReOcr: Boolean(forceReOcr), rubric: getEffectiveRubric(req.classroom) });
    await sub.save();

    const hasScores = sub.scores && sub.scores.length > 0;
    res.json({
      success: true,
      message: hasScores
        ? `✓ AI đã chấm và đề xuất điểm bài làm của em ${studentId} thành công!`
        : `Đã lưu bài làm của em ${studentId}. Thầy cô có thể bấm "✎ Chỉnh sửa & Duyệt bài" để chấm điểm.`,
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
    const rubric = getEffectiveRubric(req.classroom);
    let count = 0;

    for (const std of students) {
      // Lấy bài mới nhất chưa duyệt của học sinh
      const sub = await Submission.findOne({
        classId,
        studentId: std.studentId,
        state: { $in: ['new', 'suggested', 'needs_review', 'provider_unavailable'] },
      }).sort({ submissionNumber: -1 });

      if (sub && (sub.text?.trim() || sub.attachments?.length > 0)) {
        await autoGradeSubmission(sub, { rubric });
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

// POST /api/classes/:classId/submissions/:studentId/retry
// Thử lại bài nộp bị lỗi khi AI provider đã hoạt động trở lại
export const retrySubmission = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { submissionId } = req.body;

    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId, studentId });
    }
    if (!sub) {
      sub = await Submission.findOne({
        classId,
        studentId,
        state: { $in: ['provider_unavailable', 'failed', 'needs_review', 'new'] },
      }).sort({ submissionNumber: -1 }) || await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp để thử lại' });
    }

    // Đánh dấu processing và gọi lại AI
    sub.state = 'processing';
    await sub.save();

    await autoGradeSubmission(sub, { forceReOcr: true, rubric: getEffectiveRubric(req.classroom) });
    await sub.save();

    const isSuccess = ['suggested', 'completed', 'approved'].includes(sub.state);
    res.json({
      success: isSuccess,
      message: isSuccess
        ? '✓ Đã thử lại thành công! AI đã đọc bài và đề xuất điểm.'
        : `⚠️ Thử lại chưa thành công: ${sub.errorDetails?.errorMessage || 'Dịch vụ AI vẫn chưa sẵn sàng.'}`,
      submission: sub,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/submissions/retry-failed
// Thử lại tất cả các bài bị lỗi trong lớp
export const retryAllFailedSubmissions = async (req, res) => {
  try {
    const { classId } = req.params;

    const failedSubs = await Submission.find({
      classId,
      state: { $in: ['provider_unavailable', 'failed', 'needs_review'] },
    });

    let successCount = 0;
    let failedCount = 0;
    const rubric = getEffectiveRubric(req.classroom);

    for (const sub of failedSubs) {
      sub.state = 'processing';
      await autoGradeSubmission(sub, { forceReOcr: true, rubric });
      await sub.save();
      if (['suggested', 'completed', 'approved'].includes(sub.state)) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Đã thử lại ${failedSubs.length} bài: ${successCount} thành công, ${failedCount} bài vẫn chờ xử lý.`,
      successCount,
      failedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ai/providers-status
// Kiểm tra trạng thái các nhà cung cấp AI (cho Giáo viên / Quản trị viên)
export const getAiProvidersStatus = async (req, res) => {
  try {
    const status = aiProviderTracker.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/classes/:classId/submissions/:submissionId
// Hoặc /api/classes/:classId/submissions/:studentId/:submissionId
// Xóa một bài nộp cụ thể của học sinh
export const deleteSubmission = async (req, res) => {
  try {
    const { classId, submissionId, studentId } = req.params;

    // Tìm bài nộp theo submissionId (chỉ trong lớp hiện tại), hoặc bài mới nhất của học sinh
    let sub = null;
    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      sub = await Submission.findOne({ _id: submissionId, classId });
    }
    if (!sub && studentId) {
      sub = await Submission.findOne({ classId, studentId }).sort({ submissionNumber: -1 });
    }

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp để xóa' });
    }

    const targetStudentId = sub.studentId;
    const targetClassId = sub.classId;

    // Xóa file đính kèm trên Cloudflare R2 hoặc trên đĩa nếu có
    if (sub.attachments && sub.attachments.length > 0) {
      for (const att of sub.attachments) {
        if (att.filePath && att.filePath.startsWith('http')) {
          deleteFromR2(att.filePath);
        } else {
          try {
            const fname = path.basename(att.filePath || att.name || '');
            if (fname) {
              const candidatePaths = [
                path.resolve('backend/uploads', fname),
                path.resolve('uploads', fname),
              ];
              for (const p of candidatePaths) {
                if (fs.existsSync(p)) {
                  fs.unlinkSync(p);
                }
              }
            }
          } catch (unlinkErr) {
            console.warn('Lỗi khi xóa tệp đính kèm trên đĩa:', unlinkErr.message);
          }
        }
      }
    }

    // Xóa bài nộp khỏi database
    await Submission.deleteOne({ _id: sub._id });

    // Đánh lại số thứ tự (submissionNumber) cho các bài còn lại của học sinh
    const remainingSubs = await Submission.find({
      classId: targetClassId,
      studentId: targetStudentId,
    }).sort({ createdAt: 1 });

    for (let i = 0; i < remainingSubs.length; i++) {
      const s = remainingSubs[i];
      const newNum = i + 1;
      s.submissionNumber = newNum;
      s.submissionLabel = newNum === 1 ? 'Bài nộp' : `Bài nộp lần ${newNum}`;
      await s.save();
    }

    console.log(`🗑️ Đã xóa bài nộp ${sub._id} của học sinh ${targetStudentId}. Còn lại ${remainingSubs.length} bài.`);

    res.json({
      success: true,
      message: 'Đã xóa bài nộp thành công!',
      deletedId: sub._id,
      studentId: targetStudentId,
      remainingCount: remainingSubs.length,
    });
  } catch (error) {
    console.error('Lỗi deleteSubmission:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
