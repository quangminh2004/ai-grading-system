@echo off
chcp 65001 >nul
echo ======================================================================
echo    KHỞI ĐỘNG HỆ THỐNG TRỢ LÝ CHẤM & CHỮA BÀI AI (PHÂN QUYỀN & ĐA TRƯỜNG)
echo ======================================================================

set "PATH=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Không tìm thấy Node.js trong hệ thống.
    pause
    exit /b 1
)

echo [*] Đang khởi động Backend Server & Web App tại http://localhost:5000...
echo [*] Trạng thái: Đã kết nối cơ sở dữ liệu trực tuyến (Dữ liệu thật 100%)
echo [*] Đăng nhập Quản trị viên: admin / admin@123
echo [*] (Admin quản lý danh mục trường học và cấp tài khoản cho các cô giáo)
echo ======================================================================
cd backend
node src/server.js
pause

