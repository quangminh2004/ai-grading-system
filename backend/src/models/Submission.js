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

const logSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    scores: [Number],
    reason: { type: String },
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
    state: {
      type: String,
      enum: ['new', 'suggested', 'approved'],
      default: 'new',
    },
    text: {
      type: String,
      default: '',
    },
    scores: {
      type: [Number],
      default: [],
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

submissionSchema.index({ classId: 1, studentId: 1 });

export const Submission = mongoose.model('Submission', submissionSchema);
