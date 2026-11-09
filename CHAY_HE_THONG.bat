@echo off
chcp 65001 >nul
title CDC ĐÀ NẴNG - BẢN ĐỒ DỊCH TỄ HỌC SỐ (GIS)
echo =========================================================================
echo    HỆ THỐNG BẢN ĐỒ DỊCH TỄ HỌC SỐ - TRUNG TÂM KIỂM SOÁT BỆNH TẬT ĐÀ NẴNG
echo                        (Phát triển bởi Tổ CNTT)
echo =========================================================================
echo.
echo [1] Đang khởi động giao diện điều hành CDC Đà Nẵng...
echo.

:: Mở trực tiếp file index.html trên trình duyệt mặc định
start "" "%~dp0index.html"

echo [OK] Ứng dụng đã được mở trên trình duyệt của bạn!
echo Nếu bạn muốn chạy qua máy chủ Python cục bộ (HTTP Server), vui lòng nhấn phím bất kỳ...
pause >nul

echo Đang khởi động Python HTTP Server tại cổng 8000...
start "" "http://localhost:8000/index.html"
python -m http.server 8000
