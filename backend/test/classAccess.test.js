import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessClass } from '../src/middleware/auth.js';

const cls = { classId: '4A', school: 'Trường A', teacherUsername: 'cothu' };

describe('canAccessClass', () => {
  test('admin truy cập được mọi lớp', () => {
    assert.equal(canAccessClass({ role: 'admin', username: 'admin', school: 'Khác' }, cls), true);
  });

  test('giáo viên cùng trường truy cập được', () => {
    assert.equal(canAccessClass({ role: 'teacher', username: 'colan', school: 'Trường A' }, cls), true);
  });

  test('giáo viên tạo lớp truy cập được dù khác trường', () => {
    assert.equal(canAccessClass({ role: 'teacher', username: 'cothu', school: 'Trường B' }, cls), true);
  });

  test('giáo viên được phân công lớp truy cập được', () => {
    assert.equal(
      canAccessClass({ role: 'teacher', username: 'x', school: 'Trường B', assignedClasses: ['4A'] }, cls),
      true
    );
  });

  test('giáo viên trường khác, không phân công → bị chặn', () => {
    assert.equal(
      canAccessClass({ role: 'teacher', username: 'x', school: 'Trường B', assignedClasses: ['4B'] }, cls),
      false
    );
  });

  test('lớp không có giáo viên phụ trách không mở cho người có username rỗng', () => {
    const orphan = { classId: '4Z', school: 'Trường A', teacherUsername: '' };
    assert.equal(canAccessClass({ role: 'teacher', username: '', school: 'Trường B' }, orphan), false);
  });

  test('chưa đăng nhập, vai trò lạ hoặc thiếu lớp → bị chặn', () => {
    assert.equal(canAccessClass(null, cls), false);
    assert.equal(canAccessClass({ role: 'student', username: 'cothu', school: 'Trường A' }, cls), false);
    assert.equal(canAccessClass({ role: 'admin' }, null), false);
  });
});
