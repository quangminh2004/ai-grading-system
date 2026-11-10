import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RUBRIC,
  getEffectiveRubric,
  getSubmissionRubric,
  isDefaultRubricShape,
  validateRubric,
  normalizeScores,
} from '../src/config/rubric.js';

const custom3 = [
  { name: 'Nội dung', max: 5, desc: '' },
  { name: 'Bố cục', max: 3, desc: '' },
  { name: 'Chính tả', max: 1, desc: '' },
];

describe('validateRubric', () => {
  test('chấp nhận bộ tiêu chí hợp lệ và chuẩn hóa dữ liệu', () => {
    const { rubric, error } = validateRubric([
      { name: '  Nội dung  ', max: '4.5', desc: ' mô tả ' },
      { name: 'Bố cục', max: 2 },
    ]);
    assert.equal(error, undefined);
    assert.deepEqual(rubric, [
      { name: 'Nội dung', max: 4.5, desc: 'mô tả' },
      { name: 'Bố cục', max: 2, desc: '' },
    ]);
  });

  test('từ chối dữ liệu không phải mảng', () => {
    assert.ok(validateRubric(null).error);
    assert.ok(validateRubric({ name: 'x', max: 1 }).error);
  });

  test('từ chối mảng rỗng và quá 10 tiêu chí', () => {
    assert.ok(validateRubric([]).error);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `TC${i}`, max: 1 }));
    assert.ok(validateRubric(eleven).error);
    const ten = eleven.slice(0, 10);
    assert.equal(validateRubric(ten).error, undefined);
  });

  test('từ chối tiêu chí thiếu tên', () => {
    assert.match(validateRubric([{ name: '   ', max: 2 }]).error, /Tiêu chí 1/);
  });

  test('từ chối điểm tối đa không hợp lệ', () => {
    for (const max of [0, -1, 'abc', NaN, Infinity, 101, null]) {
      assert.ok(validateRubric([{ name: 'A', max }]).error, `max=${max} phải bị từ chối`);
    }
  });

  test('từ chối tên hoặc mô tả quá dài', () => {
    assert.ok(validateRubric([{ name: 'a'.repeat(121), max: 1 }]).error);
    assert.ok(validateRubric([{ name: 'A', max: 1, desc: 'a'.repeat(601) }]).error);
  });

  test('làm tròn điểm tối đa 2 chữ số thập phân', () => {
    const { rubric } = validateRubric([{ name: 'A', max: 1.23456 }]);
    assert.equal(rubric[0].max, 1.23);
  });
});

describe('normalizeScores', () => {
  test('giữ nguyên điểm hợp lệ', () => {
    assert.deepEqual(normalizeScores([3.5, 2, 1.75, 1.5], DEFAULT_RUBRIC), [3.5, 2, 1.75, 1.5]);
  });

  test('kẹp điểm vào khoảng [0, max]', () => {
    assert.deepEqual(normalizeScores([9, -1, 2, 2], DEFAULT_RUBRIC), [4, 0, 2, 2]);
  });

  test('ép chuỗi số và biến giá trị rác thành 0', () => {
    assert.deepEqual(normalizeScores(['3', 'abc', null, '1.5'], DEFAULT_RUBRIC), [3, 0, 0, 1.5]);
  });

  test('trả về null khi số điểm không khớp số tiêu chí', () => {
    assert.equal(normalizeScores([1, 2, 3], DEFAULT_RUBRIC), null);
    assert.equal(normalizeScores([1, 2, 3, 4, 5], DEFAULT_RUBRIC), null);
    assert.equal(normalizeScores(undefined, DEFAULT_RUBRIC), null);
  });

  test('hoạt động với bộ tiêu chí tùy chỉnh', () => {
    assert.deepEqual(normalizeScores([6, 2.5, 1], custom3), [5, 2.5, 1]);
  });
});

describe('getEffectiveRubric', () => {
  test('lớp chưa tùy chỉnh dùng bộ mặc định', () => {
    assert.deepEqual(getEffectiveRubric({ rubric: [] }), DEFAULT_RUBRIC);
    assert.deepEqual(getEffectiveRubric(null), DEFAULT_RUBRIC);
  });

  test('lớp đã tùy chỉnh dùng bộ riêng', () => {
    assert.deepEqual(getEffectiveRubric({ rubric: custom3 }), custom3);
  });

  test('trả về bản sao, không làm thay đổi bộ mặc định', () => {
    const r = getEffectiveRubric(null);
    r[0].max = 99;
    assert.equal(DEFAULT_RUBRIC[0].max, 4);
  });
});

describe('getSubmissionRubric', () => {
  test('bài đã lưu tiêu chí lúc chấm → dùng đúng bộ đó', () => {
    assert.deepEqual(getSubmissionRubric({ rubric: custom3, scores: [1, 1, 1] }, DEFAULT_RUBRIC), custom3);
  });

  test('bài cũ có điểm nhưng chưa lưu tiêu chí → coi là bộ mặc định', () => {
    assert.deepEqual(getSubmissionRubric({ scores: [3, 2, 2, 2] }, custom3), DEFAULT_RUBRIC);
    assert.deepEqual(getSubmissionRubric({ scores: [], teacherScores: [3, 2, 2, 2] }, custom3), DEFAULT_RUBRIC);
  });

  test('bài chưa chấm → dùng tiêu chí hiện tại của lớp', () => {
    assert.deepEqual(getSubmissionRubric({ scores: [] }, custom3), custom3);
    assert.deepEqual(getSubmissionRubric({}, custom3), custom3);
    assert.deepEqual(getSubmissionRubric({}, []), DEFAULT_RUBRIC);
  });
});

describe('isDefaultRubricShape', () => {
  test('nhận diện cấu trúc 4-2-2-2', () => {
    assert.equal(isDefaultRubricShape(DEFAULT_RUBRIC), true);
    assert.equal(isDefaultRubricShape(DEFAULT_RUBRIC.map((r) => ({ ...r, name: 'Đổi tên' }))), true);
  });

  test('bộ khác cấu trúc không dùng được động cơ chấm dự phòng', () => {
    assert.equal(isDefaultRubricShape(custom3), false);
    assert.equal(isDefaultRubricShape(DEFAULT_RUBRIC.map((r, i) => (i === 0 ? { ...r, max: 5 } : r))), false);
    assert.equal(isDefaultRubricShape(null), false);
  });
});
