# Hệ Thống Trợ Lý Chấm & Chữa Bài AI (Đa Trường Học · Phân Quyền Quản Trị & Giáo Viên)

Hệ thống chấm chữa bài viết và quản lý đánh giá học tập dành cho giáo viên và các nhà trường. Ứng dụng hoạt động với **100% dữ liệu thật trực tuyến**, hỗ trợ đa trường học, tích hợp xác thực tài khoản và phân quyền rõ ràng giữa **Quản trị viên (Admin)** và **Giáo viên (Teacher)**. Sẵn sàng đóng gói và triển khai (deploy) lên máy chủ thật hoặc các nền tảng đám mây.

---

## 1. Tính Năng & Kiến Trúc Nổi Bật

| Hạng mục | Chi tiết triển khai |
| --- | --- |
| **Cơ sở dữ liệu** | Cơ sở dữ liệu đám mây trực tuyến, lưu trữ danh mục trường học, giáo viên, lớp học, học sinh và bài chấm |
| **Phạm vi trường học** | **Đa trường học**: Admin tạo danh mục các trường, phân quyền tài khoản cho giáo viên từng trường |
| **Xác thực & Bảo mật** | Đăng nhập bằng JWT Token, mật khẩu được mã hóa chuẩn công nghiệp bằng `bcryptjs` |
| **Phân quyền người dùng (RBAC)** | Tách bạch hoàn toàn: Admin quản lý tài khoản & trường học; Giáo viên quản lý lớp & chấm bài |
| **Chức năng Admin** | Tạo tài khoản giáo viên, sửa thông tin, đặt lại mật khẩu, khóa/mở khóa tài khoản, thêm & quản lý trường học |
| **Chức năng Giáo viên** | Quản lý lớp học, nhập danh sách học sinh, nạp bài viết (ảnh/PDF), AI chấm điểm & gợi ý chữa lỗi, duyệt điểm, xuất báo cáo CSV |
| **Sẵn sàng triển khai** | Hỗ trợ cấu hình PORT linh hoạt, API tương đối (`/api`), Dockerfile chuẩn hóa, single-port phục vụ cả Backend & SPA |

---

## 2. Tài Khoản Quản Trị Viên (Admin) Khởi Tạo

Khi hệ thống khởi chạy lần đầu trên cơ sở dữ liệu trống, tài khoản Quản trị viên mặc định được tạo tự động:

- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin@123`

> **Lưu ý**: Sau khi đăng nhập lần đầu, Admin có thể nhấp vào góc trên bên phải để đổi mật khẩu quản trị bảo mật hơn. Admin sẽ dùng trang **"Quản lý Giáo viên"** để tạo tài khoản riêng cho từng cô giáo.

---

## 3. Khởi Động Nhanh Trên Máy Cục Bộ

### Cách 1: Chạy bằng file `start_app.bat` (Khuyên dùng trên Windows)
Nhấp đúp chuột vào file:
```text
start_app.bat
```
Ứng dụng sẽ tự động khởi động và mở tại:
👉 `http://localhost:5000`

### Cách 2: Chạy bằng Node.js / Terminal
```bash
# Cài đặt và build ứng dụng
npm run build

# Khởi chạy toàn bộ hệ thống
npm start
```
Truy cập: `http://localhost:5000`

---

## 4. Hướng Dẫn Triển Khai (Deploy) Lên Máy Chủ Thật

Hệ thống được thiết kế theo mô hình **All-in-One Deployment**: Máy chủ Node.js Express vừa cung cấp REST API, vừa phục vụ trực tiếp giao diện Web React (SPA) đã được build tại thư mục `dist`. Không cần cấu hình 2 server riêng biệt, không lo lỗi CORS.

### Phương án A: Triển khai với Docker (Khuyên dùng cho mọi VPS / Cloud)
Hệ thống đã có sẵn `Dockerfile` tối ưu hóa:
```bash
# 1. Build image Docker
docker build -t cham-chua-bai-ai .

# 2. Chạy container (thay thế MONGODB_URI bằng chuỗi kết nối của bạn)
docker run -d -p 5000:5000 \
  -e PORT=5000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="your_secure_jwt_secret" \
  --name cham-chua-app cham-chua-bai-ai
```

### Phương án B: Triển khai lên Render.com / Railway.app
1. Đẩy mã nguồn lên kho Git (GitHub / GitLab).
2. Tạo **Web Service** mới trên Render hoặc Railway.
3. Thiết lập thông số:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Cấu hình các biến môi trường (**Environment Variables**):
   - `MONGODB_URI`: Chuỗi kết nối cơ sở dữ liệu
   - `JWT_SECRET`: Khóa bí mật JWT tùy chọn (hoặc để mặc định)
   - `PORT`: 5000 (hoặc cổng do hệ thống tự cấp)

### Phương án C: Triển khai trên máy chủ Linux / Ubuntu (VPS) bằng PM2
```bash
# 1. Cài đặt Node.js và PM2
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2

# 2. Tải mã nguồn, cài đặt và build
npm install
npm run build

# 3. Khởi chạy với PM2
pm2 start backend/src/server.js --name "cham-chua-ai"
pm2 save
pm2 startup
```

---

## 5. Cấu Trúc Mã Nguồn

```text
├── Dockerfile              # Cấu hình container Docker sản xuất
├── package.json            # Quản lý scripts build và start toàn dự án
├── start_app.bat           # File khởi động nhanh 1-click trên Windows
├── run_local.py            # Script khởi động tự động nhận diện Node/Python
│
├── backend/                # Máy chủ Backend Node.js / Express
│   ├── src/
│   │   ├── config/db.js            # Kết nối cơ sở dữ liệu
│   │   ├── middleware/auth.js      # Middleware JWT và kiểm tra quyền Admin/Teacher
│   │   ├── models/
│   │   │   ├── User.js             # Model Người dùng (Admin / Teacher)
│   │   │   ├── School.js           # Model Quản lý danh mục Trường học
│   │   │   ├── Class.js            # Model Lớp học & phân bổ giáo viên
│   │   │   ├── Student.js          # Model Học sinh
│   │   │   ├── Submission.js       # Model Bài nộp, điểm số, nhận xét
│   │   │   └── Assignment.js       # Model Tiêu chí đánh giá & đề bài
│   │   ├── controllers/
│   │   │   ├── authController.js   # Đăng nhập, thông tin tài khoản, đổi mật khẩu
│   │   │   ├── userController.js   # Admin tạo, sửa, xóa, cấp MK cho giáo viên
│   │   │   ├── schoolController.js # Admin thêm, sửa, xem danh mục trường học
│   │   │   ├── classController.js  # Giáo viên tạo và quản lý lớp học
│   │   │   └── submissionController.js # Tải bài làm, chấm điểm, duyệt kết quả
│   │   ├── routes/api.js           # Các đường dẫn REST API
│   │   └── server.js               # Khởi chạy Express và phục vụ giao diện Web
│   └── .env                        # Cấu hình biến môi trường
│
├── frontend/               # Giao diện React 18 + Vite
│   ├── src/
│   │   ├── api.js                  # Giao tiếp API chuẩn hóa với đường dẫn động
│   │   ├── App.jsx                 # Điều hướng chính theo phiên đăng nhập & vai trò
│   │   ├── components/
│   │   │   ├── LoginPage.jsx       # Đăng nhập hệ thống
│   │   │   ├── AdminUsersPage.jsx  # Quản lý tài khoản giáo viên (Tạo, Sửa, Đổi MK)
│   │   │   ├── AdminSchoolsPage.jsx# Danh mục trường & lớp (+ Thêm trường mới)
│   │   │   ├── AdminStatsPage.jsx  # Báo cáo & thống kê toàn hệ thống
│   │   │   ├── Header.jsx          # Thanh đầu trang phân quyền và trạng thái
│   │   │   ├── Sidebar.jsx         # Thanh điều hướng riêng biệt cho Admin / Teacher
│   │   │   ├── OverviewPage.jsx    # Tổng quan lớp học (Giáo viên)
│   │   │   ├── IntakePage.jsx      # Nhận bài làm & nạp ảnh/PDF
│   │   │   ├── GradingPage.jsx     # Chấm bài, sửa nhận xét và xuất CSV
│   │   │   └── RosterPage.jsx      # Quản lý danh sách học sinh
│   └── dist/                       # Giao diện sau khi build sản xuất
│
└── dist/                   # Bản build phân phối sẵn sàng cho Backend phục vụ
```

---

## 5. Quy Trình Trải Nghiệm Mẫu

1. **Trải nghiệm góc độ Admin (Quản trị viên)**:
   - Vào `http://localhost:5000`, nhấp chọn **Admin (`admin / admin@123`)**.
   - Tại trang **"Quản lý Giáo viên"**, xem danh sách các cô giáo thuộc các trường.
   - Nhấn **"+ Tạo tài khoản Giáo viên mới"**, điền:
     - Họ tên: `Cô Hoàng Thu Trang`
     - Tên đăng nhập: `cothutrang`
     - Mật khẩu: `123456`
     - Trường học: `Trường Tiểu học Chu Văn An` (hoặc nhập tên trường mới)
   - Nhấn **"Tạo tài khoản Giáo viên"**. Dữ liệu được lưu ngay vào **MongoDB Atlas**.
   - Đăng xuất bằng menu ở góc phải hoặc cuối sidebar.

2. **Trải nghiệm góc độ Giáo viên (Cô giáo)**:
   - Đăng nhập bằng tài khoản cô giáo mà Admin vừa tạo.
   - Giao diện chuyển sang không gian làm việc của cô:
     - Tên cô và tên trường hiển thị nổi bật trên thanh tiêu đề và thanh bên.
     - Cô nhấn "+ Thêm lớp" để tạo lớp học của trường mình (ví dụ: Lớp 4A).
     - Vào "Danh sách lớp" để nhập học sinh (bằng tay hoặc dán danh sách nhiều dòng).
     - Vào "Nhận bài & chấm AI" để tải lên ảnh chụp hoặc PDF bài viết thật của học sinh.
     - Chấm chữa bài, xem gợi ý AI, duyệt điểm và xuất báo cáo CSV.
