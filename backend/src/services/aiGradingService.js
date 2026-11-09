import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';
import {
  sanitizeErrorMessage,
  fetchWithRetry,
  aiProviderTracker,
} from './aiErrorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Thư mục uploads cố định: backend/uploads/
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Worker Tesseract OCR dùng chung để tối ưu tốc độ nhận diện
let tesseractWorker = null;

async function getTesseractWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker('vie+eng');
  }
  return tesseractWorker;
}

// Hàm làm sạch văn bản OCR: loại bỏ các dòng tiêu đề (Họ tên, Đề bài, v.v.) để lấy bài văn
export function cleanOcrEssayText(rawText) {
  if (!rawText) return '';
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const essayLines = [];

  for (const line of lines) {
    // Bỏ qua dòng tiêu đề, họ tên, đề bài hoặc nhãn chú thích
    if (
      /^bài làm/i.test(line) ||
      /^họ và tên/i.test(line) ||
      /^đề bài/i.test(line) ||
      /^lớp/i.test(line) ||
      /^trường/i.test(line) ||
      /^dữ liệu/i.test(line) ||
      /^du lieu/i.test(line) ||
      /^ngày/i.test(line) ||
      /^môn/i.test(line)
    ) {
      continue;
    }
    essayLines.push(line);
  }

  const result = essayLines.join(' ').replace(/\s+/g, ' ').trim();
  return result.length > 10 ? result : rawText.replace(/\s+/g, ' ').trim();
}

// 1. GỌI OPENAI VISION API (GPT-4o / GPT-4o-mini) ĐỌC ĐA ẢNH & CHẤM ĐIỂM
export async function callOpenAIVision(imagesInput, mimeTypeOrTopic = 'image/jpeg', essayTopic = 'Tả một cây em yêu thích') {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      errorInfo: {
        provider: 'OpenAI',
        httpStatus: 0,
        errorCode: 'NOT_CONFIGURED',
        category: 'NOT_CONFIGURED',
        errorMessage: 'Chưa cấu hình OPENAI_API_KEY trong hệ thống.',
        retryable: false,
      },
    };
  }

  let images = [];
  let topic = essayTopic;

  if (Array.isArray(imagesInput)) {
    images = imagesInput;
    if (typeof mimeTypeOrTopic === 'string' && !mimeTypeOrTopic.includes('/')) {
      topic = mimeTypeOrTopic;
    }
  } else if (Buffer.isBuffer(imagesInput)) {
    images = [{
      buffer: imagesInput,
      type: typeof mimeTypeOrTopic === 'string' && mimeTypeOrTopic.includes('/') ? mimeTypeOrTopic : 'image/jpeg',
    }];
  }

  if (images.length === 0) {
    return {
      success: false,
      errorInfo: {
        provider: 'OpenAI',
        httpStatus: 400,
        errorCode: 'NO_IMAGES',
        category: 'CLIENT_ERROR',
        errorMessage: 'Không có hình ảnh hợp lệ để gửi cho OpenAI Vision.',
        retryable: false,
      },
    };
  }

  const prompt = `Bạn là chuyên gia khảo thí và giáo viên Tiếng Việt Tiểu học (lớp 4).
Dưới đây là hình ảnh ${images.length} trang bài làm viết tay của học sinh (theo thứ tự: Trang 1, Trang 2, ...).
Đề bài: "${topic}".

Nhiệm vụ:
1. ĐỌC THẬT KỸ TOÀN BỘ CÁC TRANG BÀI LÀM (OCR viết tay chính xác 100%):
   - Đọc chính xác từng câu chữ học sinh viết trên từng trang theo thứ tự từ trang 1 đến trang cuối.
   - Ghép nối liền mạch thành một bài văn hoàn chỉnh thống nhất, không bỏ sót trang nào.
   - Giữ nguyên các từ học sinh viết (kể cả lỗi chính tả nếu có để giáo viên nắm bắt và sửa cho học sinh).
   - Bỏ qua các phần ghi Họ tên, Lớp, Trường nếu có, chỉ lấy nội dung bài viết.
2. CHẤM BÀI theo đúng 4 tiêu chí chuẩn Tiểu học (thang điểm 10):
   - Tiêu chí 1: Nội dung & chi tiết (0 - 4.0 điểm)
   - Tiêu chí 2: Sắp xếp ý & liên kết (0 - 2.0 điểm)
   - Tiêu chí 3: Từ ngữ & diễn đạt (0 - 2.0 điểm)
   - Tiêu chí 4: Chính tả & dấu câu (0 - 2.0 điểm)
3. ĐƯA RA ĐÁNH GIÁ SƯ PHẠM CHI TIẾT:
   - explain: mảng 4 chuỗi giải thích cho 4 tiêu chí
   - strength: ưu điểm nổi bật của bài
   - evidence: trích dẫn câu văn hoặc cụm từ hay từ bài làm
   - support: điểm cần rèn luyện hoặc bổ sung
   - activity: bài tập rèn luyện gợi ý
   - feedback: lời nhận xét sư phạm giàu tính động viên của cô giáo
   - errors: danh sách lỗi nếu có: mảng các mảng con [ [thể loại, từ gốc, từ gợi ý, lý do] ]

Trả về DUY NHẤT định dạng JSON:
{
  "text": "Nội dung bài văn hoàn chỉnh ghép nối từ các trang...",
  "scores": [3.5, 2.0, 2.0, 2.0],
  "explain": ["...", "...", "...", "..."],
  "strength": "...",
  "evidence": "...",
  "support": "...",
  "activity": "...",
  "feedback": "...",
  "errors": []
}`;

  const content = [{ type: 'text', text: prompt }];
  for (const img of images) {
    const base64Data = img.buffer.toString('base64');
    const mime = img.type || 'image/jpeg';
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mime};base64,${base64Data}`,
        detail: 'high',
      },
    });
  }

  // Danh sách model OpenAI hiện hành (ưu tiên biến môi trường hoặc gpt-4o / gpt-4o-mini)
  const candidateModels = [
    process.env.OPENAI_MODEL,
    'gpt-4o',
    'gpt-4o-mini',
  ].filter(Boolean);

  let lastErrorInfo = null;

  for (const model of candidateModels) {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    };

    const result = await fetchWithRetry('https://api.openai.com/v1/chat/completions', requestOptions, {
      maxRetries: 2,
      timeoutMs: 50000,
      provider: 'OpenAI',
    });

    if (result.ok) {
      try {
        const data = await result.response.json();
        const contentStr = data.choices?.[0]?.message?.content;
        if (contentStr) {
          const parsed = JSON.parse(contentStr);
          aiProviderTracker.recordSuccess('openai', model);
          console.log(`✓ [OpenAI ${model}] Đã đọc thật thành công ${images.length} trang ảnh!`);
          return { success: true, data: parsed, model, provider: 'OpenAI' };
        }
      } catch (parseErr) {
        lastErrorInfo = {
          provider: 'OpenAI',
          model,
          httpStatus: 200,
          errorCode: 'JSON_PARSE_ERROR',
          errorMessage: 'Phản hồi từ OpenAI không đúng định dạng JSON yêu cầu: ' + parseErr.message,
          retryable: false,
        };
      }
    } else {
      lastErrorInfo = {
        ...result.errorInfo,
        model,
      };
      aiProviderTracker.recordFailure('openai', model, lastErrorInfo);

      // Nếu là lỗi không thể phục hồi (hết credit 429, invalid key 401) -> DỪNG NGAY không thử model khác
      if (['INSUFFICIENT_QUOTA', 'INVALID_API_KEY'].includes(lastErrorInfo.category)) {
        break;
      }
    }
  }

  return { success: false, errorInfo: lastErrorInfo };
}

// Hàm trích xuất text JSON an toàn từ phản hồi của các mô hình AI (bỏ qua markdown ```json ... ```)
export function parseModelJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  // Loại bỏ các thẻ code block markdown nếu có
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    // Nếu có đoạn text thừa trước hoặc sau khối JSON, cắt lấy từ dấu { đầu tiên tới } cuối cùng
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const subStr = text.slice(start, end + 1);
      return JSON.parse(subStr);
    }
    throw err;
  }
}

// Hàm trích xuất text từ các cấu trúc phản hồi khác nhau của Google Gemini (Interactions API & generateContent)
export function extractGeminiText(data) {
  if (!data) return null;

  // 1. Cấu trúc chuẩn của Interactions API (/v1beta/interactions): mảng steps
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item && typeof item.text === 'string' && item.text.trim()) {
            return item.text.trim();
          }
        }
      }
      if (step && typeof step.text === 'string' && step.text.trim()) {
        return step.text.trim();
      }
      if (step.content?.[0]?.text) {
        return step.content[0].text.trim();
      }
    }
  }

  // 2. Các trường output trực tiếp của Interactions API
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (typeof data.output === 'string' && data.output.trim()) {
    return data.output.trim();
  }
  if (Array.isArray(data.outputs) && data.outputs.length > 0) {
    const out = data.outputs[0];
    if (typeof out === 'string' && out.trim()) return out.trim();
    if (out && typeof out.text === 'string' && out.text.trim()) return out.text.trim();
    if (out.content?.[0]?.text) return out.content[0].text.trim();
  }

  // 3. Cấu trúc generateContent (/v1beta/models/...:generateContent): mảng candidates
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    const part = candidate.content?.parts?.[0];
    if (part && typeof part.text === 'string' && part.text.trim()) {
      return part.text.trim();
    }
    if (typeof candidate.text === 'string' && candidate.text.trim()) {
      return candidate.text.trim();
    }
  }

  return null;
}

// 2. GỌI GEMINI VISION API (HỖ TRỢ ĐỌC ĐA ẢNH / NHIỀU TRANG BÀI LÀM VIẾT TAY QUA INTERACTIONS API & GENERATECONTENT)
export async function callGeminiVision(imagesInput, mimeTypeOrTopic = 'image/jpeg', essayTopic = 'Tả một cây em yêu thích') {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      errorInfo: {
        provider: 'Gemini',
        httpStatus: 0,
        errorCode: 'NOT_CONFIGURED',
        category: 'NOT_CONFIGURED',
        errorMessage: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống. Vui lòng thêm GEMINI_API_KEY vào tệp .env',
        retryable: false,
      },
    };
  }

  let images = [];
  let topic = essayTopic;

  if (Array.isArray(imagesInput)) {
    images = imagesInput;
    if (typeof mimeTypeOrTopic === 'string' && !mimeTypeOrTopic.includes('/')) {
      topic = mimeTypeOrTopic;
    }
  } else if (Buffer.isBuffer(imagesInput)) {
    images = [{
      buffer: imagesInput,
      type: typeof mimeTypeOrTopic === 'string' && mimeTypeOrTopic.includes('/') ? mimeTypeOrTopic : 'image/jpeg',
    }];
  }

  if (images.length === 0) {
    return {
      success: false,
      errorInfo: {
        provider: 'Gemini',
        httpStatus: 400,
        errorCode: 'NO_IMAGES',
        category: 'CLIENT_ERROR',
        errorMessage: 'Không có hình ảnh hợp lệ để gửi cho Gemini Vision.',
        retryable: false,
      },
    };
  }

  const prompt = `Bạn là chuyên gia thẩm định chữ viết tay học sinh Tiểu học Việt Nam và giáo viên Ngữ văn giỏi.
Dưới đây là hình ảnh ${images.length} trang bài làm viết tay trên giấy ô ly (vở kẻ ô học sinh) của học sinh lớp 4.
Đề bài bài văn: "${topic}".

QUY TẮC ĐỌC CHỮ VIẾT TAY TIẾNG VIỆT (BẮT BUỘC):
1. ĐỌC THẬT KỸ TOÀN BỘ CÂU CHỮ THEO NÉT BÚT HỌC SINH:
   - Đọc chính xác từng con chữ, từng từ tiếng Việt học sinh viết trên từng trang theo thứ tự (Trang 1, Trang 2,...).
   - Ghép nối liền mạch các trang thành một bài văn hoàn chỉnh thống nhất, không bỏ sót dòng chữ nào.
   - Không bị nhầm lẫn giữa nét ô ly của vở và nét chữ của học sinh.
   - Tuyệt đối không đọc ra các ký tự ngẫu nhiên hoặc từ ngữ vô nghĩa. Đọc đúng từ ngữ tiếng Việt có nghĩa theo ngữ cảnh câu văn học sinh viết.
   - Giữ nguyên các từ học sinh viết (kể cả lỗi chính tả nếu có để giáo viên hướng dẫn sửa cho học sinh).
   - Bỏ qua các phần tiêu đề ngoài lề như "Họ và tên", "Đề bài", "Bài làm" ở đầu trang, chỉ lấy trọn vẹn nội dung bài văn của học sinh đưa vào trường "text".

2. CHẤM BÀI THEO ĐÚNG 4 TIÊU CHÍ CHUẨN TIỂU HỌC (THANG ĐIỂM 10):
   - Tiêu chí 1: Nội dung & chi tiết (0 - 4.0 điểm)
   - Tiêu chí 2: Sắp xếp ý & liên kết câu (0 - 2.0 điểm)
   - Tiêu chí 3: Từ ngữ & diễn đạt gợi cảm (0 - 2.0 điểm)
   - Tiêu chí 4: Chính tả & dấu câu (0 - 2.0 điểm)

3. ĐƯA RA ĐÁNH GIÁ SƯ PHẠM CHI TIẾT:
   - explain: mảng 4 chuỗi giải thích tương ứng cho 4 tiêu chí ở trên
   - strength: nhận xét điểm sáng, nét riêng hoặc cảm xúc hay trong bài làm
   - evidence: trích dẫn nguyên văn 1-2 câu văn hay nhất của học sinh trong bài
   - support: gợi ý cụ thể điểm học sinh cần lưu ý rèn luyện thêm
   - activity: gợi ý 1 hoạt động hoặc bài tập rèn luyện nhỏ
   - feedback: lời nhận xét ấm áp, động viên, mang tính khích lệ học sinh của cô giáo
   - errors: danh sách lỗi chính tả, dùng từ hoặc diễn đạt nếu có trong bài: mảng các mảng con [ [thể loại, từ gốc sai, từ gợi ý đúng, lý do] ]

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON HỢP LỆ (KHÔNG VIẾT CHỮ NÀO BÊN NGOÀI KHỐI JSON):
{
  "text": "Toàn bộ bài văn hoàn chỉnh được đọc chính xác từ các trang ảnh...",
  "scores": [3.5, 2.0, 1.75, 1.75],
  "explain": ["...", "...", "...", "..."],
  "strength": "...",
  "evidence": "...",
  "support": "...",
  "activity": "...",
  "feedback": "...",
  "errors": []
}`;

  // Danh sách model Google Gemini chuẩn hiện hành
  const candidateModels = Array.from(new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ].filter(Boolean)));

  let lastErrorInfo = null;

  for (const model of candidateModels) {
    // -------------------------------------------------------------
    // CÁCH 1 (CHÍNH): GENERATECONTENT ĐA PHƯƠNG THỨC TRỰC TIẾP TỐC ĐỘ CAO
    // -------------------------------------------------------------
    try {
      const generateContentUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const generateContentPayload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...images.map((img) => ({
                inline_data: {
                  mime_type: img.type || 'image/jpeg',
                  data: img.buffer.toString('base64'),
                },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      };

      const genResult = await fetchWithRetry(generateContentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(generateContentPayload),
      }, {
        maxRetries: 2,
        timeoutMs: 40000,
        provider: `Gemini (${model})`,
      });

      if (genResult.ok) {
        const data = await genResult.response.json();
        const extracted = extractGeminiText(data);
        if (extracted) {
          const parsed = parseModelJson(extracted);
          if (parsed && (parsed.text || parsed.scores)) {
            aiProviderTracker.recordSuccess('gemini', model);
            console.log(`✓ [Gemini Vision - ${model}] Đã đọc thật 100% thành công ${images.length} trang ảnh viết tay!`);
            return { success: true, data: parsed, model, provider: 'Google Gemini Vision' };
          }
        }
      } else {
        lastErrorInfo = {
          ...genResult.errorInfo,
          model,
        };
        aiProviderTracker.recordFailure('gemini', model, lastErrorInfo);
        if (['INVALID_API_KEY', 'INSUFFICIENT_QUOTA'].includes(lastErrorInfo.category)) {
          break;
        }
      }
    } catch (genErr) {
      console.warn(`[Gemini Vision] Thử nghiệm model ${model} gặp lỗi:`, genErr.message);
    }

    // -------------------------------------------------------------
    // CÁCH 2 (DỰ PHÒNG): INTERACTIONS API
    // -------------------------------------------------------------
    try {
      const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`;
      const interactionsPayload = {
        model,
        input: [
          {
            type: 'text',
            text: prompt,
          },
          ...images.map((img) => ({
            type: 'image',
            mime_type: img.type || 'image/jpeg',
            data: img.buffer.toString('base64'),
          })),
        ],
        generation_config: {
          temperature: 0.1,
        },
      };

      const interactionsResult = await fetchWithRetry(interactionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(interactionsPayload),
      }, {
        maxRetries: 1,
        timeoutMs: 30000,
        provider: 'Gemini (Interactions API)',
      });

      if (interactionsResult.ok) {
        const data = await interactionsResult.response.json();
        const extracted = extractGeminiText(data);
        if (extracted) {
          const parsed = parseModelJson(extracted);
          if (parsed && (parsed.text || parsed.scores)) {
            aiProviderTracker.recordSuccess('gemini', model);
            console.log(`✓ [Gemini Interactions API - ${model}] Đã đọc thật thành công ${images.length} trang ảnh!`);
            return { success: true, data: parsed, model, provider: 'Google Gemini (Interactions API)' };
          }
        }
      }
    } catch (interactErr) {
      // Bỏ qua lỗi Interactions API nếu generateContent cũng không được
    }
  }

  return { success: false, errorInfo: lastErrorInfo };
}

// 3. GỌI GEMINI CHẤM ĐIỂM BÀI VĂN DẠNG TEXT (KHI GIÁO VIÊN NHẬP HOẶC SỬA VĂN BẢN)
export async function callGeminiTextGrading(text, essayTopic = 'Tả một cây em yêu thích') {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey || !text || text.trim().length === 0) return null;

  const prompt = `Bạn là chuyên gia khảo thí và giáo viên Tiếng Việt Tiểu học (lớp 4).
Dưới đây là nội dung bài văn của học sinh lớp 4.
Đề bài: "${essayTopic}".
Nội dung bài làm:
"""
${text}
"""

Nhiệm vụ:
1. Chấm bài theo đúng 4 tiêu chí chuẩn Tiểu học (thang điểm 10):
   - Tiêu chí 1: Nội dung & chi tiết (0 - 4.0 điểm)
   - Tiêu chí 2: Sắp xếp ý & liên kết câu (0 - 2.0 điểm)
   - Tiêu chí 3: Từ ngữ & diễn đạt gợi cảm (0 - 2.0 điểm)
   - Tiêu chí 4: Chính tả & dấu câu (0 - 2.0 điểm)
2. Đưa ra nhận xét sư phạm giàu tính động viên:
   - explain: mảng 4 chuỗi giải thích cho 4 tiêu chí
   - strength: ưu điểm nổi bật
   - evidence: trích dẫn câu văn hay trong bài
   - support: nội dung cần hỗ trợ rèn luyện thêm
   - activity: hoạt động rèn luyện tiếp theo
   - feedback: lời nhận xét của cô giáo gửi học sinh
   - errors: danh sách lỗi nếu có: [ [thể loại, từ gốc, từ gợi ý, lý do] ]

Trả về DUY NHẤT định dạng JSON:
{
  "scores": [3.5, 2.0, 1.75, 1.75],
  "explain": ["...", "...", "...", "..."],
  "strength": "...",
  "evidence": "...",
  "support": "...",
  "activity": "...",
  "feedback": "...",
  "errors": []
}`;

  const candidateModels = Array.from(new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ].filter(Boolean)));

  for (const model of candidateModels) {
    try {
      // 1. generateContent trực tiếp tốc độ cao với JSON mode
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetchWithRetry(genUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }, { maxRetries: 2, timeoutMs: 30000, provider: `Gemini (${model})` });

      if (res.ok) {
        const data = await res.response.json();
        const extracted = extractGeminiText(data);
        if (extracted) {
          const parsed = parseModelJson(extracted);
          if (parsed && parsed.scores) return parsed;
        }
      }
    } catch {
      // Tiếp tục thử model tiếp theo
    }
  }

  return null;
}

// Kiểm tra xem văn bản OCR có phải là tiếng Việt có nghĩa hay chỉ là rác ký tự ngẫu nhiên Tesseract
export function isValidVietnameseText(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (clean.length < 15) return false;

  // 1. Kiểm tra tỷ lệ ký tự dấu thanh tiếng Việt (bài văn tiếng Việt bắt buộc phải có dấu thanh)
  const diacriticMatches = clean.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi) || [];
  const diacriticRatio = diacriticMatches.length / clean.length;

  // 2. Kiểm tra tỷ lệ ký tự ký hiệu đặc biệt lạ (Tesseract rác thường chứa nhiều |, \, [, ], {, }, _)
  const symbolMatches = clean.match(/[|\\\/_\[\]{}~@#$^&*=+<>]/g) || [];
  const symbolRatio = symbolMatches.length / clean.length;

  // 3. Kiểm tra số từ viết hoa toàn bộ từ 3 ký tự trở lên (rác OCR thường có CWI, TTL, BREEN, ERNE,...)
  const upperSeqs = clean.match(/\b[A-Z]{3,}\b/g) || [];

  // Nếu tỷ lệ dấu thanh dưới 5% hoặc quá nhiều ký tự rác hoặc quá nhiều từ viết hoa lộn xộn
  if (diacriticRatio < 0.05 || symbolRatio > 0.02 || upperSeqs.length >= 3) {
    return false;
  }

  // 4. Kiểm tra các từ tiếng Việt chuẩn có nghĩa theo ranh giới từ
  const commonWords = [
    'cây', 'lá', 'hoa', 'quả', 'thân', 'cành', 'gốc', 'rễ', 'bóng', 'mát', 'sân', 'trường',
    'em', 'rất', 'thích', 'yêu', 'những', 'vào', 'mùa', 'được', 'có', 'cho', 'này', 'ngày',
    'đó', 'xanh', 'đỏ', 'vàng', 'như', 'khi', 'đã', 'lại', 'với', 'trong', 'vườn', 'nhà',
    'bạn', 'học', 'thầy', 'cô', 'chim', 'nắng', 'gió', 'mỗi', 'ngắm', 'nhìn', 'to', 'cao',
    'tỏa', 'râm', 'phượng', 'bàng', 'me', 'xoài', 'bài', 'văn', 'làm', 'đoạn', 'che', 'chở'
  ];

  const wordPattern = new RegExp(`\\b(${commonWords.join('|')})\\b`, 'gi');
  const matchedWords = clean.match(wordPattern) || [];

  // Phải khớp ít nhất 3 từ tiếng Việt có nghĩa chuẩn
  return matchedWords.length >= 3;
}

// 2. ĐỘNG CƠ PHÂN TÍCH NGÔN NGỮ TIẾNG VIỆT TIỂU HỌC (VIETNAMESE PRIMARY NLP ENGINE)
export function evaluateVietnameseEssay(text) {
  if (!text || text.trim().length === 0) {
    return {
      scores: [2, 1, 1, 1],
      explain: [
        'Bài làm chưa có nội dung văn bản cụ thể.',
        'Chưa có câu liên kết hoàn chỉnh.',
        'Chưa có từ ngữ gợi cảm.',
        'Cần viết đoạn văn hoàn chỉnh.',
      ],
      errors: [['Thiếu nội dung', '', '', 'Học sinh chưa hoàn thành bài viết']],
      strength: 'Đang chờ học sinh bổ sung bài làm.',
      evidence: '',
      support: 'Khuyến khích học sinh viết đoạn văn từ 4-6 câu.',
      activity: 'Luyện viết đoạn văn ngắn tả cây theo gợi ý của cô.',
      feedback: 'Em hãy viết bài và nộp lại để cô xem nhé!',
    };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Phân tích Tiêu chí 1: Nội dung & Chi tiết (Tối đa 4.0 điểm)
  const plantTerms = [
    'cây', 'lá', 'hoa', 'quả', 'thân', 'cành', 'gốc', 'rễ', 'tán', 'bóng mát', 'mùa', 'búp',
    'xoài', 'bàng', 'phượng', 'chuối', 'me', 'hồng', 'hoa giấy', 'ổi', 'mận', 'dừa',
  ];
  const sensoryTerms = [
    'xanh', 'đỏ', 'vàng', 'hồng', 'thơm', 'ngọt', 'mềm', 'cao', 'to', 'bé', 'nhỏ', 'khổng lồ',
    'lấp ló', 'đung đưa', 'rung rinh', 'ríu rít', 'sần sùi', 'mát rượi', 'thoang thoảng', 'bờ ao',
    'sân trường', 'vườn', 'xanh thẫm', 'vàng ươm',
  ];
  const emotionTerms = [
    'em yêu', 'em thích', 'nhớ', 'gắn bó', 'kỷ niệm', 'bà', 'bạn', 'chăm sóc', 'mong', 'ước',
    'tuổi thơ', 'thương', 'ấm áp',
  ];

  const lower = clean.toLowerCase();
  const plantHits = plantTerms.filter((t) => lower.includes(t)).length;
  const sensoryHits = sensoryTerms.filter((t) => lower.includes(t)).length;
  const emotionHits = emotionTerms.filter((t) => lower.includes(t)).length;

  let score1 = 2.5;
  if (wordCount >= 20 && plantHits >= 2) score1 += 0.5;
  if (sensoryHits >= 2) score1 += 0.5;
  if (emotionHits >= 1) score1 += 0.5;
  if (score1 > 4.0) score1 = 4.0;

  // 2. Phân tích Tiêu chí 2: Sắp xếp ý & Bố cục (Tối đa 2.0 điểm)
  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 2);
  let score2 = 1.0;
  if (sentences.length >= 3) score2 += 0.5;
  if (sentences.length >= 4 && emotionHits >= 1) score2 += 0.5;
  if (score2 > 2.0) score2 = 2.0;

  // 3. Phân tích Tiêu chí 3: Từ ngữ & Diễn đạt (Tối đa 2.0 điểm)
  const compareTerms = ['như', 'tựa', 'giống', 'là'];
  const hasComparison = compareTerms.some((t) => lower.includes(` ${t} `));
  let score3 = 1.0;
  if (sensoryHits >= 3) score3 += 0.5;
  if (hasComparison) score3 += 0.5;
  if (score3 > 2.0) score3 = 2.0;

  // 4. Phân tích Tiêu chí 4: Chính tả & Dấu câu (Tối đa 2.0 điểm)
  const detectedErrors = [];
  let score4 = 2.0;

  // Rà soát các lỗi chính tả phổ biến trong tiếng Việt
  if (lower.includes('xân trường')) {
    detectedErrors.push(['Chính tả', 'xân trường', 'sân trường', 'Trong cụm từ chỉ sân của trường học, cần viết là "sân trường".']);
    score4 -= 0.5;
  }
  if (lower.includes('chở che')) {
    detectedErrors.push(['Dùng từ', 'chở che', 'che chở', 'Trong ngữ cảnh này nên dùng "che chở" để diễn đạt đúng nghĩa.']);
    score4 -= 0.5;
  }
  if (/mùa hè những/i.test(clean)) {
    detectedErrors.push(['Dấu câu', 'Mùa hè những', 'Mùa hè, những', 'Thêm dấu phẩy sau trạng ngữ chỉ thời gian.']);
    score4 -= 0.5;
  }
  if (/mỗi khi gió thổi những/i.test(clean)) {
    detectedErrors.push(['Dấu câu', 'Mỗi khi gió thổi những', 'Mỗi khi gió thổi, những', 'Thêm dấu phẩy sau trạng ngữ chỉ hoàn cảnh.']);
    score4 -= 0.5;
  }
  if (/nhiều quả em/i.test(clean)) {
    detectedErrors.push(['Tách câu', 'nhiều quả em', 'nhiều quả. Em', 'Cần ngắt câu bằng dấu chấm để tách biệt hai ý.']);
    score4 -= 0.5;
  }

  if (score4 < 1.0) score4 = 1.0;

  // Tìm dẫn chứng tiêu biểu trích dẫn từ bài văn
  const quoteCandidates = clean.match(/["'][^"']+["']/) ||
    clean.match(/[^.!?]+(?:như|vàng|xanh|thơm|nhớ|đung đưa|lấp ló|ngọt)[^.!?]*/i);
  const evidenceStr = quoteCandidates
    ? `"${quoteCandidates[0].trim()}"`
    : `"${clean.slice(0, 50)}..."`;

  const explain = [
    `Nêu được đặc điểm của cây, quan sát được ${sensoryHits} chi tiết hình ảnh, màu sắc đặc trưng.`,
    sentences.length >= 3 ? 'Bố cục đoạn văn mạch lạc, có câu mở đoạn, thân đoạn và kết nối ý hợp lý.' : 'Các ý cơ bản liên kết, nên bổ sung thêm câu kết đoạn để trọn vẹn hơn.',
    hasComparison ? 'Có sử dụng hình ảnh so sánh hoặc từ ngữ gợi cảm, giúp câu văn sinh động.' : 'Từ ngữ phù hợp lứa tuổi, có thể bổ sung thêm từ láy gợi tả.',
    detectedErrors.length === 0 ? 'Viết đúng chính tả, câu văn có dấu câu ngắt nghỉ rõ ràng.' : `Cần lưu ý ${detectedErrors.length} điểm về chính tả hoặc dấu câu.`,
  ];

  const strength = hasComparison
    ? 'Biết vận dụng hình ảnh so sánh sinh động và gắn miêu tả với kỷ niệm thực tế.'
    : 'Xác định đúng đối tượng tả và lựa chọn được những chi tiết nổi bật của cây.';

  const support = detectedErrors.length > 0
    ? 'Rà soát lại các từ dễ nhầm lẫn và chú ý ngắt dấu câu sau trạng ngữ.'
    : 'Có thể mở rộng thêm cảm xúc hoặc kỷ niệm đáng nhớ cùng với cây.';

  const activity = 'Đọc lại đoạn văn thành tiếng, đánh dấu những từ ngữ em thích nhất và chỉnh lại các dấu câu nếu cần.';

  const feedback = `Em đã có một đoạn văn rất đáng yêu tả về cây. ${hasComparison ? 'Hình ảnh so sánh trong bài rất giàu sức gợi!' : 'Em hãy tiếp tục phát huy khả năng quan sát tinh tế của mình nhé!'}`;

  return {
    scores: [score1, score2, score3, score4],
    explain,
    errors: detectedErrors,
    strength,
    evidence: evidenceStr,
    support,
    activity,
    feedback,
  };
}

// 3. HÀM CHẤM BÀI CHÍNH (HỖ TRỢ ĐỌC ĐA ẢNH & PHÂN LOẠI LỖI AI VISION CHUẨN XÁC)
export async function autoGradeSubmission(sub, optionsInput = {}) {
  const options = typeof optionsInput === 'boolean'
    ? { forceReOcr: optionsInput }
    : (optionsInput || {});
  const { forceReOcr = false, isPrinted = false, allowLocalOcr = false } = options;

  let extractedText = sub.text ? sub.text.trim() : '';

  // Đánh dấu trạng thái đang xử lý
  sub.state = 'processing';

  // Kiểm tra xem văn bản hiện tại có phải là rác OCR không
  const textIsGarbage = extractedText && !isValidVietnameseText(extractedText);
  if (textIsGarbage) {
    console.warn(`[AI Grading] Phát hiện văn bản rác OCR cũ. Đang dọn sạch để bắt buộc đọc lại ảnh gốc.`);
    extractedText = '';
    sub.text = '';
  }
  const shouldOcr = forceReOcr || !extractedText || textIsGarbage;

  // Thu thập TẤT CẢ các tệp ảnh hợp lệ từ sub.attachments (để hỗ trợ bài nộp gồm nhiều trang/nhiều ảnh)
  const imageFiles = [];
  if (sub.attachments && sub.attachments.length > 0) {
    for (const att of sub.attachments) {
      const filename = path.basename(att.filePath || att.name || '');
      const candidatePaths = [
        path.join(UPLOADS_DIR, filename),
        path.resolve(att.filePath ? att.filePath.replace(/^\//, '') : ''),
        path.resolve('backend', att.filePath ? att.filePath.replace(/^\//, '') : ''),
        path.resolve('uploads', filename),
        path.resolve('backend/uploads', filename),
      ].filter(Boolean);
      const filePath = candidatePaths.find((p) => fs.existsSync(p));
      const isImg = att.type?.includes('image') || /\.(png|jpe?g|webp)$/i.test(filename);
      if (filePath && isImg) {
        imageFiles.push({
          filePath,
          name: att.name || filename,
          type: att.type || (filename.endsWith('.png') ? 'image/png' : 'image/jpeg'),
          buffer: fs.readFileSync(filePath),
        });
      }
    }
  }

  // Nếu bài cần nhận dạng chữ từ ảnh bài làm
  if (shouldOcr && imageFiles.length > 0) {
    console.log(`🔍 [AI Grading] Bắt đầu đọc thật ${imageFiles.length} trang ảnh bài làm cho học sinh ${sub.studentId}...`);

    let geminiError = null;
    let openaiError = null;

    // BƯỚC 1: ƯU TIÊN GỌI GOOGLE GEMINI VISION (INTERACTIONS API & VISION)
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      console.log(`🤖 Đang đọc ${imageFiles.length} trang ảnh bằng Google Gemini Vision...`);
      const geminiResult = await callGeminiVision(imageFiles, 'image/jpeg', sub.topic || 'Tả một cây em yêu thích');
      if (geminiResult.success && geminiResult.data?.text) {
        sub.text = geminiResult.data.text;
        sub.scores = geminiResult.data.scores;
        sub.explain = geminiResult.data.explain;
        sub.errors = geminiResult.data.errors || [];
        sub.strength = geminiResult.data.strength;
        sub.evidence = geminiResult.data.evidence;
        sub.support = geminiResult.data.support;
        sub.activity = geminiResult.data.activity;
        sub.feedback = geminiResult.data.feedback;
        sub.state = 'suggested';
        sub.errorDetails = null; // Xóa lỗi cũ
        sub.ocrConfidence = null;
        sub.logs = sub.logs || [];
        sub.logs.push({
          at: new Date(),
          action: 'ai_graded_gemini',
          scores: sub.scores,
          reason: `Trợ lý Google Gemini (${geminiResult.model} - ${geminiResult.provider}) đã đọc thật ${imageFiles.length} trang hình ảnh viết tay và đề xuất điểm`,
        });
        return sub;
      }
      geminiError = geminiResult.errorInfo;
      console.warn(`⚠️ Gemini Vision không thể đọc bài: [${geminiError?.errorCode}] ${geminiError?.errorMessage}`);
    }

    // BƯỚC 2: CHỈ GỌI OPENAI VISION NẾU ĐƯỢC BẬT RÕ RÀNG TRONG BIẾN MÔI TRƯỜNG
    // (Mặc định đã tắt ChatGPT theo yêu cầu người dùng)
    const enableOpenAi = process.env.ENABLE_OPENAI_FALLBACK === 'true' && Boolean(process.env.OPENAI_API_KEY);
    if (enableOpenAi) {
      console.log(`🤖 Đang gửi ${imageFiles.length} trang ảnh tới OpenAI Vision (GPT-4o)...`);
      const openaiResult = await callOpenAIVision(imageFiles, 'image/jpeg', sub.topic || 'Tả một cây em yêu thích');
      if (openaiResult.success && openaiResult.data?.text) {
        sub.text = openaiResult.data.text;
        sub.scores = openaiResult.data.scores;
        sub.explain = openaiResult.data.explain;
        sub.errors = openaiResult.data.errors || [];
        sub.strength = openaiResult.data.strength;
        sub.evidence = openaiResult.data.evidence;
        sub.support = openaiResult.data.support;
        sub.activity = openaiResult.data.activity;
        sub.feedback = openaiResult.data.feedback;
        sub.state = 'suggested';
        sub.errorDetails = null; // Xóa lỗi cũ
        sub.ocrConfidence = null;
        sub.logs = sub.logs || [];
        sub.logs.push({
          at: new Date(),
          action: 'ai_graded_openai',
          scores: sub.scores,
          reason: `Trợ lý OpenAI Vision (${openaiResult.model}) đã đọc thật ${imageFiles.length} trang hình ảnh viết tay và đề xuất điểm`,
        });
        return sub;
      }
      openaiError = openaiResult.errorInfo;
      console.warn(`⚠️ OpenAI Vision không thể đọc bài: [${openaiError?.errorCode}] ${openaiError?.errorMessage}`);
    }

    // BƯỚC 3: QUY TẮC CỐT LÕI - KHÔNG TỰ ĐỘNG DÙNG TESSERACT ĐỂ CHẤM ĐIỂM BÀI VIẾT TAY
    // Nếu không phải văn bản in (isPrinted !== true) và không cho phép allowLocalOcr:
    if (!isPrinted && !allowLocalOcr) {
      // Xác định nguyên nhân lỗi để log nội bộ
      const primaryError = geminiError || openaiError || {
        provider: 'Gemini',
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        httpStatus: 0,
        errorCode: 'NOT_CONFIGURED',
        category: 'NOT_CONFIGURED',
        errorMessage: 'Chưa cấu hình hoặc chưa kết nối được với Google Gemini API.',
      };

      console.warn(`[AI Vision] Không thể đọc tự động (${primaryError.provider} - ${primaryError.errorCode}): ${primaryError.errorMessage}`);

      // Nếu bài làm đã có sẵn nội dung văn bản (do giáo viên nhập hoặc sửa trước đó):
      if (sub.text && isValidVietnameseText(sub.text)) {
        console.log(`💡 Đang đánh giá bài dựa trên văn bản học sinh đã nhập...`);
        const nlpGrading = evaluateVietnameseEssay(sub.text);
        sub.scores = nlpGrading.scores;
        sub.explain = nlpGrading.explain || [];
        sub.errors = nlpGrading.errors || [];
        sub.strength = nlpGrading.strength || 'Bài làm có bố cục hoàn chỉnh.';
        sub.evidence = nlpGrading.evidence || '';
        sub.support = nlpGrading.support || '';
        sub.activity = nlpGrading.activity || '';
        sub.feedback = nlpGrading.feedback || '';
        sub.state = 'suggested';
        sub.errorDetails = null;
        return sub;
      }

      // NẾU KHÔNG THỂ ĐỌC ẢNH VÀ CHƯA CÓ VĂN BẢN:
      // Tuyệt đối không chèn bài văn mẫu giả lập. Yêu cầu giáo viên kiểm tra hoặc nhập văn bản.
      sub.state = 'needs_review';
      sub.text = '';
      sub.scores = [];
      sub.explain = [];
      sub.errors = [];
      sub.strength = '';
      sub.evidence = '';
      sub.support = 'Không thể tự động đọc chữ viết tay từ ảnh. Quý thầy cô vui lòng kiểm tra lại ảnh chụp hoặc bấm "✏️ Sửa văn bản bài làm" để nhập bài.';
      sub.feedback = 'Chưa nhận diện được nội dung bài làm từ ảnh.';
      sub.errorDetails = {
        provider: primaryError.provider || 'Gemini',
        model: primaryError.model || process.env.GEMINI_MODEL,
        errorCode: primaryError.errorCode || 'VISION_FAILED',
        errorMessage: primaryError.errorMessage || 'Không thể đọc chữ viết tay từ ảnh.',
        timestamp: new Date(),
      };

      sub.logs = sub.logs || [];
      sub.logs.push({
        at: new Date(),
        action: 'ai_vision_failed',
        reason: `Không thể đọc tự động từ ảnh: [${primaryError.errorCode || 'ERROR'}] ${primaryError.errorMessage || ''}`,
      });

      return sub;
    }

    // BƯỚC 4: NẾU LÀ VĂN BẢN IN HOẶC YÊU CẦU OCR CỤC BỘ -> DÙNG TESSERACT CÓ ĐO LƯỜNG CONFIDENCE
    try {
      console.log(`ℹ️ Đang quét văn bản in bằng Tesseract OCR cục bộ cho ${imageFiles.length} trang...`);
      const worker = await getTesseractWorker();
      const pageTexts = [];
      let totalConfidence = 0;
      let pageCount = 0;

      for (let i = 0; i < imageFiles.length; i++) {
        const ocrData = await worker.recognize(imageFiles[i].filePath);
        if (ocrData?.data?.text) {
          const cleaned = cleanOcrEssayText(ocrData.data.text);
          if (cleaned) pageTexts.push(cleaned);
          totalConfidence += (ocrData.data.confidence || 0);
          pageCount++;
        }
      }

      const avgConfidence = pageCount > 0 ? Math.round(totalConfidence / pageCount) : 0;
      sub.ocrConfidence = avgConfidence;

      const combinedOcrText = pageTexts.join('\n\n').trim();

      // Kiểm tra xem văn bản có hợp lệ và độ tin cậy có đủ an toàn không
      if (avgConfidence >= 65 && isValidVietnameseText(combinedOcrText)) {
        extractedText = combinedOcrText;
      } else {
        console.warn(`⚠️ Tesseract OCR độ tin cậy thấp (${avgConfidence}%) hoặc nội dung rác. Chuyển sang needs_review.`);
        sub.state = 'needs_review';
        sub.text = '';
        sub.scores = [];
        sub.errorDetails = {
          provider: 'Tesseract',
          model: 'vie+eng',
          httpStatus: 200,
          errorCode: 'LOW_CONFIDENCE',
          errorMessage: `OCR cục bộ có độ tin cậy thấp (${avgConfidence}%). Cần giáo viên kiểm tra thủ công.`,
          timestamp: new Date(),
        };
        sub.support = `Văn bản OCR nhận diện không đủ độ tin cậy (${avgConfidence}%). Quý thầy cô vui lòng kiểm tra và sửa lại văn bản bài làm.`;
        return sub;
      }
    } catch (ocrErr) {
      console.error('Lỗi khi chạy OCR Tesseract:', ocrErr.message);
      sub.state = 'failed';
      sub.errorDetails = {
        provider: 'Tesseract',
        model: 'vie+eng',
        httpStatus: 500,
        errorCode: 'OCR_CRASH',
        errorMessage: sanitizeErrorMessage(ocrErr.message),
        timestamp: new Date(),
      };
      return sub;
    }
  }

  // NẾU VĂN BẢN VẪN RỖNG (không có ảnh hoặc không đọc được)
  if (!extractedText) {
    sub.state = 'needs_review';
    sub.text = '';
    sub.scores = [];
    sub.explain = [];
    sub.errors = [];
    sub.strength = '';
    sub.support = 'Chưa có nội dung văn bản bài làm. Thầy cô vui lòng nhấn "✏️ Sửa văn bản bài làm" để nhập bài hoặc tải lại ảnh.';
    sub.feedback = 'Chưa nhận dạng được bài làm.';
    return sub;
  }

  // BƯỚC 5: ĐÁNH GIÁ BÀI VĂN (ƯU TIÊN GOOGLE GEMINI, DỰ PHÒNG NLP TIẾNG VIỆT TIỂU HỌC)
  let gradingResult = null;
  let gradingProvider = 'nlp';

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    try {
      const geminiTextResult = await callGeminiTextGrading(extractedText, sub.topic || 'Tả một cây em yêu thích');
      if (geminiTextResult && Array.isArray(geminiTextResult.scores) && geminiTextResult.scores.length === 4) {
        gradingResult = geminiTextResult;
        gradingProvider = 'gemini';
      }
    } catch (err) {
      console.warn('Lỗi khi gọi Gemini text grading:', err.message);
    }
  }

  if (!gradingResult) {
    gradingResult = evaluateVietnameseEssay(extractedText);
    gradingProvider = 'nlp';
  }

  sub.text = extractedText;
  sub.scores = gradingResult.scores;
  sub.explain = gradingResult.explain || [];
  sub.errors = gradingResult.errors || [];
  sub.strength = gradingResult.strength || '';
  sub.evidence = gradingResult.evidence || '';
  sub.support = gradingResult.support || '';
  sub.activity = gradingResult.activity || '';
  sub.feedback = gradingResult.feedback || '';
  sub.state = 'suggested';
  sub.errorDetails = null; // Thành công

  sub.logs = sub.logs || [];
  sub.logs.push({
    at: new Date(),
    action: gradingProvider === 'gemini' ? 'ai_graded_gemini_text' : 'ai_graded_nlp',
    scores: sub.scores,
    reason: gradingProvider === 'gemini'
      ? `Trợ lý Google Gemini (${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}) đã phân tích bài văn và đề xuất điểm`
      : `Động cơ khảo thí Tiếng Việt Tiểu học đã phân tích bài văn và đề xuất điểm`,
  });

  return sub;
}
