# =============================================================================
# CDC ĐÀ NẴNG - BẢN ĐỒ DỊCH TỄ HỌC SỐ
# Production Dockerfile for Coolify & Cloud Deployment
# =============================================================================

FROM nginx:alpine-slim

LABEL maintainer="To CNTT - CDC Da Nang"
LABEL description="Digital Epidemiology Map - Da Nang CDC"

# Xóa cấu hình mặc định của Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy cấu hình Nginx bảo mật cao
COPY nginx.conf /etc/nginx/nginx.conf

# Copy toàn bộ mã nguồn ứng dụng web và dữ liệu dịch tễ đã ẩn danh
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY danang_districts.js /usr/share/nginx/html/
COPY danang_facilities.js /usr/share/nginx/html/
COPY danang_facilities.json /usr/share/nginx/html/
COPY data_epidemiology.js /usr/share/nginx/html/
COPY data_epidemiology.json /usr/share/nginx/html/

# Phân quyền tệp tin cho người dùng nginx
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Kiểm tra sức khỏe container (Healthcheck)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
