# BẢN ĐỒ DỊCH TỄ HỌC SỐ - CDC ĐÀ NẴNG
> **Hệ thống Giám sát & Điều hành Dịch tễ học Không gian (GIS)**  
> *(Phát triển bởi Tổ CNTT - Trung tâm Kiểm soát bệnh tật TP. Đà Nẵng)*

---

## 1. TỔNG QUAN
Hệ thống **Bản đồ Dịch tễ học số** là giải pháp Web GIS chuyên sâu phục vụ công tác giám sát, phân tích không gian và điều hành dập dịch bệnh truyền nhiễm (Sốt xuất huyết Dengue, Tay chân miệng, Cúm, Lao, Sởi, Sốt rét...).

### TÍNH NĂNG NỔI BẬT:
* **7 Lớp bản đồ GIS chuyên nghiệp**: Ranh giới hành chính, Điểm ca bệnh thời gian thực (Cluster), Vùng đệm 200m tự động quanh ca SXH, Bản đồ nhiệt mật độ (Heatmap), và Mạng lưới cơ sở y tế (CDC, 7 TTYT quận/huyện, Bệnh viện điều trị).
* **Thuật toán tự động phát hiện ổ dịch giao thoa**: Khi $\ge 2$ ca Sốt xuất huyết có vùng đệm 200m giao nhau ($\le 400m$), hệ thống tự động đổi viền đỏ báo động nguy cơ bùng phát ổ dịch.
* **Bản đồ nền 100% miễn phí**: Tích hợp Google Maps Đường phố tiếng Việt, Google Maps Vệ tinh Hybrid, Bản đồ Tối CDC, Bản đồ Giao thông OSM HOT. Không cần API Key, không lo bị chặn.
* **Bảng điều khiển tương tác**: Thẻ KPI, lọc đa chiều theo bệnh/xã phường/tình trạng, biểu đồ Chart.js tự động cập nhật, thanh trượt thời gian (Time-Slider) tua tiến trình dịch 2025 - 2026.
* **Công cụ Giả lập ca bệnh**: Click trực tiếp trên bản đồ để thử nghiệm phản ứng vùng đệm 200m và kiểm tra ổ dịch thực địa.

---

## 2. BÁO CÁO CƠ CHẾ BẢO MẬT (SECURITY AUDIT)

Hệ thống được thiết kế tuân thủ nghiêm ngặt các quy chuẩn an toàn thông tin và quyền riêng tư dữ liệu y tế:

| Tiêu chuẩn bảo mật | Cơ chế thực thi |
|---|---|
| **Ẩn danh hóa dữ liệu bệnh nhân (De-identification)** | Toàn bộ thông tin định danh cá nhân nhạy cảm (**Họ tên, CCCD/CMND, Số điện thoại, Địa chỉ nhà riêng cụ thể**) đã được lược bỏ 100% khỏi dữ liệu web. |
| **Bảo vệ tọa độ riêng tư (Spatial Jittering)** | 99% ca bệnh được ánh xạ theo tâm hành chính xã/phường có độ phân tán ngẫu nhiên tự nhiên trong ranh giới địa bàn, không định vị nhà riêng của người bệnh. |
| **Cách ly dữ liệu gốc** | File Excel thô `Danh_sach_ca_benh.xlsx` được chặn triệt để qua `.gitignore` và `.dockerignore`, **tuyệt đối không bao giờ bị đẩy lên GitHub hoặc lọt vào Docker image**. |
| **Nginx Hardening & Security Headers** | Cấu hình Nginx bật sẵn: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `server_tokens off` (ẩn phiên bản Nginx), và Content Security Policy (CSP). |
| **Chặn truy cập tệp tin nhạy cảm** | Nginx tự động trả về `404 Not Found` nếu có truy cập vào các file ẩn (`.git`, `.env`) hoặc file mã nguồn/dữ liệu (`.xlsx`, `.py`, `.sh`, `.bat`). |
| **Nén Gzip tăng tốc** | Tự động nén Gzip các file dữ liệu lớn, giảm dung lượng tải qua mạng từ 7MB xuống còn ~1.2MB. |

---

## 3. HƯỚNG DẪN ĐẨY LÊN GITHUB (3 BƯỚC)

Mở **PowerShell** hoặc **Terminal** tại thư mục dự án và thực hiện:

```bash
# 1. Khởi tạo kho lưu trữ Git
git init

# 2. Thêm toàn bộ mã nguồn an toàn (đã tự động loại trừ file Excel thô)
git add .

# 3. Commit mã nguồn
git commit -m "Phat trien He thong Ban do Dich te hoc so - To CNTT"

# 4. Đổi tên nhánh chính thành main
git branch -M main

# 5. Liên kết tới kho lưu trữ GitHub của bạn (thay URL bằng repo của bạn)
git remote add origin https://github.com/<TAI_KHOAN_CUA_BAN>/<TEN_REPO>.git

# 6. Đẩy mã nguồn lên GitHub
git push -u origin main
```

---

## 4. HƯỚNG DẪN CHẠY TRÊN MÁY CHỦ COOLIFY

Coolify hỗ trợ triển khai hoàn toàn tự động chỉ với vài cú nhấp chuột:

1. Đăng nhập vào bảng điều khiển **Coolify** của bạn.
2. Chọn **Project** $\rightarrow$ Bấm **+ New Resource** $\rightarrow$ Chọn **GitHub Repository**.
3. Chọn Repository bạn vừa đẩy lên ở Bước 3.
4. Coolify sẽ **tự động nhận diện `Dockerfile`** ở thư mục gốc.
5. Tại mục **Configuration**:
   * **Port**: Đặt cổng `80` (mặc định của Dockerfile).
   * **Domain**: Điền tên miền bạn muốn gán (ví dụ: `https://dichte.yourdomain.com`). Coolify sẽ tự động cấp chứng chỉ bảo mật SSL (Let's Encrypt HTTPS) miễn phí.
6. Bấm nút **Deploy**!
   * Coolify sẽ tự động build image `nginx:alpine-slim`, áp dụng toàn bộ cấu hình bảo mật `nginx.conf` và khởi chạy ứng dụng.

---

## 5. CHẠY THỬ NGHIỆM TẠI MÁY CỤC BỘ (LOCAL)

* **Bằng Docker**:
  ```bash
  docker compose up -d --build
  ```
  Truy cập: `http://localhost`

* **Bằng 1 Click**:
  Nhấp đúp chuột vào file `CHAY_HE_THONG.bat` hoặc mở trực tiếp `index.html`.
