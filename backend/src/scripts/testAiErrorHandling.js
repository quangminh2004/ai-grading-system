/**
 * Kịch bản kiểm thử (Test Suite) cho Hệ thống Phân loại lỗi AI, Cơ chế Retry & Bảo vệ Dữ liệu
 * Chạy kiểm thử: node backend/src/scripts/testAiErrorHandling.js
 */

import {
  sanitizeErrorMessage,
  classifyOpenAIError,
  classifyGeminiError,
  aiProviderTracker,
} from '../services/aiErrorHandler.js';
import { autoGradeSubmission } from '../services/aiGradingService.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỆ THỐNG PHÂN LOẠI LỖI AI & BẢO VỆ CHẤM ĐIỂM');
  console.log('================================================================\n');

  // TEST 1: OpenAI 429 insufficient_quota (Hết credit -> Không retry)
  console.log('--- TEST 1: Phân loại lỗi OpenAI 429 insufficient_quota ---');
  const openAiQuotaErr = classifyOpenAIError(429, {
    error: {
      code: 'insufficient_quota',
      message: 'You exceeded your current quota, please check your plan and billing details.',
      type: 'insufficient_quota',
    },
  });
  assert(openAiQuotaErr.category === 'INSUFFICIENT_QUOTA', 'Xác định đúng category INSUFFICIENT_QUOTA');
  assert(openAiQuotaErr.retryable === false, 'Đảm bảo KHÔNG RETRY khi hết credit');
  assert(openAiQuotaErr.errorCode === 'insufficient_quota', 'Lưu đúng mã errorCode');

  // TEST 2: OpenAI 429 rate_limit_exceeded (Giới hạn tốc độ -> Được retry có giới hạn)
  console.log('\n--- TEST 2: Phân loại lỗi OpenAI 429 rate_limit_exceeded ---');
  const openAiRateErr = classifyOpenAIError(429, {
    error: {
      code: 'rate_limit_exceeded',
      message: 'Rate limit reached for requests per min.',
      type: 'requests',
    },
  });
  assert(openAiRateErr.category === 'RATE_LIMIT_EXCEEDED', 'Xác định đúng category RATE_LIMIT_EXCEEDED');
  assert(openAiRateErr.retryable === true, 'Cho phép retry có giới hạn với rate limit');

  // TEST 3: Gemini 403 PERMISSION_DENIED (Lỗi billing / quyền truy cập -> Không retry)
  console.log('\n--- TEST 3: Phân loại lỗi Gemini 403 PERMISSION_DENIED ---');
  const gemini403Err = classifyGeminiError(403, {
    error: {
      code: 403,
      status: 'PERMISSION_DENIED',
      message: 'The caller does not have permission / Billing not enabled.',
    },
  });
  assert(gemini403Err.category === 'PERMISSION_DENIED', 'Xác định đúng category PERMISSION_DENIED');
  assert(gemini403Err.retryable === false, 'Đảm bảo KHÔNG RETRY khi gặp PERMISSION_DENIED (Billing)');

  // TEST 4: Gemini 404 NOT_FOUND (Model không tồn tại -> Không retry model đó)
  console.log('\n--- TEST 4: Phân loại lỗi Gemini 404 NOT_FOUND ---');
  const gemini404Err = classifyGeminiError(404, {
    error: {
      code: 404,
      status: 'NOT_FOUND',
      message: 'models/gemini-2.0-flash is no longer available.',
    },
  });
  assert(gemini404Err.category === 'MODEL_NOT_FOUND', 'Xác định đúng category MODEL_NOT_FOUND');
  assert(gemini404Err.retryable === false, 'Đảm bảo KHÔNG RETRY khi model không tồn tại');

  // TEST 5: Phân loại lỗi Server (500, 502, 503) & Timeout
  console.log('\n--- TEST 5: Phân loại lỗi Server & Timeout (Có retry) ---');
  const serverErr = classifyOpenAIError(503, 'Service Temporarily Unavailable');
  assert(serverErr.category === 'SERVER_ERROR', 'Xác định đúng SERVER_ERROR cho HTTP 503');
  assert(serverErr.retryable === true, 'Cho phép retry với lỗi 503');

  const timeoutErr = classifyOpenAIError(0, null, { name: 'AbortError', message: 'The operation was aborted due to timeout' });
  assert(timeoutErr.category === 'TIMEOUT', 'Xác định đúng category TIMEOUT');
  assert(timeoutErr.retryable === true, 'Cho phép retry với lỗi Timeout');

  // TEST 6: Làm sạch dữ liệu nhạy cảm (Sanitization)
  console.log('\n--- TEST 6: Kiểm tra loại bỏ thông tin nhạy cảm (Sanitization) ---');
  const sampleKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
  const sensitiveMsg = `Error calling OpenAI with key=${sampleKey} and Bearer ${sampleKey}. Secret: AIzaSyD1234567890abcdefghijklmnopqrstuv`;
  const sanitized = sanitizeErrorMessage(sensitiveMsg, [sampleKey]);
  assert(!sanitized.includes('sk-proj-'), 'Không còn chứa OpenAI secret key');
  assert(!sanitized.includes('AIzaSy'), 'Không còn chứa Gemini secret key');
  assert(sanitized.includes('[REDACTED'), 'Được thay thế bằng nhãn [REDACTED]');

  // TEST 7: Theo dõi sức khỏe nhà cung cấp (aiProviderTracker)
  console.log('\n--- TEST 7: Kiểm tra theo dõi sức khỏe nhà cung cấp (Tracker) ---');
  aiProviderTracker.recordFailure('openai', 'gpt-4o', openAiQuotaErr);
  const statusAfterQuota = aiProviderTracker.getStatus();
  assert(statusAfterQuota.providers.openai.status === 'insufficient_quota', 'Tracker ghi nhận đúng status insufficient_quota cho OpenAI');
  assert(statusAfterQuota.providers.openai.lastError.errorCode === 'insufficient_quota', 'Tracker lưu đúng mã lỗi gần nhất');

  aiProviderTracker.recordSuccess('openai', 'gpt-4o');
  const statusAfterSuccess = aiProviderTracker.getStatus();
  assert(statusAfterSuccess.providers.openai.status === 'active', 'Tracker cập nhật lại active khi gọi thành công');

  // TEST 8: Quy tắc cốt lõi: Không tự động dùng Tesseract để chấm bài viết tay khi AI Vision thất bại
  console.log('\n--- TEST 8: Bảo vệ bài viết tay khi AI Vision lỗi (Không sinh rác Tesseract) ---');
  const mockSubmission = {
    studentId: 'HS05',
    classId: 'TEST_CLASS',
    state: 'new',
    text: '',
    scores: [],
    attachments: [
      {
        name: 'bai_lam_viet_tay_trang_1.jpg',
        type: 'image/jpeg',
        filePath: '/uploads/non_existent_file.jpg',
      },
    ],
    logs: [],
  };

  // Giả lập chạy autoGradeSubmission khi không tìm thấy file hoặc AI Vision lỗi
  await autoGradeSubmission(mockSubmission, { forceReOcr: true });

  assert(
    mockSubmission.state === 'needs_review' || mockSubmission.state === 'provider_unavailable' || mockSubmission.state === 'failed',
    `Trạng thái bài nộp được chuyển sang đúng enum (${mockSubmission.state}), không tự tiện lưu text rác`
  );
  assert(mockSubmission.text === '', 'Nội dung bài viết vẫn là chuỗi rỗng sạch, không chứa ký tự rác');
  assert(mockSubmission.scores.length === 0, 'Điểm số không bị chấm bừa bãi khi chưa đọc được bài');

  console.log('\n================================================================');
  console.log(`🎉 KẾT QUẢ: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================');

  if (failed === 0) {
    console.log('✓ TOÀN BỘ CÁC BÀI KIỂM THỬ ĐÃ VƯỢT QUA XUẤT SẮC!');
  }
}

runTestSuite().catch((err) => {
  console.error('Lỗi khi chạy test suite:', err);
});

