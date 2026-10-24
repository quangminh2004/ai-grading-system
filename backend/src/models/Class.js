import mongoose from 'mongoose';

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
    },
  },
  {
    timestamps: true,
  }
);

export const Class = mongoose.model('Class', classSchema);
