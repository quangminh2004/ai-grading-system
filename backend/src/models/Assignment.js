import mongoose from 'mongoose';

const rubricItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    max: { type: Number, required: true },
    desc: { type: String, required: true },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'Viết đoạn văn ngắn miêu tả một cây bóng mát hoặc cây hoa/cây ăn quả',
    },
    subject: {
      type: String,
      default: 'Tiếng Việt 4',
    },
    grade: {
      type: String,
      default: '4',
    },
    rubric: {
      type: [rubricItemSchema],
      default: [
        {
          name: 'Nội dung & chi tiết',
          max: 4,
          desc: 'Đúng yêu cầu tả cây; có chi tiết cụ thể về hình dáng, đặc điểm hoặc sự gắn bó.',
        },
        {
          name: 'Sắp xếp ý',
          max: 2,
          desc: 'Các ý được kết nối và sắp xếp hợp lý trong đoạn văn.',
        },
        {
          name: 'Từ ngữ & diễn đạt',
          max: 2,
          desc: 'Từ ngữ phù hợp; câu rõ nghĩa; có cách diễn đạt riêng.',
        },
        {
          name: 'Chính tả & dấu câu',
          max: 2,
          desc: 'Viết đúng chính tả, viết hoa và sử dụng dấu câu phù hợp.',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
