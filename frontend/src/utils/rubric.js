// Bộ tiêu chí mặc định (khớp với backend/src/config/rubric.js)
export const DEFAULT_RUBRIC = [
  {
    name: 'Nội dung & chi tiết',
    max: 4,
    desc: 'Đúng trọng tâm yêu cầu bài viết; có chi tiết cụ thể, hình ảnh sinh động hoặc cảm xúc, suy nghĩ chân thực.',
  },
  {
    name: 'Sắp xếp ý & bố cục',
    max: 2,
    desc: 'Bố cục rõ ràng (Mở bài - Thân bài - Kết bài); các câu văn liên kết mạch lạc, chặt chẽ.',
  },
  {
    name: 'Từ ngữ & diễn đạt',
    max: 2,
    desc: 'Sử dụng từ ngữ gợi cảm, giàu hình ảnh; câu văn rõ nghĩa; diễn đạt tự nhiên và có nét sáng tạo riêng.',
  },
  {
    name: 'Chính tả & dấu câu',
    max: 2,
    desc: 'Viết đúng chính tả tiếng Việt, đúng quy tắc viết hoa và sử dụng các dấu câu chuẩn xác.',
  },
];

export const RUBRIC_MAX_ITEMS = 10;

export const getRubric = (rubric) =>
  Array.isArray(rubric) && rubric.length > 0 ? rubric : DEFAULT_RUBRIC;

export const rubricMaxTotal = (rubric) =>
  getRubric(rubric).reduce((sum, r) => sum + (Number(r.max) || 0), 0);

export const sumScores = (scores) => (scores || []).reduce((s, n) => s + (Number(n) || 0), 0);

export const fmtScore = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
