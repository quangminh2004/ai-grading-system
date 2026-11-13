import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toSchoolSlug } from '../src/controllers/classController.js';

describe('toSchoolSlug', () => {
  test('bỏ tiền tố Trường Tiểu học và dấu tiếng Việt', () => {
    assert.equal(toSchoolSlug('Trường Tiểu học Yên Nghĩa'), 'YENNGHIA');
  });

  test('bỏ tiền tố Trường', () => {
    assert.equal(toSchoolSlug('Trường Thanh Lân'), 'THANHLAN');
  });

  test('chuỗi rỗng → TRUONG', () => {
    assert.equal(toSchoolSlug(''), 'TRUONG');
    assert.equal(toSchoolSlug(null), 'TRUONG');
  });
});
