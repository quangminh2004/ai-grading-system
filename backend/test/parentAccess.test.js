import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessChild, canAccessClass, canManageClass } from '../src/middleware/auth.js';

const cls = { classId: '4A', school: 'Trường A', teacherUsername: 'cothu' };

const parentUser = {
  role: 'parent',
  username: 'phuynh1',
  school: 'Trường A',
  children: [
    { classId: '4A', studentId: 'HS01' },
    { classId: '5B', studentId: 'HS03' },
  ],
};

describe('canAccessChild', () => {
  test('phụ huynh truy cập đúng con đã gắn', () => {
    assert.equal(canAccessChild(parentUser, '4A', 'HS01'), true);
    assert.equal(canAccessChild(parentUser, '5B', 'hs03'), true); // studentId không phân biệt hoa thường
  });

  test('phụ huynh không truy cập con khác hoặc lớp khác', () => {
    assert.equal(canAccessChild(parentUser, '4A', 'HS02'), false);
    assert.equal(canAccessChild(parentUser, '4B', 'HS01'), false);
  });

  test('giáo viên / admin / null không dùng canAccessChild', () => {
    assert.equal(canAccessChild({ role: 'teacher', children: [{ classId: '4A', studentId: 'HS01' }] }, '4A', 'HS01'), false);
    assert.equal(canAccessChild({ role: 'admin' }, '4A', 'HS01'), false);
    assert.equal(canAccessChild(null, '4A', 'HS01'), false);
  });

  test('thiếu children hoặc thiếu tham số → bị chặn', () => {
    assert.equal(canAccessChild({ role: 'parent', children: [] }, '4A', 'HS01'), false);
    assert.equal(canAccessChild({ role: 'parent' }, '4A', 'HS01'), false);
    assert.equal(canAccessChild(parentUser, '', 'HS01'), false);
    assert.equal(canAccessChild(parentUser, '4A', ''), false);
  });
});

describe('parent không dùng quyền lớp của giáo viên', () => {
  test('canAccessClass từ chối parent (tránh lộ cả lớp)', () => {
    assert.equal(canAccessClass(parentUser, cls), false);
  });

  test('canManageClass từ chối parent', () => {
    assert.equal(canManageClass(parentUser, cls), false);
  });
});
