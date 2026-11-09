import sys
import os
import json
import random
import pandas as pd
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

print("Bắt đầu xử lý dữ liệu từ file Danh_sach_ca_benh.xlsx...")

excel_path = "Danh_sach_ca_benh.xlsx"
df_tt15 = pd.read_excel(excel_path, sheet_name="TT15")
df_malaria = pd.read_excel(excel_path, sheet_name="Sốt rét 4922")

print(f"Đã đọc {len(df_tt15)} dòng từ sheet TT15 và {len(df_malaria)} dòng từ sheet Sốt rét 4922.")

# Từ điển tọa độ tâm của các Xã / Phường / Khu vực (Lat, Lng, Bán kính phân tán theo độ)
GEO_DICT = {
    # Quận Ngũ Hành Sơn
    "Phường Ngũ Hành Sơn": (16.0125, 108.2520, 0.015),
    "Phường Hòa Hải": (15.9850, 108.2650, 0.015),
    "Phường Hòa Quý": (15.9920, 108.2350, 0.015),
    "Phường Khuê Mỹ": (16.0280, 108.2430, 0.012),
    "Phường Mỹ An": (16.0460, 108.2420, 0.012),
    # Quận Liên Chiểu
    "Phường Hòa Khánh": (16.0780, 108.1520, 0.018),
    "Phường Liên Chiểu": (16.0720, 108.1600, 0.018),
    "Phường Hòa Minh": (16.0650, 108.1690, 0.015),
    "Phường Hải Vân": (16.1280, 108.1250, 0.025),
    "Phường Hòa Hiệp": (16.1150, 108.1320, 0.020),
    # Quận Thanh Khê
    "Phường Thanh Khê": (16.0620, 108.1880, 0.012),
    "Phường An Khê": (16.0580, 108.1790, 0.012),
    "Phường Tam Thuận": (16.0680, 108.2050, 0.008),
    "Phường Xuân Hà": (16.0690, 108.1980, 0.008),
    "Phường Tân Chính": (16.0620, 108.2040, 0.008),
    "Phường Chính Gián": (16.0590, 108.2000, 0.008),
    "Phường Vĩnh Trung": (16.0560, 108.2080, 0.008),
    "Phường Thạc Gián": (16.0570, 108.2030, 0.008),
    # Quận Cẩm Lệ
    "Phường Cẩm Lệ": (16.0240, 108.1960, 0.015),
    "Phường Hòa Xuân": (15.9950, 108.2140, 0.018),
    "Phường Khuê Trung": (16.0320, 108.2050, 0.012),
    "Phường Hòa Thọ Đông": (16.0210, 108.2010, 0.012),
    "Phường Hòa Thọ Tây": (16.0150, 108.1820, 0.015),
    "Phường Hòa Phát": (16.0420, 108.1800, 0.015),
    "Phường Hòa An": (16.0520, 108.1750, 0.015),
    # Quận Sơn Trà
    "Phường Sơn Trà": (16.0900, 108.2480, 0.020),
    "Phường An Hải": (16.0680, 108.2360, 0.012),
    "Phường Phước Mỹ": (16.0580, 108.2440, 0.010),
    "Phường Nại Hiên Đông": (16.0820, 108.2320, 0.012),
    "Phường Thọ Quang": (16.1020, 108.2510, 0.020),
    "Phường Mân Thái": (16.0780, 108.2430, 0.010),
    # Quận Hải Châu
    "Phường Hải Châu": (16.0650, 108.2210, 0.010),
    "Phường Hòa Cường": (16.0390, 108.2190, 0.012),
    "Phường Thạch Thang": (16.0740, 108.2230, 0.008),
    "Phường Thuận Phước": (16.0810, 108.2200, 0.008),
    "Phường Thanh Bình": (16.0720, 108.2120, 0.008),
    "Phường Bình Hiên": (16.0570, 108.2190, 0.008),
    "Phường Bình Thuận": (16.0510, 108.2180, 0.008),
    "Phường Nam Dương": (16.0600, 108.2160, 0.008),
    # Huyện Hòa Vang
    "Xã Hòa Vang": (16.0180, 108.1180, 0.030),
    "Xã Hòa Tiến": (15.9620, 108.1880, 0.020),
    "Xã Bà Nà": (15.9980, 108.0120, 0.040),
    "Xã Hòa Châu": (15.9860, 108.2010, 0.018),
    "Xã Hòa Phước": (15.9680, 108.2120, 0.018),
    "Xã Hòa Khương": (15.9450, 108.1250, 0.025),
    "Xã Hòa Nhơn": (16.0020, 108.1320, 0.025),
    "Xã Hòa Phong": (15.9850, 108.1480, 0.022),
    "Xã Hòa Sơn": (16.0520, 108.1250, 0.025),
    "Xã Hòa Ninh": (16.0350, 108.0820, 0.030),
    "Xã Hòa Liên": (16.0820, 108.1120, 0.025),
    "Xã Hòa Bắc": (16.1420, 108.0250, 0.040),
    "Xã Hòa Phú": (15.9520, 108.0480, 0.035),
    # Địa bàn lân cận Quảng Nam (tiếp giáp Đà Nẵng)
    "Phường Điện Bàn": (15.8920, 108.2520, 0.020),
    "Phường Điện Bàn Đông": (15.9120, 108.2950, 0.020),
    "Phường Điện Bàn Bắc": (15.9380, 108.2320, 0.020),
    "Xã Điện Bàn Tây": (15.8750, 108.1850, 0.025),
    "Phường Hội An": (15.8810, 108.3320, 0.015),
    "Phường Hội An Tây": (15.8850, 108.3120, 0.015),
    "Phường Hội An Đông": (15.8790, 108.3550, 0.018),
    "Xã Duy Xuyên": (15.8280, 108.2520, 0.025),
    "Xã Nam Phước": (15.8320, 108.2650, 0.018),
    "Xã Duy Nghĩa": (15.8520, 108.3850, 0.020),
    "Xã Xuân Phú": (15.7850, 108.3120, 0.025),
    "Xã Thăng Bình": (15.7420, 108.3350, 0.025),
    "Xã Thăng An": (15.7350, 108.3120, 0.025),
    "Xã Thăng Điền": (15.7250, 108.3450, 0.025),
    "Xã Thăng Trường": (15.7150, 108.3200, 0.025),
    "Xã Thăng Phú": (15.7050, 108.3550, 0.025),
    "Phường An Thắng": (15.7480, 108.3420, 0.020),
    "Xã Thu Bồn": (15.8050, 108.1520, 0.030),
    "Phường Bàn Thạch": (15.5820, 108.4920, 0.020),
    "Xã Chiên Đàn": (15.5920, 108.4520, 0.022),
    "Phường Tam Kỳ": (15.5680, 108.4820, 0.020),
    "Phường Hương Trà": (15.5750, 108.4720, 0.018),
    "Xã Đại Lộc": (15.8820, 108.0120, 0.030),
    "Xã Vu Gia": (15.8650, 107.9850, 0.030),
    "Xã Hà Nha": (15.8950, 107.9520, 0.030),
    "Xã Thượng Đức": (15.8750, 107.9250, 0.035),
    "Xã Núi Thành": (15.4250, 108.6520, 0.030),
    "Xã Tam Xuân": (15.4850, 108.5850, 0.025),
    "Xã Tam Anh": (15.4520, 108.6120, 0.025),
    "Xã Tam Mỹ": (15.4120, 108.6320, 0.025),
    "Xã Tam Hải": (15.4350, 108.6950, 0.020),
    "Xã Tây Hồ": (15.5350, 108.4120, 0.025),
    "Phường Quảng Phú": (15.5120, 108.4350, 0.020),
    "Xã Đồng Dương": (15.6520, 108.2250, 0.030),
    "Xã Thạnh Bình": (15.6120, 108.2650, 0.030),
    "Xã Gò Nổi": (15.8650, 108.2120, 0.025),
    "Xã Quế Sơn": (15.6820, 108.1520, 0.030),
    "Xã Quế Sơn Trung": (15.6720, 108.1750, 0.025),
    "Xã Quế Phước": (15.6950, 108.0850, 0.030),
    "Xã Nông Sơn": (15.7120, 108.0520, 0.030),
    "Xã Tiên Phước": (15.4820, 108.2520, 0.030),
    "Xã Thạnh Mỹ": (15.7520, 107.8350, 0.040),
    "Xã Phú Ninh": (15.5250, 108.4020, 0.025),
    "Đặc khu Hoàng Sa": (16.5360, 111.6040, 0.050)
}

# Tâm mặc định của TP. Đà Nẵng nếu xã không nằm trong từ điển
DANANG_DEFAULT = (16.0544, 108.2022, 0.020)

def normalize_disease_group(disease_str):
    if not isinstance(disease_str, str):
        return "KHAC"
    d = disease_str.lower()
    if "sốt xuất huyết" in d or "dengue" in d:
        return "SXH"
    elif "tay - chân - miệng" in d or "tay chân miệng" in d:
        return "TCM"
    elif "cúm" in d:
        return "CUM"
    elif "lao" in d:
        return "LAO"
    elif "sởi" in d:
        return "SOI"
    elif "viêm gan" in d:
        return "VIEM_GAN"
    elif "thủy đậu" in d:
        return "THUY_DAU"
    elif "quai bị" in d:
        return "QUAI_BI"
    elif "sốt rét" in d:
        return "SOT_RET"
    elif "dại" in d:
        return "DAI"
    else:
        return "KHAC"

def format_date(val):
    if pd.isna(val) or val is None:
        return ""
    val_str = str(val).strip()
    # Format YYYY-MM-DD or DD/MM/YYYY
    if len(val_str) >= 10:
        if "/" in val_str:
            parts = val_str.split()[0].split("/")
            if len(parts) == 3:
                d, m, y = parts[0], parts[1], parts[2]
                if len(y) == 4 and len(d) <= 2:
                    return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        elif "-" in val_str:
            return val_str[:10]
    return val_str[:10]

random.seed(42) # Đảm bảo tính nhất quán (reproducible)

records = []
disease_counter = {}
diag_type_counter = {}
status_counter = {}
ward_counter = {}
monthly_counter = {}

# 1. Xử lý Sheet TT15
for idx, row in df_tt15.iterrows():
    # Phân loại bệnh
    disease = str(row.get("Chẩn đoán chính", "Khác") or "Khác").strip()
    disease_group = normalize_disease_group(disease)
    
    # Bỏ qua các ca "Đã điều tra nhưng không có ca bệnh..." hoặc "Bệnh không thuộc danh mục" nếu muốn
    if "không có ca bệnh" in disease.lower():
        continue

    diag_type = str(row.get("Phân loại chẩn đoán", "Nghi ngờ") or "Nghi ngờ").strip()
    status = str(row.get("Tình trạng hiện nay", "Điều trị") or "Điều trị").strip()
    ward = str(row.get("Xã", "TP Đà Nẵng") or "TP Đà Nẵng").strip()
    district = str(row.get("Tỉnh", "Đà Nẵng") or "Đà Nẵng").strip()
    onset_date = format_date(row.get("Ngày khởi phát", ""))
    report_date = format_date(row.get("Thời gian báo cáo", ""))
    gender = str(row.get("Giới tính", "") or "").strip()
    yob = str(row.get("Ngày sinh", "") or "")[-4:] if row.get("Ngày sinh") else ""
    facility = str(row.get("Cơ sở điều trị", "") or row.get("Đơn vị báo cáo", "") or "").strip()
    
    # Xử lý tọa độ
    lat_val = row.get("Vĩ độ")
    lng_val = row.get("Kinh độ")
    
    is_real_coord = False
    try:
        lat = float(lat_val)
        lng = float(lng_val)
        # Kiểm tra tọa độ có nằm trong dải Việt Nam hợp lệ (Lat 12-22, Lng 105-112)
        if 14.0 <= lat <= 17.5 and 107.0 <= lng <= 112.5:
            is_real_coord = True
    except:
        is_real_coord = False

    if not is_real_coord:
        # Lấy từ từ điển hoặc mặc định
        center_lat, center_lng, radius = GEO_DICT.get(ward, DANANG_DEFAULT)
        # Jitter ngẫu nhiên hình tròn
        u = random.random()
        v = random.random()
        w = radius * (u ** 0.5)
        t = 2 * 3.14159265 * v
        lat = round(center_lat + w * (0.8 * random.choice([1, -1]) * abs(u)), 6)
        lng = round(center_lng + w * (0.8 * random.choice([1, -1]) * abs(v)), 6)
    else:
        lat = round(lat, 6)
        lng = round(lng, 6)

    # Thống kê
    disease_counter[disease_group] = disease_counter.get(disease_group, 0) + 1
    diag_type_counter[diag_type] = diag_type_counter.get(diag_type, 0) + 1
    status_counter[status] = status_counter.get(status, 0) + 1
    ward_counter[ward] = ward_counter.get(ward, 0) + 1
    
    month_key = onset_date[:7] if len(onset_date) >= 7 else (report_date[:7] if len(report_date) >= 7 else "2026-01")
    if month_key.startswith("202") or month_key.startswith("201"):
        monthly_counter[month_key] = monthly_counter.get(month_key, 0) + 1

    records.append({
        "id": int(row.get("STT", idx + 1)) if pd.notna(row.get("STT")) else idx + 1,
        "d_name": disease,
        "grp": disease_group,
        "type": diag_type,
        "st": status,
        "w": ward,
        "dt": onset_date if onset_date else report_date,
        "lat": lat,
        "lng": lng,
        "gen": gender,
        "yob": yob,
        "fac": facility[:40] if facility else "CDC Đà Nẵng",
        "rc": 1 if is_real_coord else 0
    })

# 2. Xử lý Sheet Sốt rét 4922
for idx, row in df_malaria.iterrows():
    disease = "Sốt rét"
    disease_group = "SOT_RET"
    diag_type = str(row.get("Phân loại chẩn đoán", "Xác định xét nghiệm") or "Xác định xét nghiệm").strip()
    status = str(row.get("Tình trạng hiện tại", "Khỏi") or "Khỏi").strip()
    ward = str(row.get("Xã (Nơi ở)", "TP Đà Nẵng") or "TP Đà Nẵng").strip()
    onset_date = format_date(row.get("Ngày khởi phát", ""))
    report_date = format_date(row.get("Thời gian báo cáo", ""))
    gender = str(row.get("Giới tính", "") or "").strip()
    facility = str(row.get("Cơ sở y tế NBC", "CDC Đà Nẵng") or "CDC Đà Nẵng").strip()

    center_lat, center_lng, radius = GEO_DICT.get(ward, DANANG_DEFAULT)
    lat = round(center_lat + (random.random() - 0.5) * radius, 6)
    lng = round(center_lng + (random.random() - 0.5) * radius, 6)

    disease_counter[disease_group] = disease_counter.get(disease_group, 0) + 1
    
    records.append({
        "id": 500000 + idx,
        "d_name": disease,
        "grp": disease_group,
        "type": diag_type,
        "st": status,
        "w": ward,
        "dt": onset_date if onset_date else report_date,
        "lat": lat,
        "lng": lng,
        "gen": gender,
        "yob": "",
        "fac": facility[:40],
        "rc": 0
    })

print(f"Tổng số ca bệnh hợp lệ sau xử lý: {len(records)}")

# Sắp xếp top xã phường
top_wards = sorted(ward_counter.items(), key=lambda x: x[1], reverse=True)[:15]

# Sắp xếp diễn tiến theo tháng
sorted_months = sorted([m for m in monthly_counter.keys() if m >= "2025-01" and m <= "2026-12"])
monthly_series = [{"month": m, "count": monthly_counter[m]} for m in sorted_months]

output_data = {
    "summary": {
        "total_cases": len(records),
        "total_sxh": disease_counter.get("SXH", 0),
        "total_tcm": disease_counter.get("TCM", 0),
        "total_cum": disease_counter.get("CUM", 0),
        "total_lao": disease_counter.get("LAO", 0),
        "total_soi": disease_counter.get("SOI", 0),
        "total_sot_ret": disease_counter.get("SOT_RET", 0),
        "disease_stats": disease_counter,
        "diag_type_stats": diag_type_counter,
        "status_stats": status_counter,
        "top_wards": top_wards,
        "monthly_trend": monthly_series
    },
    "cases": records
}

# Xuất ra data_epidemiology.json
json_out_path = "data_epidemiology.json"
with open(json_out_path, "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False)

file_size_mb = os.path.getsize(json_out_path) / (1024 * 1024)
print(f"Đã xuất thành công: {json_out_path} ({file_size_mb:.2f} MB)")

# 3. Tạo danh sách Cơ sở Y tế & Nguồn lực CDC (Layer 7)
facilities = [
    {
        "id": "fac_cdc",
        "name": "Trung tâm Kiểm soát bệnh tật TP. Đà Nẵng (CDC Đà Nẵng)",
        "type": "CDC",
        "level": "Tuyến Tỉnh/Thành phố",
        "address": "103 Hùng Vương, Hải Châu 1, Hải Châu, Đà Nẵng",
        "lat": 16.0682,
        "lng": 108.2195,
        "beds": 0,
        "hotline": "0236 3821 469",
        "role": "Cơ quan đầu mối chỉ đạo phòng chống dịch bệnh toàn thành phố"
    },
    {
        "id": "fac_bv_dn",
        "name": "Bệnh viện Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Hạng I",
        "address": "124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng",
        "lat": 16.0715,
        "lng": 108.2155,
        "beds": 2000,
        "hotline": "0236 3821 118",
        "role": "Tiếp nhận điều trị ca bệnh nặng, hồi sức tích cực"
    },
    {
        "id": "fac_bv_psn",
        "name": "Bệnh viện Phụ sản - Nhi Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Hạng I",
        "address": "402 Lê Văn Hiến, Khuê Mỹ, Ngũ Hành Sơn, Đà Nẵng",
        "lat": 16.0268,
        "lng": 108.2435,
        "beds": 1200,
        "hotline": "0236 3957 777",
        "role": "Điều trị chuyên sâu ca Sốt xuất huyết và Tay chân miệng ở trẻ em"
    },
    {
        "id": "fac_bv_c",
        "name": "Bệnh viện C Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Tuyến Trung ương",
        "address": "122 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng",
        "lat": 16.0722,
        "lng": 108.2162,
        "beds": 1000,
        "hotline": "0236 3821 480",
        "role": "Tiếp nhận điều trị đa khoa tuyến trung ương"
    },
    {
        "id": "fac_bv_phoi",
        "name": "Bệnh viện Phổi Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Chuyên khoa",
        "address": "Tổ 53, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng",
        "lat": 15.9892,
        "lng": 108.2612,
        "beds": 300,
        "hotline": "0236 3967 850",
        "role": "Điều trị chuyên sâu bệnh Lao và các bệnh truyền nhiễm đường hô hấp"
    },
    {
        "id": "fac_ttyt_hc",
        "name": "Trung tâm Y tế Quận Hải Châu",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "38 Cao Thắng, Thanh Bình, Hải Châu, Đà Nẵng",
        "lat": 16.0735,
        "lng": 108.2140,
        "beds": 250,
        "hotline": "0236 3822 559",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Hải Châu"
    },
    {
        "id": "fac_ttyt_tk",
        "name": "Trung tâm Y tế Quận Thanh Khê",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "62/32 Trần Cao Vân, Tam Thuận, Thanh Khê, Đà Nẵng",
        "lat": 16.0688,
        "lng": 108.2045,
        "beds": 200,
        "hotline": "0236 3828 013",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Thanh Khê"
    },
    {
        "id": "fac_ttyt_st",
        "name": "Trung tâm Y tế Quận Sơn Trà",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "1118 Ngô Quyền, An Hải Bắc, Sơn Trà, Đà Nẵng",
        "lat": 16.0725,
        "lng": 108.2385,
        "beds": 220,
        "hotline": "0236 3844 614",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Sơn Trà"
    },
    {
        "id": "fac_ttyt_nhs",
        "name": "Trung tâm Y tế Quận Ngũ Hành Sơn",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "582 Lê Văn Hiến, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng",
        "lat": 15.9965,
        "lng": 108.2582,
        "beds": 180,
        "hotline": "0236 3847 480",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Ngũ Hành Sơn"
    },
    {
        "id": "fac_ttyt_lc",
        "name": "Trung tâm Y tế Quận Liên Chiểu",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "525 Tôn Đức Thắng, Hòa Khánh Nam, Liên Chiểu, Đà Nẵng",
        "lat": 16.0625,
        "lng": 108.1635,
        "beds": 250,
        "hotline": "0236 3730 401",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Liên Chiểu"
    },
    {
        "id": "fac_ttyt_cl",
        "name": "Trung tâm Y tế Quận Cẩm Lệ",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "105 Nguyễn Nhàn, Hòa Thọ Đông, Cẩm Lệ, Đà Nẵng",
        "lat": 16.0245,
        "lng": 108.2030,
        "beds": 220,
        "hotline": "0236 3672 888",
        "role": "Đội cơ động phản ứng nhanh & dập dịch quận Cẩm Lệ"
    },
    {
        "id": "fac_ttyt_hv",
        "name": "Trung tâm Y tế Huyện Hòa Vang",
        "type": "TTYT",
        "level": "Tuyến Quận/Huyện",
        "address": "Xã Hòa Phong, Hòa Vang, Đà Nẵng",
        "lat": 15.9860,
        "lng": 108.1450,
        "beds": 200,
        "hotline": "0236 3788 506",
        "role": "Đội cơ động phản ứng nhanh & dập dịch huyện Hòa Vang"
    },
    {
        "id": "fac_bv_hoanmy",
        "name": "Bệnh viện Hoàn Mỹ Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Tư nhân",
        "address": "291 Nguyễn Văn Linh, Thạc Gián, Thanh Khê, Đà Nẵng",
        "lat": 16.0592,
        "lng": 108.2095,
        "beds": 350,
        "hotline": "0236 3650 676",
        "role": "Tiếp nhận cấp cứu và điều trị phối hợp"
    },
    {
        "id": "fac_bv_tamtri",
        "name": "Bệnh viện Đa khoa Tâm Trí Đà Nẵng",
        "type": "HOSPITAL",
        "level": "Tư nhân",
        "address": "64 Cách Mạng Tháng 8, Khuê Trung, Cẩm Lệ, Đà Nẵng",
        "lat": 16.0315,
        "lng": 108.2085,
        "beds": 200,
        "hotline": "0236 3679 555",
        "role": "Tiếp nhận cấp cứu và điều trị phối hợp"
    }
]

with open("danang_facilities.json", "w", encoding="utf-8") as f:
    json.dump(facilities, f, ensure_ascii=False, indent=2)

print("Đã xuất danh sách cơ sở y tế vào danang_facilities.json")
print("Hoàn tất tiền xử lý dữ liệu!")
