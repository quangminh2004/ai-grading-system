import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rejectIfApprovedForAI } from '../src/controllers/submissionController.js';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('rejectIfApprovedForAI', () => {
  test('chặn bài đã được giáo viên duyệt với HTTP 400', () => {
    const res = createMockRes();
    const rejected = rejectIfApprovedForAI(res, { state: 'approved' });
    assert.equal(rejected, true);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /đã được giáo viên duyệt/);
  });

  test('cho phép chấm AI với các trạng thái chưa duyệt hoặc bài null', () => {
    for (const state of ['new', 'suggested', 'needs_review', 'provider_unavailable', 'failed']) {
      const res = createMockRes();
      assert.equal(rejectIfApprovedForAI(res, { state }), false);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, null);
    }
    const resNull = createMockRes();
    assert.equal(rejectIfApprovedForAI(resNull, null), false);
  });
});

