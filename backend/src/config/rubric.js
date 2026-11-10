// Bộ tiêu chí đánh giá mặc định (dùng khi lớp chưa tùy chỉnh tiêu chí riêng)
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

export const RUBRIC_MIN_ITEMS = 1;
export const RUBRIC_MAX_ITEMS = 10;

const plain = (r) => ({ name: r.name, max: r.max, desc: r.desc || '' });

// Lấy bộ tiêu chí đang áp dụng của lớp (tiêu chí riêng của lớp hoặc mặc định)
export function getEffectiveRubric(classroom) {
  if (classroom && Array.isArray(classroom.rubric) && classroom.rubric.length > 0) {
    return classroom.rubric.map(plain);
  }
  return DEFAULT_RUBRIC.map(plain);
}

// Bộ tiêu chí áp dụng cho một bài nộp cụ thể:
// - Bài đã lưu ảnh chụp tiêu chí lúc chấm → dùng đúng bộ đó
// - Bài cũ đã có điểm nhưng chưa lưu tiêu chí → được chấm theo bộ mặc định
// - Bài chưa chấm → dùng bộ tiêu chí hiện tại của lớp
export function getSubmissionRubric(sub, classRubric) {
  if (sub && Array.isArray(sub.rubric) && sub.rubric.length > 0) {
    return sub.rubric.map(plain);
  }
  const hasScores = (sub?.scores?.length || 0) > 0 || (sub?.teacherScores?.length || 0) > 0;
  if (hasScores) return DEFAULT_RUBRIC.map(plain);
  return (classRubric && classRubric.length ? classRubric : DEFAULT_RUBRIC).map(plain);
}

// Kiểm tra bộ tiêu chí có đúng cấu trúc mặc định 4 tiêu chí (4-2-2-2) hay không
// (động cơ chấm dự phòng không dùng AI chỉ áp dụng được cho cấu trúc này)
export function isDefaultRubricShape(rubric) {
  if (!Array.isArray(rubric) || rubric.length !== DEFAULT_RUBRIC.length) return false;
  return rubric.every((r, i) => Number(r.max) === DEFAULT_RUBRIC[i].max);
}

// Kiểm tra và chuẩn hóa dữ liệu tiêu chí do giáo viên gửi lên
// Trả về { rubric } nếu hợp lệ, hoặc { error } nếu không hợp lệ
export function validateRubric(input) {
  if (!Array.isArray(input)) {
    return { error: 'Dữ liệu tiêu chí không hợp lệ.' };
  }
  if (input.length < RUBRIC_MIN_ITEMS || input.length > RUBRIC_MAX_ITEMS) {
    return { error: `Số tiêu chí phải từ ${RUBRIC_MIN_ITEMS} đến ${RUBRIC_MAX_ITEMS}.` };
  }

  const rubric = [];
  for (let i = 0; i < input.length; i++) {
    const item = input[i] || {};
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const desc = typeof item.desc === 'string' ? item.desc.trim() : '';
    const max = Number(item.max);

    if (!name) {
      return { error: `Tiêu chí ${i + 1} chưa có tên.` };
    }
    if (name.length > 120 || desc.length > 600) {
      return { error: `Tiêu chí ${i + 1} có tên hoặc mô tả quá dài.` };
    }
    if (!Number.isFinite(max) || max <= 0 || max > 100) {
      return { error: `Điểm tối đa của tiêu chí ${i + 1} phải là số lớn hơn 0 và không quá 100.` };
    }
    rubric.push({ name, max: Math.round(max * 100) / 100, desc });
  }

  return { rubric };
}

// Chuẩn hóa mảng điểm theo bộ tiêu chí: đủ số lượng, là số hữu hạn, nằm trong [0, max]
// Trả về null nếu mảng điểm không khớp số tiêu chí
export function normalizeScores(scores, rubric) {
  if (!Array.isArray(scores) || !Array.isArray(rubric) || scores.length !== rubric.length) {
    return null;
  }
  return scores.map((s, i) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(Number(rubric[i].max), Math.round(n * 100) / 100));
  });
}
