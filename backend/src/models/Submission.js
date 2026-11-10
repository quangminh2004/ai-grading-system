import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    sampleUrl: { type: String },
    filePath: { type: String },
    fileSize: { type: Number },
  },
  { _id: false }
);

const rubricItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    max: { type: Number, required: true },
    desc: { type: String, default: '' },
  },
  { _id: false }
);

const logSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    scores: [Number],
    reason: { type: String },
  },
  { _id: false }
);

const errorDetailsSchema = new mongoose.Schema(
  {
    provider: { type: String }, // 'OpenAI' | 'Gemini' | 'Tesseract' | 'System'
    model: { type: String },
    httpStatus: { type: Number },
    errorCode: { type: String },
    errorMessage: { type: String }, // Đã loại bỏ thông tin nhạy cảm
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      ref: 'Student',
    },
    classId: {
      type: String,
      required: true,
      ref: 'Class',
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
    },
    // Số thứ tự bài nộp của học sinh (bài 1, bài 2, ...)
    submissionNumber: {
      type: Number,
      default: 1,
    },
    // Nhãn bài nộp (VD: "Bài nộp 1", "Bài nộp lại", ...)
    submissionLabel: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      enum: [
        'new',
        'pending',
        'processing',
        'completed',
        'suggested',
        'approved',
        'needs_review',
        'provider_unavailable',
        'failed',
      ],
      default: 'new',
    },
    errorDetails: {
      type: errorDetailsSchema,
      default: null,
    },
    ocrConfidence: {
      type: Number,
      default: null,
    },
    text: {
      type: String,
      default: '',
    },
    scores: {
      type: [Number],
      default: [],
    },
    // Ảnh chụp bộ tiêu chí tại thời điểm chấm (để điểm cũ không lệch khi lớp đổi tiêu chí)
    rubric: {
      type: [rubricItemSchema],
      default: undefined,
    },
    explain: {
      type: [String],
      default: [],
    },
    errors: {
      type: Array, // [[category, original, suggested, reason], ...]
      default: [],
    },
    strength: { type: String, default: '' },
    evidence: { type: String, default: '' },
    support: { type: String, default: '' },
    activity: { type: String, default: '' },
    feedback: { type: String, default: '' },
    teacherScores: {
      type: [Number],
      default: null,
    },
    teacherFeedback: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      default: '',
    },
    attachments: [attachmentSchema],
    logs: [logSchema],
    sample: {
      type: Boolean,
      default: false,
    },
    custom: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

// Index không unique — một học sinh có thể có nhiều bài nộp
submissionSchema.index({ classId: 1, studentId: 1 });
submissionSchema.index({ classId: 1, studentId: 1, submissionNumber: 1 });

export const Submission = mongoose.model('Submission', submissionSchema);
