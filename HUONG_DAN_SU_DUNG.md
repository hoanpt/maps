# HỆ THỐNG BẢN ĐỒ DỊCH TỄ HỌC SỐ (GIS) - CDC ĐÀ NẴNG
> **Phân hệ Giám sát & Điều hành Dịch tễ học Không gian**  
> *(Phát triển bởi Tổ CNTT - Trung tâm Kiểm soát bệnh tật TP. Đà Nẵng)*

---

## 1. TỔNG QUAN HỆ THỐNG
Hệ thống là giải pháp **Bản đồ Dịch tễ học số (Digital Epidemiology Map)** phục vụ Trung tâm Kiểm soát bệnh tật TP. Đà Nẵng (CDC Đà Nẵng). Ứng dụng tích hợp trực tiếp toàn bộ dữ liệu thực tế từ file `Danh_sach_ca_benh.xlsx` với **hơn 23.900 ca bệnh** và mạng lưới cơ sở y tế trên toàn địa bàn.

### CÁC TÍNH NĂNG CHÍNH:
1. **Hệ thống 7 Lớp bản đồ GIS**:
   - **Layer 1 (Admin Boundaries)**: Ranh giới hành chính các quận/huyện trên địa bàn TP. Đà Nẵng (Hải Châu, Thanh Khê, Liên Chiểu, Ngũ Hành Sơn, Cẩm Lệ, Sơn Trà, Hòa Vang).
   - **Layer 2 (Point Layer)**: Lớp điểm ca bệnh thời gian thực theo mã màu chuẩn: Sốt xuất huyết (Cam), Tay chân miệng (Vàng), Cúm (Xanh cyan), Lao (Tím), Sởi (Đỏ), Sốt rét (Nâu đỏ)... Click vào từng điểm để mở popup hồ sơ bệnh án chuẩn Thông tư 15 BYT.
   - **Layer 3 (Buffer Zone 200m & Outbreak Alarm)**: Tự động tính toán và vẽ vòng tròn bán kính 200m quanh các ca Sốt xuất huyết. Tự động phát hiện khi các vùng đệm giao nhau ($\le 400m$) trong cùng chu kỳ dịch để cảnh báo nguy cơ hình thành ổ dịch tập trung.
   - **Layer 4 (Heatmap Density)**: Bản đồ nhiệt mật độ lây nhiễm nhận diện ngay các điểm nóng (Hotspots) bùng phát toàn thành phố.
   - **Layer 7 (Facility & Resource Layer)**: Vị trí Trụ sở CDC Đà Nẵng, 7 Trung tâm Y tế quận/huyện và các Bệnh viện tiếp nhận điều trị chuyên sâu (BV Phụ sản Nhi, BV Đà Nẵng, BV C, Hoàn Mỹ, Tâm Trí...).
2. **Bảng điều khiển tương tác (CDC Command Center)**:
   - Thẻ KPI số liệu nhanh: Tổng số ca, số ca SXH & vùng đệm 200m đang kích hoạt, số ca TCM, số ổ dịch giao cắt cảnh báo.
   - Bộ lọc đa chiều: Lọc nhanh theo nhóm bệnh, lọc theo từng Phường/Xã trong số 94 địa bàn, phân loại chẩn đoán (xác định / nghi ngờ), tình trạng bệnh (nội trú / ngoại trú / ra viện / tử vong).
   - Biểu đồ dịch tễ tự động cập nhật: Cơ cấu bệnh tật (Doughnut) và Diễn tiến ca bệnh theo tháng (Line chart).
3. **Thanh trượt thời gian (Time-Slider Simulation)**:
   - Tua tự động (Play/Pause) hoặc kéo thanh trượt để quan sát dịch bệnh lan truyền theo từng tuần/tháng trong giai đoạn 2025 - 2026.
4. **Công cụ Thêm ca bệnh giả lập & Phát hiện ổ dịch thực địa**:
   - Click trực tiếp trên bản đồ Đà Nẵng để thả ca bệnh mới.
   - Hệ thống tự động sinh vùng đệm 200m tức thì và kích hoạt báo động nếu giao cắt với các ca bệnh cũ.
5. **Nạp dữ liệu mới trực tiếp (In-browser Excel Reader)**:
   - Kéo thả file Excel cập nhật để bản đồ tự động làm mới.

---

## 2. CÁCH KHỞI ĐỘNG HỆ THỐNG (MỞ LÀ CHẠY NGAY)

Hệ thống được thiết kế theo hướng **Zero-Configuration**, không cần cài đặt phần mềm máy chủ hay hệ quản trị cơ sở dữ liệu cồng kềnh.

### Cách 1 (Nhanh nhất - 1 Click):
- Nhấp đúp chuột (Double click) vào file **`CHAY_HE_THONG.bat`**  
  *Hoặc* nhấp đúp chuột trực tiếp vào file **`index.html`** để mở trên trình duyệt (Google Chrome, Microsoft Edge, Cốc Cốc, Firefox...).

### Cách 2 (Chạy qua Python Web Server):
Mở cửa sổ dòng lệnh tại thư mục này và chạy:
```bash
python -m http.server 8000
```
Sau đó mở trình duyệt truy cập: `http://localhost:8000/index.html`

---

## 4. DANH SÁCH BẢN ĐỒ NỀN (100% MIỄN PHÍ - KHÔNG CẦN API KEY)
Hệ thống đã tích hợp sẵn cơ chế **Direct Public Tiles** cho phép tải bản đồ hoàn toàn miễn phí, không bị giới hạn chính sách bản quyền hay chặn truy cập:
1. **Google Maps Đường phố (Tiêu chuẩn)**: Bản đồ đường bộ chi tiết nhất tại Việt Nam, đầy đủ tên đường tiếng Việt, kiệt hẻm, số nhà, địa danh Đà Nẵng (Mặc định).
2. **Google Maps Vệ tinh + Tên đường (Hybrid)**: Ảnh vệ tinh quang học kết hợp lớp nhãn địa danh tiếng Việt cực rõ nét.
3. **Bản đồ Tối CDC (Carto Dark Fastly)**: Tối ưu độ tương phản cho phòng điều hành giám sát dịch bệnh vào ban đêm hoặc trên màn hình ghép.
4. **Bản đồ Giao thông OSM HOT (Humanitarian OSM)**: Bản đồ nguồn mở được duy trì bởi Đội cứu trợ nhân đạo quốc tế, mở không bị chặn Referer hay lỗi 403.
5. **Bản đồ Sáng CDC (Carto Positron Fastly)**: Tông màu sáng thanh lịch, dễ in ấn ra giấy A4/A3.
6. **Bản đồ Vệ tinh Esri HD**: Ảnh chụp vệ tinh độ nét cao từ ArcGIS Online công cộng.

## 5. CẤU TRÚC THƯ MỤC & FILE
| Tên File / Thư mục | Chức năng |
|---|---|
| `index.html` | Giao diện chính của Trung tâm điều hành dịch tễ CDC Đà Nẵng |
| `styles.css` | Bộ thiết kế giao diện hiện đại (Dark Theme & GIS overlays) |
| `app.js` | Module xử lý GIS, Leaflet, Turf.js tính toán không gian và điều khiển biểu đồ |
| `Danh_sach_ca_benh.xlsx` | Dữ liệu gốc báo cáo dịch tễ Bộ Y tế (TT15 & QĐ 4922) |
| `process_data.py` | Script tiền xử lý dữ liệu và tự động gán tọa độ không gian (Geocoding) |
| `data_epidemiology.js` / `.json` | Dữ liệu dịch tễ học đã được làm sạch và tối ưu cho Web GIS |
| `danang_facilities.js` / `.json` | Danh bạ và tọa độ mạng lưới cơ sở y tế CDC & Bệnh viện |
| `danang_districts.js` | Dữ liệu ranh giới GeoJSON các quận huyện TP. Đà Nẵng |
| `CHAY_HE_THONG.bat` | File chạy tắt 1-click cho người sử dụng |
