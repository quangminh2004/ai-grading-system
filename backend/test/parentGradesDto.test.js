import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of the DTO shaping in parentController.getChildGrades
 * (unit-tested without Mongo so CI/local không phụ thuộc DB).
 */
function toParentGradeDto(sub, classRubric) {
  const rubricSource =
    Array.isArray(sub.rubric) && sub.rubric.length
      ? sub.rubric
      : Array.isArray(classRubric) && classRubric.length
        ? classRubric
        : [{ name: 'Nội dung', max: 4 }, { name: 'Hình thức', max: 6 }];

  const rubric = rubricSource.map((r) => ({ name: r.name, max: r.max }));
  const teacherScores = Array.isArray(sub.teacherScores) ? sub.teacherScores : [];
  const total = teacherScores.reduce((s, n) => s + (Number(n) || 0), 0);

  return {
    submissionNumber: sub.submissionNumber,
    submissionLabel: sub.submissionLabel || `Bài nộp ${sub.submissionNumber}`,
    updatedAt: sub.updatedAt,
    rubric,
    teacherScores,
    total,
    teacherFeedback: sub.teacherFeedback || '',
  };
}

function filterApprovedOnly(subs) {
  return (subs || []).filter((s) => s.state === 'approved');
}

const SENSITIVE_KEYS = [
  'attachments',
  'text',
  'scores',
  'explain',
  'errors',
  'logs',
  'errorDetails',
  'strength',
  'evidence',
  'support',
  'feedback',
  'filePath',
];

describe('parent grades DTO', () => {
  test('chỉ lấy bài approved', () => {
    const filtered = filterApprovedOnly([
      { state: 'approved', submissionNumber: 1 },
      { state: 'suggested', submissionNumber: 2 },
      { state: 'needs_review', submissionNumber: 3 },
      { state: 'approved', submissionNumber: 4 },
    ]);
    assert.deepEqual(
      filtered.map((s) => s.submissionNumber),
      [1, 4]
    );
  });

  test('DTO chỉ có điểm GV + nhận xét + tiêu chí, không lộ field nhạy cảm', () => {
    const raw = {
      state: 'approved',
      submissionNumber: 2,
      submissionLabel: 'Bài viết tuần 3',
      updatedAt: new Date('2026-03-01'),
      teacherScores: [3, 1.5, 1.5, 2],
      teacherFeedback: 'Viết tốt, cần chú ý chính tả.',
      scores: [4, 2, 2, 2],
      text: 'Nội dung OCR bí mật',
      attachments: [{ key: 'a', name: 'a.jpg', type: 'image/jpeg', filePath: '/uploads/a.jpg' }],
      explain: ['AI giải thích'],
      errors: [['spelling', 'a', 'b', 'r']],
      logs: [{ action: 'approved' }],
      strength: 'hay',
      evidence: 'x',
      support: 'y',
      feedback: 'AI feedback',
      rubric: [
        { name: 'Nội dung & chi tiết', max: 4 },
        { name: 'Sắp xếp ý & bố cục', max: 2 },
        { name: 'Từ ngữ & diễn đạt', max: 2 },
        { name: 'Chính tả & dấu câu', max: 2 },
      ],
    };

    const dto = toParentGradeDto(raw);
    assert.equal(dto.submissionNumber, 2);
    assert.equal(dto.submissionLabel, 'Bài viết tuần 3');
    assert.equal(dto.teacherFeedback, 'Viết tốt, cần chú ý chính tả.');
    assert.deepEqual(dto.teacherScores, [3, 1.5, 1.5, 2]);
    assert.equal(dto.total, 8);
    assert.equal(dto.rubric.length, 4);
    assert.ok(!('desc' in dto.rubric[0]));

    for (const key of SENSITIVE_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(dto, key), false, `DTO không được có ${key}`);
    }
  });

  test('bài chưa có teacherScores → total 0, feedbackback rỗng', () => {
    const dto = toParentGradeDto({
      state: 'approved',
      submissionNumber: 1,
      teacherScores: null,
      teacherFeedback: undefined,
    });
    assert.equal(dto.total, 0);
    assert.deepEqual(dto.teacherScores, []);
    assert.equal(dto.teacherFeedback, '');
  });
});
