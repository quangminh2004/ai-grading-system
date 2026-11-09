/**
 * Quản lý & Phân loại lỗi API AI (OpenAI, Gemini), Xử lý Retry thông minh & Theo dõi sức khỏe Providers
 */

// Hàm loại bỏ thông tin nhạy cảm (API Keys, Bearer tokens, query param secrets) khỏi thông báo lỗi
export function sanitizeErrorMessage(message, additionalSecrets = []) {
  if (!message || typeof message !== 'string') return '';

  let sanitized = message;

  // Loại bỏ các key truyền vào
  const secrets = [
    process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.JWT_SECRET,
    ...additionalSecrets,
  ].filter((s) => s && typeof s === 'string' && s.length > 5);

  for (const secret of secrets) {
    sanitized = sanitized.split(secret).join('[REDACTED_API_KEY]');
  }

  // Loại bỏ các pattern phổ biến của API keys và secrets
  sanitized = sanitized
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_OPENAI_KEY]')
    .replace(/AIzaSy[a-zA-Z0-9_-]{30,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/key=[a-zA-Z0-9_-]{15,}/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/mongodb\+srv:\/\/[^@]+@/gi, 'mongodb+srv://[USER:PASSWORD]@');

  return sanitized.trim();
}

// Phân loại lỗi từ OpenAI
export function classifyOpenAIError(status, dataOrText, rawError = null) {
  // Lỗi mạng hoặc timeout
  if (rawError) {
    const code = rawError.name === 'AbortError' || rawError.code === 'ETIMEDOUT' ? 'TIMEOUT' : (rawError.code || 'NETWORK_ERROR');
    return {
      provider: 'OpenAI',
      httpStatus: 0,
      errorCode: code,
      category: code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: sanitizeErrorMessage(rawError.message || 'Lỗi kết nối tới máy chủ OpenAI'),
      retryable: true,
    };
  }

  let errorObj = {};
  if (typeof dataOrText === 'object' && dataOrText !== null) {
    errorObj = dataOrText.error || dataOrText;
  } else if (typeof dataOrText === 'string') {
    try {
      const parsed = JSON.parse(dataOrText);
      errorObj = parsed.error || parsed;
    } catch {
      errorObj = { message: dataOrText };
    }
  }

  const rawCode = errorObj.code || '';
  const rawType = errorObj.type || '';
  const rawMsg = errorObj.message || '';

  // 1. OpenAI 429: Phân biệt rõ insufficient_quota vs rate_limit_exceeded
  if (status === 429) {
    if (
      rawCode === 'insufficient_quota' ||
      rawType === 'insufficient_quota' ||
      /insufficient_quota|quota|exceeded your current quota|billing/i.test(rawMsg)
    ) {
      return {
        provider: 'OpenAI',
        httpStatus: 429,
        errorCode: 'insufficient_quota',
        category: 'INSUFFICIENT_QUOTA',
        errorMessage: 'Tài khoản OpenAI đã hết số dư (credit/quota). Vui lòng nạp thêm credit hoặc chuyển sang Gemini.',
        retryable: false, // TUYỆT ĐỐI KHÔNG RETRY KHI HẾT CREDIT
      };
    }

    return {
      provider: 'OpenAI',
      httpStatus: 429,
      errorCode: rawCode || 'rate_limit_exceeded',
      category: 'RATE_LIMIT_EXCEEDED',
      errorMessage: sanitizeErrorMessage(rawMsg || 'Vượt quá giới hạn tần suất yêu cầu (Rate limit) của OpenAI.'),
      retryable: true, // Rate limit có thể retry có giới hạn sau backoff
    };
  }

  // 2. OpenAI 401: Invalid API Key
  if (status === 401) {
    return {
      provider: 'OpenAI',
      httpStatus: 401,
      errorCode: rawCode || 'invalid_api_key',
      category: 'INVALID_API_KEY',
      errorMessage: 'Khóa API OpenAI không hợp lệ hoặc đã bị vô hiệu hóa.',
      retryable: false, // KHÔNG RETRY
    };
  }

  // 3. OpenAI 404: Model Not Found
  if (status === 404) {
    return {
      provider: 'OpenAI',
      httpStatus: 404,
      errorCode: rawCode || 'model_not_found',
      category: 'MODEL_NOT_FOUND',
      errorMessage: sanitizeErrorMessage(rawMsg || 'Model OpenAI yêu cầu không tồn tại.'),
      retryable: false, // KHÔNG RETRY MODEL NÀY
    };
  }

  // 4. Lỗi máy chủ 500, 502, 503, 504
  if (status >= 500) {
    return {
      provider: 'OpenAI',
      httpStatus: status,
      errorCode: rawCode || `SERVER_ERROR_${status}`,
      category: 'SERVER_ERROR',
      errorMessage: `Máy chủ OpenAI phản hồi lỗi tạm thời (${status}).`,
      retryable: true, // Có thể retry
    };
  }

  // Các lỗi client khác (400, 422...)
  return {
    provider: 'OpenAI',
    httpStatus: status,
    errorCode: rawCode || `HTTP_${status}`,
    category: 'CLIENT_ERROR',
    errorMessage: sanitizeErrorMessage(rawMsg || `Yêu cầu tới OpenAI không hợp lệ (${status}).`),
    retryable: false,
  };
}

// Phân loại lỗi từ Gemini
export function classifyGeminiError(status, dataOrText, rawError = null) {
  // Lỗi mạng hoặc timeout
  if (rawError) {
    const code = rawError.name === 'AbortError' || rawError.code === 'ETIMEDOUT' ? 'TIMEOUT' : (rawError.code || 'NETWORK_ERROR');
    return {
      provider: 'Gemini',
      httpStatus: 0,
      errorCode: code,
      category: code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: sanitizeErrorMessage(rawError.message || 'Lỗi kết nối tới máy chủ Google Gemini'),
      retryable: true,
    };
  }

  let errorObj = {};
  if (typeof dataOrText === 'object' && dataOrText !== null) {
    errorObj = dataOrText.error || dataOrText;
  } else if (typeof dataOrText === 'string') {
    try {
      const parsed = JSON.parse(dataOrText);
      errorObj = parsed.error || parsed;
    } catch {
      errorObj = { message: dataOrText };
    }
  }

  const rawStatus = errorObj.status || '';
  const rawMsg = errorObj.message || '';
  const rawCode = errorObj.code || status;

  // 1. Gemini 403: PERMISSION_DENIED (Billing chưa bật hoặc không có quyền)
  if (status === 403 || rawStatus === 'PERMISSION_DENIED') {
    return {
      provider: 'Gemini',
      httpStatus: 403,
      errorCode: 'PERMISSION_DENIED',
      category: 'PERMISSION_DENIED',
      errorMessage: 'Google Gemini báo lỗi PERMISSION_DENIED: Lỗi quyền truy cập hoặc tài khoản chưa kích hoạt Billing / API.',
      retryable: false, // TUYỆT ĐỐI KHÔNG RETRY
    };
  }

  // 2. Gemini 404: NOT_FOUND (Model không tồn tại hoặc deprecated)
  if (status === 404 || rawStatus === 'NOT_FOUND') {
    return {
      provider: 'Gemini',
      httpStatus: 404,
      errorCode: 'NOT_FOUND',
      category: 'MODEL_NOT_FOUND',
      errorMessage: sanitizeErrorMessage(rawMsg || 'Model Gemini không tồn tại hoặc không hỗ trợ generateContent.'),
      retryable: false, // KHÔNG RETRY MODEL NÀY
    };
  }

  // 3. Gemini 429: RESOURCE_EXHAUSTED (Hết quota hoặc rate limit)
  if (status === 429 || rawStatus === 'RESOURCE_EXHAUSTED') {
    const isQuota = /quota|billing|credit/i.test(rawMsg);
    return {
      provider: 'Gemini',
      httpStatus: 429,
      errorCode: isQuota ? 'insufficient_quota' : 'rate_limit_exceeded',
      category: isQuota ? 'INSUFFICIENT_QUOTA' : 'RATE_LIMIT_EXCEEDED',
      errorMessage: isQuota
        ? 'Tài khoản Google Gemini đã hết quota/credit sử dụng.'
        : 'Google Gemini tạm thời đạt giới hạn tốc độ (Rate limit).',
      retryable: !isQuota, // Quota thì không retry, Rate limit thì retry có giới hạn
    };
  }

  // 4. Gemini 400: API_KEY_INVALID
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(rawMsg)) {
    return {
      provider: 'Gemini',
      httpStatus: 400,
      errorCode: 'API_KEY_INVALID',
      category: 'INVALID_API_KEY',
      errorMessage: 'Khóa API Google Gemini không hợp lệ.',
      retryable: false, // KHÔNG RETRY
    };
  }

  // 5. Lỗi máy chủ 500, 503
  if (status >= 500) {
    return {
      provider: 'Gemini',
      httpStatus: status,
      errorCode: rawStatus || `SERVER_ERROR_${status}`,
      category: 'SERVER_ERROR',
      errorMessage: `Máy chủ Google Gemini phản hồi lỗi tạm thời (${status}).`,
      retryable: true,
    };
  }

  return {
    provider: 'Gemini',
    httpStatus: status,
    errorCode: rawStatus || `HTTP_${status}`,
    category: 'CLIENT_ERROR',
    errorMessage: sanitizeErrorMessage(rawMsg || `Yêu cầu tới Gemini bị từ chối (${status}).`),
    retryable: false,
  };
}

// BỘ THEO DÕI SỨC KHỎE NHÀ CUNG CẤP AI (AI PROVIDER HEALTH TRACKER)
class AIProviderTracker {
  constructor() {
    this.providers = {
      openai: {
        name: 'OpenAI Vision (GPT-4o)',
        configured: Boolean(process.env.OPENAI_API_KEY),
        status: process.env.OPENAI_API_KEY ? 'unknown' : 'not_configured', // 'active' | 'insufficient_quota' | 'rate_limited' | 'permission_denied' | 'invalid_key' | 'unavailable' | 'not_configured'
        lastChecked: null,
        lastSuccess: null,
        lastError: null,
        activeModel: process.env.OPENAI_MODEL || 'gpt-4o',
      },
      gemini: {
        name: 'Google Gemini Vision',
        configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        status: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'unknown' : 'not_configured',
        lastChecked: null,
        lastSuccess: null,
        lastError: null,
        activeModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      },
    };
  }

  updateConfig() {
    this.providers.openai.configured = Boolean(process.env.OPENAI_API_KEY);
    if (!this.providers.openai.configured) {
      this.providers.openai.status = 'not_configured';
    }
    this.providers.gemini.configured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    if (!this.providers.gemini.configured) {
      this.providers.gemini.status = 'not_configured';
    }
  }

  recordSuccess(providerKey, model) {
    const key = providerKey.toLowerCase();
    if (!this.providers[key]) return;
    this.providers[key].status = 'active';
    this.providers[key].lastChecked = new Date();
    this.providers[key].lastSuccess = new Date();
    this.providers[key].lastError = null;
    if (model) this.providers[key].activeModel = model;
  }

  recordFailure(providerKey, model, errorInfo) {
    const key = providerKey.toLowerCase();
    if (!this.providers[key]) return;

    this.providers[key].lastChecked = new Date();
    this.providers[key].lastError = {
      httpStatus: errorInfo.httpStatus,
      errorCode: errorInfo.errorCode,
      errorMessage: sanitizeErrorMessage(errorInfo.errorMessage),
      timestamp: new Date(),
    };
    if (model) this.providers[key].activeModel = model;

    // Gán trạng thái rõ ràng cho quản trị viên
    switch (errorInfo.category) {
      case 'INSUFFICIENT_QUOTA':
        this.providers[key].status = 'insufficient_quota';
        break;
      case 'PERMISSION_DENIED':
        this.providers[key].status = 'permission_denied';
        break;
      case 'INVALID_API_KEY':
        this.providers[key].status = 'invalid_key';
        break;
      case 'RATE_LIMIT_EXCEEDED':
        this.providers[key].status = 'rate_limited';
        break;
      default:
        this.providers[key].status = 'unavailable';
        break;
    }
  }

  getStatus() {
    this.updateConfig();
    return {
      timestamp: new Date(),
      providers: { ...this.providers },
      summary: {
        hasActiveProvider: Object.values(this.providers).some((p) => p.status === 'active'),
        allUnavailable: Object.values(this.providers).every((p) => ['insufficient_quota', 'permission_denied', 'invalid_key', 'unavailable', 'not_configured'].includes(p.status)),
      },
    };
  }
}

export const aiProviderTracker = new AIProviderTracker();

// HÀM FETCH CÓ RETRY THÔNG MINH (Chỉ retry khi gặp rate-limit hoặc lỗi server, KHÔNG retry khi lỗi credit/billing/model)
export async function fetchWithRetry(url, options = {}, { maxRetries = 2, timeoutMs = 45000, provider = 'OpenAI' } = {}) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Nếu thành công (HTTP 2xx)
      if (response.ok) {
        return { ok: true, response, errorInfo: null };
      }

      // Xử lý khi HTTP status != 2xx
      const rawText = await response.text();
      const errorInfo = provider === 'OpenAI'
        ? classifyOpenAIError(response.status, rawText)
        : classifyGeminiError(response.status, rawText);

      console.warn(`[${provider}] HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}):`, errorInfo.errorMessage);

      // Nếu lỗi KHÔNG ĐƯỢC PHÉP RETRY (Hết credit, Permission Denied, Invalid API Key, Model 404) -> DỪNG NGAY
      if (!errorInfo.retryable) {
        console.warn(`🛑 [${provider}] Gặp lỗi không thể phục hồi (${errorInfo.errorCode}). Không retry tiếp.`);
        return { ok: false, response: null, errorInfo, rawText };
      }

      // Nếu còn lượt retry và lỗi có thể retry (Rate limit, 500, 503)
      if (attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 300, 4000);
        console.log(`⏳ [${provider}] Thử lại lần ${attempt}/${maxRetries} sau ${Math.round(backoffMs)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return { ok: false, response: null, errorInfo, rawText };
    } catch (networkErr) {
      clearTimeout(timeoutId);

      const errorInfo = provider === 'OpenAI'
        ? classifyOpenAIError(0, null, networkErr)
        : classifyGeminiError(0, null, networkErr);

      console.warn(`[${provider}] Network error (attempt ${attempt + 1}/${maxRetries + 1}):`, errorInfo.errorMessage);

      if (attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 300, 4000);
        console.log(`⏳ [${provider}] Thử lại mạng lần ${attempt}/${maxRetries} sau ${Math.round(backoffMs)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return { ok: false, response: null, errorInfo, rawText: '' };
    }
  }

  return {
    ok: false,
    response: null,
    errorInfo: {
      provider,
      httpStatus: 0,
      errorCode: 'MAX_RETRIES_EXCEEDED',
      category: 'TIMEOUT',
      errorMessage: `Đã thử lại ${maxRetries} lần nhưng không thành công.`,
      retryable: false,
    },
    rawText: '',
  };
}

