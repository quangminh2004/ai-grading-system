import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    classId: {
      type: String,
      required: true,
      ref: 'Class',
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index({ studentId: 1, classId: 1 }, { unique: true });

export const Student = mongoose.model('Student', studentSchema);
