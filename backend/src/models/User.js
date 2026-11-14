import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'parent'],
      default: 'teacher',
      required: true,
    },
    school: {
      type: String,
      required: true,
      trim: true,
      default: 'Trường Tiểu học Thanh Lân',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
    },
    assignedClasses: {
      type: [String],
      default: [],
    },
    // Phụ huynh: danh sách con được gắn (classId + studentId)
    children: {
      type: [
        {
          classId: { type: String, required: true, trim: true },
          studentId: { type: String, required: true, trim: true },
          _id: false,
        },
      ],
      default: [],
    },
    createdBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

// Tự động hash mật khẩu trước khi lưu nếu mật khẩu bị thay đổi
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// So sánh mật khẩu khi đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Loại bỏ mật khẩu khi trả về client
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model('User', userSchema);

