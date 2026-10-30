import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    level: {
      type: String,
      trim: true,
      default: 'Tiểu học',
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: 'admin',
    },
  },
  {
    timestamps: true,
  }
);

export const School = mongoose.model('School', schoolSchema);

