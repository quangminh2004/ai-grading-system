# Thanh Lân · Chấm & Chữa AI

Gói bàn giao mã nguồn web demo cho đội ngũ kỹ thuật. Ngày đóng gói: 22/10/2026.

Demo đang chạy: https://thanh-lan-cham-chua-ai.politejay4096.chatgpt.site

## 1. Chạy ngay trên máy

Yêu cầu: Python 3 và trình duyệt hiện đại như Chrome hoặc Edge. Không cần npm, framework hoặc bước build.

1. Giải nén toàn bộ thư mục này.
2. Mở Terminal/PowerShell tại thư mục chứa README.md.
3. Chạy:

```bash
python run_local.py
```

Trên Windows có Python Launcher, cũng có thể dùng:

```powershell
py -3 run_local.py
```

Mở `http://localhost:8080`. Giữ cửa sổ lệnh mở trong khi dùng; nhấn Ctrl+C để dừng.

Nếu cổng 8080 đang bận:

```bash
python run_local.py --port 8090
```

Cách tương đương, không dùng script đi kèm:

```bash
python -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Không mở index.html trực tiếp bằng file://: chức năng tải bộ bài mẫu sử dụng fetch và cần HTTP. Khi chuyển cổng, hostname hoặc trình duyệt, dữ liệu cục bộ là một vùng dữ liệu khác.

Font Be Vietnam Pro được tải từ Google Fonts khi có mạng; nếu không có mạng, giao diện dùng font dự phòng. Các tài nguyên bài mẫu nằm sẵn trong gói.

## 2. Chức năng hiện có

| Hạng mục | Trạng thái thực tế |
| --- | --- |
| Danh sách lớp | Có lớp mẫu 4A, 4B; thêm lớp, thêm/sửa tên học sinh, nhập nhiều tên |
| Nhận bài | Nhận nhiều tệp PDF, PNG, JPG/JPEG; kiểm tra phần mở rộng và chữ ký đầu tệp |
| Giới hạn | 15 MB/tệp; 20 tệp/lượt; tổng 100 MB/lượt |
| Ghép bài | Đối chiếu tên tệp với họ tên hoặc mã học sinh, xử lý tên không dấu và hậu tố trang/page |
| Trường hợp chưa khớp | Giáo viên chọn lại học sinh; tên trùng không được tự ghép tùy ý |
| Bài nhiều ảnh | Gom các tệp cùng mã học sinh thành một bài |
| Xem bài gốc | Hiển thị ảnh; nhúng PDF bằng trình xem của trình duyệt; có liên kết mở tệp gốc |
| Chấm bộ bài mẫu | Kết quả mô phỏng được biên soạn sẵn, KHÔNG gọi mô hình AI |
| Đọc/chấm tệp mới | CHƯA tích hợp OCR, mô hình đa phương thức hoặc API chấm bài |
| Chấm thủ công | Giáo viên nhập điểm theo 4 tiêu chí và nhận xét |
| Duyệt | Có xác nhận đã đọc bài, sửa điểm/nhận xét, ghi nhật ký; chỉ bài đã duyệt được đưa vào hồ sơ |
| Hồ sơ | Điểm mạnh, dẫn chứng, nội dung cần hỗ trợ, hoạt động tiếp theo; giới hạn nhận định theo bài làm |
| Xuất dữ liệu | CSV của các bài đã được giáo viên duyệt |

Nhận và xem PDF không đồng nghĩa đã trích nội dung PDF. Hiện chưa có nhận dạng chữ viết tay, đọc tên từ nội dung ảnh, tự chia một PDF chứa bài của nhiều học sinh, hoặc chấm tự động bài mới.

## 3. Thử demo

### Quy trình mẫu

1. Chọn lớp 4A, vào “Nhận bài & chấm AI”.
2. Nhấn “Nạp bộ bài mẫu lớp 4A”.
3. Kiểm tra sáu tên đã được ghép.
4. Nếu thay các bài đã có, tích “Cho phép thay bài đã có của học sinh được chọn”.
5. Giữ “Tự động chấm sau khi nhận bài”, rồi nhấn “Nhận bài & bắt đầu chấm”.
6. Mở một bài, kiểm tra điểm, nhận xét và dẫn chứng trước khi duyệt.

HS02 có đề xuất trừ điểm chính tả thiếu căn cứ để minh họa việc giáo viên kiểm tra, bác bỏ hoặc chỉnh đề xuất. Các gợi ý diễn đạt khác cũng cần được giáo viên cân nhắc, không mặc định là đáp án chuẩn.

### Tải tệp riêng

Ví dụ tên tệp:

```text
Nguyễn Minh An.jpg
HS01_Nguyễn Minh An.pdf
Nguyễn Minh An_trang1.png
Nguyễn Minh An_trang2.jpeg
```

Tên phải khớp danh sách của lớp đang chọn. Mỗi PDF chứa bài của một học sinh, có thể có nhiều trang. Tệp mới được lưu và xem thật; không tự có điểm AI. Có thể dùng chức năng chấm thủ công.

## 4. Cấu trúc và nơi sửa tính năng

| Tệp | Vai trò / điểm sửa thường dùng |
| --- | --- |
| dist/index.html | Khung giao diện, thanh bên, menu và thứ tự tải script |
| dist/style.css | Giao diện nền, chấm bài, hồ sơ, hộp thoại và responsive |
| dist/intake.css | Trang nhận tệp, danh sách lớp, hàng đợi và xem tệp |
| dist/data.js | Hàm tiện ích `$`, `esc`; 4 tiêu chí `rubric`; 6 bài mẫu `seeds` |
| dist/app.js | Trạng thái lớp/bài; các màn hình chấm, hồ sơ, tổng quan; duyệt, CSV |
| dist/intake.js | Nhập tệp, ghép tên, IndexedDB, xem ảnh/PDF, quản lý lớp và học sinh |
| dist/samples/ | 6 tệp bài mẫu: 2 PNG, 2 JPEG, 2 PDF |
| docs/AI_INTEGRATION.md | Thiết kế đề xuất để bổ sung AI thật; chưa phải API đã triển khai |
| SOURCE_VERSION.json | Commit nguồn gốc và phiên bản bàn giao |
| SHA256SUMS.json | Kiểm tra tính toàn vẹn các tệp của bản xuất |
| .openai/hosting.json | Cấu hình Site hiện tại; không cần cho việc chạy local |

Đây là JavaScript thuần dùng chung global scope, chưa phải ES modules. Giữ thứ tự script: data.js → app.js → intake.js. intake.js gọi render() cuối cùng sau khi khai báo đủ hàm; nhiều hàm trong app.js gọi sang intake.js.

Các hàm chính:

- `render()` trong app.js: định tuyến và vẽ lại màn hình theo biến `page`.
- `editModal()` trong app.js: chỉnh điểm, nhận xét, minh chứng và duyệt.
- `exportCSV()` trong app.js: xuất các bài đã duyệt.
- `normalize()`, `matchFilename()` trong intake.js: chuẩn hóa và ghép tên tệp.
- `fileKind()`, `addFiles()` trong intake.js: kiểm tra định dạng, dung lượng và hàng đợi.
- `receive()` trong intake.js: lưu tệp, gom bài theo học sinh; hiện chỉ dùng điểm có sẵn cho bộ mẫu.
- `fileDB()`, `attachmentURL()` và `mountAttachmentPreview()`: lưu và xem lại tệp.
- `studentModal()`, `importRoster()` và `newClass()`: quản lý danh sách.

Một số đoạn JS được viết gọn theo từng hàm; có thể dùng Format Document của IDE trước khi chỉnh sửa. Không có tệp bundle hoặc mã biên dịch cần giải nén ngược: các tệp dist/*.js chính là mã nguồn đang chạy.

## 5. Dữ liệu được lưu ở đâu?

- localStorage key `tl-review-v2`: lớp, học sinh, nội dung minh họa, điểm, nhận xét, trạng thái duyệt, metadata tệp.
- IndexedDB database `thanh-lan-attachments`, version 1, store `files`: Blob bài tải lên.
- localStorage key `tl-review-v1` là dữ liệu phiên bản cũ; bản hiện tại không dùng key này.
- Tệp gốc không được đưa vào localStorage. Object URL được tạo trong phiên để xem Blob.
- Hàng đợi upload chưa được tiếp nhận nằm trong bộ nhớ, không khôi phục sau khi tải lại trang.
- Dữ liệu tự nhập không đồng bộ giữa máy, trình duyệt hoặc người xem; bản công khai chỉ cung cấp giao diện và tài nguyên mẫu.

“Khôi phục dữ liệu mẫu” đặt lại danh sách và kết quả mẫu. Chức năng đó hiện không dọn toàn bộ Blob mồ côi trong IndexedDB. Nếu cần xóa sạch dữ liệu thử, dùng mục Site data của trình duyệt cho origin local/demo hoặc bổ sung chức năng dọn dữ liệu có xác nhận.

## 6. Điểm kỹ thuật cần biết trước khi phát triển tiếp

- Chưa có backend, cơ sở dữ liệu dùng chung, đăng nhập riêng cho giáo viên, API AI hay API key.
- Bộ tiêu chí hiện cố định cho đoạn văn miêu tả cây lớp 4: 4 + 2 + 2 + 2 = 10 điểm. Nếu thêm môn học/bài tập, nên tách rubric và đề bài theo assignment thay vì sửa các nhãn riêng lẻ.
- Mô hình dữ liệu hiện chỉ giữ một bài hiện tại cho mỗi học sinh trong từng lớp, chưa phải kho bài theo nhiều ngày/đề.
- Việc lưu metadata và tệp nằm ở hai cơ chế khác nhau, chưa phải một giao dịch dữ liệu thống nhất. Cần bổ sung xử lý migration, quota và phục hồi nếu triển khai thực tế.
- Ghép tên hiện dựa vào tên tệp, chưa đọc họ tên trong nội dung bài. Cần giáo viên kiểm tra khi tệp bị đặt sai tên.
- Xem PDF phụ thuộc trình đọc tích hợp trong trình duyệt; dùng liên kết tệp gốc nếu trình duyệt không nhúng được.
- Khi đổi tiêu chí hoặc thay bài, cần vô hiệu hóa điểm và trạng thái duyệt cũ. Quy trình nhận bài mới hiện xóa kết quả đã duyệt cũ của bài bị thay.
- Nếu đưa dữ liệu thật lên máy chủ, cần bổ sung tài khoản, quyền truy cập theo trường/lớp, lưu trữ riêng và quản lý vòng đời dữ liệu.

## 7. Kiểm tra và đưa lên hosting

Nếu có Node.js, kiểm tra cú pháp:

```bash
node --check dist/data.js
node --check dist/app.js
node --check dist/intake.js
```

Chạy local và kiểm tra: chọn lớp → nhận ảnh/PDF → xác nhận ghép tên → xem tệp → sửa/duyệt → hồ sơ/CSV. Kiểm tra trường hợp tên trùng, tên không khớp, tệp sai định dạng, thay bài và nhiều ảnh một học sinh.

Có thể đưa toàn bộ nội dung thư mục dist/ lên hosting tĩnh. Giữ nguyên đường dẫn tương đối tới CSS, JS và samples/. Nếu dùng lại Site hiện tại, cần quyền triển khai của chủ Site và giữ đúng project_id trong cấu hình. Chỉnh code trên máy không tự cập nhật đường dẫn demo công khai; phải triển khai bản mới.

Gói này là bản xuất nguồn để phát triển, không chứa lịch sử Git, thông tin đăng nhập, token triển khai hoặc dữ liệu bài làm do người dùng tự nhập.
