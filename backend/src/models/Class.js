import mongoose from 'mongoose';

const rubricItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    max: { type: Number, required: true, min: 0 },
    desc: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    classId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    grade: {
      type: String,
      default: '4',
    },
    academicYear: {
      type: String,
      default: '2026-2027',
    },
    school: {
      type: String,
      default: 'Trường Tiểu học Thanh Lân',
      trim: true,
    },
    teacherUsername: {
      type: String,
      trim: true,
      default: '',
    },
    // Bộ tiêu chí đánh giá riêng của lớp (rỗng = dùng bộ tiêu chí mặc định)
    rubric: {
      type: [rubricItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Class = mongoose.model('Class', classSchema);
