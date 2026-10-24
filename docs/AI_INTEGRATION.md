# Ghi chú tích hợp nhận dạng và chấm AI

Tài liệu thiết kế đề xuất cho đội ngũ kỹ thuật. Các endpoint, trường dữ liệu mở rộng và backend dưới đây CHƯA được triển khai trong gói mã nguồn hiện tại.

## 1. Mục tiêu

Giáo viên chọn lớp, tải ảnh/PDF, kiểm tra tên học sinh đã ghép. Hệ thống đọc bài, đề xuất điểm theo tiêu chí, đưa ra lỗi có dẫn chứng, nhận xét và hoạt động hỗ trợ. Giáo viên kiểm tra, sửa và duyệt; chỉ dữ liệu đã duyệt mới được đưa vào hồ sơ chính thức.

Tên tệp dùng để ghép roster; nội dung học tập dùng để phân tích. Không kết luận tính cách, hoàn cảnh gia đình hoặc năng lực cố định từ một bài. Ghi rõ nhận xét dựa vào bài/trang/câu nào.

## 2. Nơi nối vào code hiện tại

Trong `dist/intake.js`, `receive()` hiện:

1. Gom tệp theo studentId.
2. Lưu Blob vào IndexedDB.
3. Nếu là bộ mẫu được nạp qua nút mẫu, lấy kết quả từ seeds và chuyển sang suggested.
4. Nếu là tệp mới, tạo bài state=new, custom=true, awaitingAI=true; chưa gán điểm.

Nên tách bước nhận tệp khỏi tác vụ phân tích và thêm `analyzeSubmission(submissionId)`. Không thay mọi tệp mới bằng điểm mẫu. Bỏ nhánh lấy seeds khi chuyển sang chế độ AI thật, hoặc chỉ giữ nó trong chế độ demo được gắn nhãn rõ.

`editModal()` và `exportCSV()` trong app.js có thể được giữ về mặt giao diện, nhưng kết quả và nhật ký duyệt cần lưu backend khi có nhiều giáo viên.

## 3. Kiến trúc đề xuất

- Frontend gửi tệp và metadata tới backend do đơn vị quản lý.
- Backend xác thực giáo viên và quyền đối với lớp/bài tập.
- Tệp được kiểm tra MIME/chữ ký, kích thước, số trang và lưu riêng theo đơn vị sử dụng.
- PDF được đọc bằng thư viện phù hợp; trang scan/ảnh được đưa qua OCR hoặc mô hình đa phương thức. Bảo toàn thứ tự trang và liên kết tới bản gốc.
- Mô hình trả về dữ liệu có cấu trúc theo rubric và minh chứng.
- Backend kiểm tra dữ liệu trả về rồi lưu điểm đề xuất, không ghi thành điểm đã duyệt.
- Giáo viên đọc và xác nhận trên giao diện; backend ghi cả đề xuất, bản sửa và sự kiện duyệt.

API key đặt ở backend/secret manager, không nhúng trong HTML/JS, không yêu cầu giáo viên dán key vào trang công khai. Trước khi gửi bài thật tới dịch vụ bên ngoài, xác định rõ dữ liệu được gửi, nơi xử lý và quyền truy cập.

## 4. API đầu vào gợi ý

`POST /api/submissions` sử dụng multipart/form-data:

| Trường | Ý nghĩa |
| --- | --- |
| class_id | Lớp đã được xác thực quyền truy cập |
| student_id | Mã học sinh đã ghép; lấy từ roster backend |
| assignment_id | Bài tập và phiên bản rubric |
| files[] | Một hoặc nhiều ảnh/PDF cho cùng học sinh |
| auto_grade | Có xếp hàng phân tích ngay không |

Trả về submission_id và trạng thái nhận bài. Khi xử lý bất đồng bộ, frontend lấy trạng thái qua `GET /api/submissions/{submission_id}`. Tác vụ chạy lại cần idempotency key hoặc cơ chế tương đương để tránh chấm và tính phí lặp ngoài ý muốn.

## 5. Cấu trúc kết quả gợi ý

Ví dụ dưới đây minh họa schema, không phải kết quả từ AI thật:

```json
{
  "submission_id": "submission-example",
  "student_id": "HS01",
  "assignment_id": "writing-tree-v1",
  "status": "suggested",
  "recognition": {
    "text": "Nội dung đã nhận dạng...",
    "needs_review": true,
    "issues": [{"page": 1, "note": "Một từ chưa đọc rõ"}]
  },
  "criteria": [
    {"id": "content", "score": 3.5, "max": 4, "evidence": ["Trích đoạn tương ứng"]},
    {"id": "organization", "score": 1.5, "max": 2, "evidence": []},
    {"id": "expression", "score": 1.5, "max": 2, "evidence": []},
    {"id": "spelling", "score": 1.5, "max": 2, "evidence": []}
  ],
  "corrections": [
    {"page": 1, "original": "xân trường", "suggested": "sân trường", "reason": "Chính tả"}
  ],
  "feedback": "Nhận xét tham khảo cho bài này...",
  "learning_observations": {
    "strengths": [{"description": "Biểu hiện trong bài", "evidence": "Trích đoạn"}],
    "support_needs": ["Nội dung cần luyện"],
    "next_activities": ["Hoạt động giáo viên cân nhắc"]
  },
  "teacher_review": {"approved": false}
}
```

Backend tính tổng điểm từ criteria, không tin tổng điểm tự do do mô hình trả về. Kiểm tra score là số hữu hạn, nằm trong [0, max], đủ và không trùng tiêu chí, đúng phiên bản rubric. Nếu thiếu/không đọc rõ minh chứng thiết yếu, trả trạng thái needs_review thay vì buộc tạo điểm.

## 6. Ánh xạ tạm vào frontend hiện tại

| Dữ liệu mới | Trường hiện tại |
| --- | --- |
| recognition.text | s.text |
| criteria[].score theo thứ tự rubric | s.scores |
| Giải thích từng tiêu chí | s.explain[] |
| corrections | s.errors[] theo cấu trúc mảng hiện tại |
| feedback | s.feedback |
| strengths/support/next activities | s.strength, s.evidence, s.support, s.activity |
| Hoàn tất phân tích hợp lệ | s.state='suggested' |
| Giáo viên xác nhận | s.state='approved', s.teacherScores, s.teacherFeedback |

Khi bật AI thật, thay nhãn “MÔ PHỎNG” bằng trạng thái đúng, bổ sung nguồn phân tích và phiên bản mô hình. Không chỉ đổi nhãn để coi kết quả mẫu là AI thật. Với hồ sơ nhiều bài, nên tạo bảng observations gắn từng submission thay vì nối thành một nhận xét cố định.

## 7. Các trường hợp cần kiểm thử

- Ảnh mờ, xoay, mất góc, ánh sáng kém; chữ viết không đọc được.
- PDF scan, PDF có lớp text, PDF nhiều trang; trang trắng hoặc hỏng.
- Tên tệp sai người; nhiều học sinh trùng tên; một PDF có bài nhiều người.
- Bài không đúng đề, nội dung quá ngắn, bài tải lại hoặc cùng tệp gửi hai lần.
- Nội dung bài chứa câu lệnh cố gắng yêu cầu AI thay đổi điểm hoặc bỏ rubric: xử lý như dữ liệu bài làm, không như chỉ dẫn hệ thống.
- Điểm ngoài thang, thiếu tiêu chí, lỗi không có trong bài, nhận xét thiếu dẫn chứng.
- Mất mạng, timeout, dịch vụ hết hạn mức; thử lại có kiểm soát.
- Thay bài/đổi rubric khi tác vụ đang chạy: kết quả cũ không được ghi đè bài mới.
- Tách điểm AI khỏi điểm giáo viên; chỉ xuất/hợp nhất hồ sơ sau bước duyệt.

## 8. Thứ tự phát triển đề xuất

1. Chuẩn hóa assignment/rubric và schema dữ liệu bài nộp.
2. Thêm backend nhận tệp và một tác vụ đọc/chấm cho một bài.
3. Hiển thị nội dung nhận dạng để giáo viên kiểm tra trước khi chấp nhận đề xuất.
4. Hoàn thiện nhật ký sửa/duyệt và thử với tập bài có kết quả do giáo viên đánh giá.
5. Thêm tài khoản, phân quyền, cơ sở dữ liệu và xử lý theo lô khi quy trình một bài đã ổn.
