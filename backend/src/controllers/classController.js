import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { runSeed } from '../scripts/seed.js';

// GET /api/classes
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().sort({ classId: 1 }).lean();
    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes
export const createClass = async (req, res) => {
  try {
    const { classId, label, grade } = req.body;
    if (!classId || !label) {
      return res.status(400).json({ success: false, message: 'Thiếu mã lớp hoặc tên lớp' });
    }
    const cleanId = classId.trim().toUpperCase();
    const existing = await Class.findOne({ classId: cleanId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Mã lớp đã tồn tại' });
    }

    const newClass = await Class.create({
      classId: cleanId,
      label: label.trim(),
      grade: grade || '4',
    });

    res.status(201).json({ success: true, class: newClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/classes/:classId/full
// Returns class info + all students with their active submissions merged
export const getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    const classroom = await Class.findOne({ classId }).lean();
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
    }

    const students = await Student.find({ classId }).sort({ studentId: 1 }).lean();
    const submissions = await Submission.find({ classId }).lean();

    // Map submission to each student for clean frontend state
    const mergedStudents = students.map((std) => {
      const sub = submissions.find((s) => s.studentId === std.studentId) || {};
      return {
        id: std.studentId,
        studentMongoId: std._id,
        name: std.name,
        submissionId: sub._id,
        state: sub.state || 'new',
        text: sub.text || '',
        scores: sub.scores || [],
        explain: sub.explain || [],
        errors: sub.errors || [],
        strength: sub.strength || '',
        evidence: sub.evidence || '',
        support: sub.support || '',
        activity: sub.activity || '',
        feedback: sub.feedback || '',
        teacherScores: sub.teacherScores || null,
        teacherFeedback: sub.teacherFeedback || '',
        reason: sub.reason || '',
        attachments: sub.attachments || [],
        logs: sub.logs || [],
        sample: sub.sample || false,
        custom: sub.custom !== undefined ? sub.custom : true,
      };
    });

    res.json({
      success: true,
      classroom,
      students: mergedStudents,
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

    let finalId = studentId?.trim().toUpperCase();
    if (!finalId) {
      const count = await Student.countDocuments({ classId });
      finalId = `HS${String(count + 1).padStart(2, '0')}`;
    }

    const student = await Student.create({
      studentId: finalId,
      name: name.trim(),
      classId,
    });

    // Create blank submission for this student
    const defaultAssignment = await Assignment.findOne();
    await Submission.create({
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

    res.status(201).json({ success: true, student });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Mã học sinh đã tồn tại trong lớp' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/classes/:classId/roster (bulk import)
export const importRoster = async (req, res) => {
  try {
    const { classId } = req.params;
    const { rawNames } = req.body; // text with newline or comma
    if (!rawNames?.trim()) {
      return res.status(400).json({ success: false, message: 'Dữ liệu danh sách trống' });
    }

    const lines = rawNames
      .split(/\r?\n/)
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

// POST /api/reset-samples
export const resetToSamples = async (req, res) => {
  try {
    await runSeed();
    res.json({ success: true, message: 'Đã khôi phục dữ liệu mẫu thành công vào MongoDB Atlas' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
