/**
 * ============================================================================
 * CDC ĐÀ NẴNG - HỆ THỐNG BẢN ĐỒ DỊCH TỄ HỌC SỐ (DIGITAL EPIDEMIOLOGY MAP)
 * Core Application Engine & GIS Module
 * ============================================================================
 */

// STATE MANAGEMENT
const state = {
  rawCases: [],
  filteredCases: [],
  facilities: [],
  districtsGeo: null,
  activeDisease: "ALL",
  activeDiagType: "ALL",
  activeWard: "ALL",
  activeStatus: "ALL",
  activeMonth: "ALL",
  isSimulating: false,
  simCases: [],
  isPlayingTime: false,
  playInterval: null,
  allMonths: [],
  charts: {
    disease: null,
    trend: null,
    ward: null
  },
  guestCharts: {
    trend: null,
    disease: null,
    districts: null
  }
};

// MAP & LAYERS
let map;
let baseLayers = {};
let layerGroups = {
  districts: null,      // Layer 1: Ranh giới hành chính
  caseMarkers: null,    // Layer 2: Điểm ca bệnh (Cluster)
  bufferZone: null,     // Layer 3: Vùng đệm 200m SXH & Ổ dịch
  heatmap: null,        // Layer 4: Bản đồ nhiệt Leaflet.heat
  choropleth: null,     // Layer 5: Phân vùng nguy cơ
  facilities: null,     // Layer 7: Cơ sở y tế & Nguồn lực
  simulation: null      // Lớp ca bệnh giả lập
};

// MÃ MÀU CHUẨN CÁC BỆNH TRUYỀN NHIỄM
const DISEASE_COLORS = {
  SXH: "#f97316",      // Sốt xuất huyết: Cam
  TCM: "#eab308",      // Tay chân miệng: Vàng
  CUM: "#06b6d4",      // Cúm: Xanh cyan
  LAO: "#a855f7",      // Lao: Tím
  SOI: "#ef4444",      // Sởi: Đỏ
  SOT_RET: "#842029",  // Sốt rét: Nâu đỏ
  KHAC: "#64748b"      // Khác: Xám
};

const DISEASE_LABELS = {
  ALL: "Tất cả bệnh",
  SXH: "Sốt xuất huyết Dengue",
  TCM: "Tay - Chân - Miệng",
  CUM: "Cúm",
  LAO: "Bệnh Lao",
  SOI: "Sởi",
  SOT_RET: "Sốt rét",
  KHAC: "Bệnh khác"
};

// ============================================================================
// KHỞI ĐỘNG ỨNG DỤNG
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Khởi động Hệ thống Bản đồ Dịch tễ học số CDC Đà Nẵng...");
  
  try {
    // 1. Tải dữ liệu
    await loadData();
  } catch (err) {
    console.warn("Lỗi tải dữ liệu:", err);
  }

  try {
    // 2. Khởi tạo bản đồ Leaflet
    initMap();
  } catch (err) {
    console.error("Lỗi khởi tạo bản đồ:", err);
  }

  try {
    // 3. Khởi tạo UI tương tác & Sự kiện
    initUIEvents();
  } catch (err) {
    console.warn("Lỗi khởi tạo UI:", err);
  }

  try {
    // 4. Khởi tạo các biểu đồ Chart.js (Sidebar & Guest Dashboard)
    initCharts();
    initGuestCharts();
  } catch (err) {
    console.warn("Lỗi khởi tạo biểu đồ:", err);
  }

  try {
    // 5. Cập nhật hiển thị lần đầu
    applyFilters();
  } catch (err) {
    console.warn("Lỗi lọc dữ liệu ban đầu:", err);
  }
});

// ============================================================================
// TẢI DỮ LIỆU (Tự động thích ứng cả mở file:// và http://)
// ============================================================================
async function loadData() {
  // 1. Dữ liệu ca bệnh
  if (window.EPIDEMIOLOGY_DATA && window.EPIDEMIOLOGY_DATA.cases) {
    state.rawCases = window.EPIDEMIOLOGY_DATA.cases;
  } else {
    try {
      const resp = await fetch("data_epidemiology.json");
      const json = await resp.json();
      state.rawCases = json.cases || [];
    } catch (e) {
      console.warn("Không tải được data_epidemiology.json qua fetch:", e);
      state.rawCases = [];
    }
  }

  // 2. Dữ liệu cơ sở y tế
  if (window.DANANG_FACILITIES) {
    state.facilities = window.DANANG_FACILITIES;
  } else {
    try {
      const resp = await fetch("danang_facilities.json");
      state.facilities = await resp.json();
    } catch (e) {
      state.facilities = [];
    }
  }

  // 3. Dữ liệu ranh giới quận huyện Đà Nẵng
  if (window.DANANG_DISTRICTS) {
    state.districtsGeo = window.DANANG_DISTRICTS;
  }

  // Chuẩn bị danh sách tháng
  const monthSet = new Set();
  state.rawCases.forEach(c => {
    if (c.dt && c.dt.length >= 7) {
      const m = c.dt.substring(0, 7);
      if (m.startsWith("2025") || m.startsWith("2026")) {
        monthSet.add(m);
      }
    }
  });
  state.allMonths = Array.from(monthSet).sort();

  // Populate danh sách xã/phường vào dropdown
  populateWardDropdown();
  
  // Populate time slider range
  initTimeSliderRange();

  console.log(`Đã nạp thành công ${state.rawCases.length} ca bệnh và ${state.facilities.length} cơ sở y tế.`);
}

// ============================================================================
// KHỞI TẠO BẢN ĐỒ LEAFLET
// ============================================================================
function initMap() {
  // Tọa độ trung tâm Đà Nẵng
  const DANANG_CENTER = [16.0544, 108.2022];
  
  map = L.map("map", {
    center: DANANG_CENTER,
    zoom: 12,
    minZoom: 9,
    maxZoom: 18,
    zoomControl: false
  });

  // Zoom control đặt ở góc dưới bên phải
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Thước tỉ lệ (Scale)
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  // CÁC LỚP BẢN ĐỒ NỀN (BASE MAPS HOÀN TOÀN MIỄN PHÍ - KHÔNG CẦN API KEY)
  baseLayers = {
    google_street: L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }),
    google_hybrid: L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }),
    dark: L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c", "d"],
      attribution: '&copy; CartoDB & OpenStreetMap',
      maxZoom: 20
    }),
    osm_hot: L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c"],
      attribution: '&copy; OpenStreetMap & HOT contributors',
      maxZoom: 19
    }),
    light: L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c", "d"],
      attribution: '&copy; CartoDB & OpenStreetMap',
      maxZoom: 20
    }),
    esri_sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; Esri & Earthstar Geographics',
      maxZoom: 18
    })
  };

  // Mặc định sử dụng bản đồ Google Maps Đường phố tiếng Việt chi tiết (Free, No API key)
  baseLayers.google_street.addTo(map);
  baseLayers.google_street.bringToBack();

  // KHỞI TẠO CÁC LAYER GROUP
  layerGroups.districts = L.layerGroup().addTo(map);       // Layer 1
  layerGroups.choropleth = L.layerGroup();                 // Layer 5
  layerGroups.bufferZone = L.layerGroup().addTo(map);      // Layer 3 (Vùng đệm 200m)
  
  // Layer 2: MarkerCluster cho điểm ca bệnh
  layerGroups.caseMarkers = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 45,
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      let cClass = 'marker-cluster-small';
      if (count > 100) cClass = 'marker-cluster-large';
      else if (count > 20) cClass = 'marker-cluster-medium';
      
      return new L.DivIcon({
        html: `<div><span>${count}</span></div>`,
        className: 'marker-cluster ' + cClass,
        iconSize: new L.Point(40, 40)
      });
    }
  }).addTo(map);

  layerGroups.heatmap = L.layerGroup().addTo(map);         // Layer 4
  layerGroups.facilities = L.layerGroup().addTo(map);      // Layer 7
  layerGroups.simulation = L.layerGroup().addTo(map);      // Lớp giả lập

  // Render các lớp tĩnh ban đầu
  renderDistrictsLayer();
  renderFacilitiesLayer();

  // Sự kiện click bản đồ phục vụ Chế độ Giả lập (Simulation Mode)
  map.on("click", onMapClickSimulation);
}

// ============================================================================
// LAYER 1: RANH GIỚI HÀNH CHÍNH QUẬN/HUYỆN (GeoJSON)
// ============================================================================
function renderDistrictsLayer() {
  layerGroups.districts.clearLayers();
  if (!state.districtsGeo) return;

  L.geoJSON(state.districtsGeo, {
    style: {
      color: "#06b6d4",
      weight: 1.5,
      opacity: 0.8,
      dashArray: "4, 4",
      fillColor: "#0891b2",
      fillOpacity: 0.04
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindTooltip(`<b>${p.name}</b><br>Dân số: ${p.population ? p.population.toLocaleString('vi-VN') : '---'}`, {
        sticky: true,
        direction: "top",
        className: "district-tooltip"
      });
    }
  }).addTo(layerGroups.districts);
}

// ============================================================================
// LAYER 7: MẠNG LƯỚI CƠ SỞ Y TẾ & NGUỒN LỰC CDC
// ============================================================================
function renderFacilitiesLayer() {
  layerGroups.facilities.clearLayers();
  if (!state.facilities || !state.facilities.length) return;

  state.facilities.forEach(fac => {
    let iconColor = "#3b82f6";
    let iconChar = "H";
    let badgeClass = "badge-hospital";

    if (fac.type === "CDC") {
      iconColor = "#ef4444";
      iconChar = "CDC";
      badgeClass = "badge-cdc";
    } else if (fac.type === "TTYT") {
      iconColor = "#10b981";
      iconChar = "TT";
      badgeClass = "badge-ttyt";
    }

    const customIcon = L.divIcon({
      className: "facility-marker-icon",
      html: `
        <div style="
          background: ${iconColor};
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11px;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px ${iconColor};
        ">${iconChar}</div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([fac.lat, fac.lng], { icon: customIcon });
    
    const popupContent = `
      <div class="case-popup">
        <div class="case-popup-header">
          <span class="case-popup-title">${fac.name}</span>
          <span class="badge-disease ${badgeClass}" style="background:${iconColor}22; color:${iconColor}; border:1px solid ${iconColor}66;">${fac.level}</span>
        </div>
        <div class="case-popup-body">
          <div class="case-popup-row">
            <span class="case-popup-label">Địa chỉ:</span>
            <span class="case-popup-val" style="text-align:right; max-width:160px;">${fac.address}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Đường dây nóng:</span>
            <span class="case-popup-val" style="color:#38bdf8;">${fac.hotline}</span>
          </div>
          ${fac.beds ? `
          <div class="case-popup-row">
            <span class="case-popup-label">Quy mô giường bệnh:</span>
            <span class="case-popup-val">${fac.beds} giường</span>
          </div>` : ''}
          <div style="margin-top:0.35rem; font-size:0.7rem; color:#94a3b8; font-style:italic;">
            <i class="fa-solid fa-circle-info"></i> ${fac.role}
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    layerGroups.facilities.addLayer(marker);
  });
}

// ============================================================================
// LAYER 2, 3, 4: ĐIỂM CA BỆNH, VÙNG ĐỆM 200M SXH & HEATMAP
// ============================================================================
function updateEpidemiologyLayers() {
  // 1. Xóa các lớp hiện tại
  if (layerGroups.caseMarkers) layerGroups.caseMarkers.clearLayers();
  if (layerGroups.bufferZone) layerGroups.bufferZone.clearLayers();
  if (layerGroups.heatmap) layerGroups.heatmap.clearLayers();

  // BẢO MẬT TUYỆT ĐỐI: CHỈ KHI ĐÃ ĐĂNG NHẬP MỚI VẼ CÁC ĐIỂM CA BỆNH TRÊN BẢN ĐỒ
  const isAuth = window.authService && window.authService.isAuthenticated();
  if (!isAuth) {
    return; // Chế độ khách: Tuyệt đối không vẽ điểm, không vẽ buffer, không vẽ heatmap
  }

  const cases = state.filteredCases;
  const heatPoints = [];
  const sxhCases = [];

  // Tạo các circle marker
  cases.forEach(c => {
    const color = DISEASE_COLORS[c.grp] || DISEASE_COLORS.KHAC;
    
    // Thu thập cho Heatmap
    heatPoints.push([c.lat, c.lng, 0.6]);

    // Thu thập riêng cho ca SXH để sinh vùng đệm 200m
    if (c.grp === "SXH") {
      sxhCases.push(c);
    }

    // Điểm ca bệnh (Layer 2)
    const marker = L.circleMarker([c.lat, c.lng], {
      radius: 6,
      fillColor: color,
      color: "#ffffff",
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.85
    });

    // Popup thông tin ca bệnh (Đã đăng nhập - hiển thị đầy đủ thông tin giám sát)
    const popupContent = `
      <div class="case-popup">
        <div class="case-popup-header">
          <span class="case-popup-title">Ca bệnh #${c.id}</span>
          <span class="badge-disease" style="background:${color}22; color:${color}; border:1px solid ${color}66;">
            ${DISEASE_LABELS[c.grp] || c.d_name}
          </span>
        </div>
        <div class="case-popup-body">
          <div class="case-popup-row">
            <span class="case-popup-label">Chẩn đoán:</span>
            <span class="case-popup-val">${c.d_name}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Phân loại:</span>
            <span class="case-popup-val">${c.type}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Tình trạng:</span>
            <span class="case-popup-val">${c.st}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Ngày khởi phát:</span>
            <span class="case-popup-val">${c.dt || "---"}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Địa bàn:</span>
            <span class="case-popup-val" style="font-weight:600; color:#38bdf8;">${c.w}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Đơn vị tiếp nhận:</span>
            <span class="case-popup-val" style="text-align:right; max-width:140px;">${c.fac || "CDC Đà Nẵng"}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Tọa độ GIS:</span>
            <span class="case-popup-val">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} ${c.rc ? '🎯' : '📍'}</span>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    layerGroups.caseMarkers.addLayer(marker);
  });

  // LAYER 3: TỰ ĐỘNG SINH VÙNG ĐỆM 200M VÀ THUẬT TOÁN PHÁT HIỆN Ổ DỊCH
  renderBufferZonesAndOutbreaks(sxhCases);

  // LAYER 4: HEATMAP DENSITY LAYER
  if (heatPoints.length > 0 && typeof L.heatLayer === "function") {
    try {
      const mapContainer = map ? map.getContainer() : null;
      if (mapContainer && mapContainer.offsetWidth > 0 && mapContainer.offsetHeight > 0) {
        const heat = L.heatLayer(heatPoints, {
          radius: 20,
          blur: 15,
          maxZoom: 15,
          gradient: {
            0.2: '#06b6d4',
            0.4: '#10b981',
            0.6: '#eab308',
            0.8: '#f97316',
            1.0: '#ef4444'
          }
        });
        layerGroups.heatmap.addLayer(heat);
      }
    } catch (err) {
      console.warn("Lỗi an toàn khi nạp Heatmap layer:", err);
    }
  }
}

// ============================================================================
// THUẬT TOÁN PHÁT HIỆN Ổ DỊCH GIAO CẮT VÙNG ĐỆM 200M (SPATIAL OVERLAP ALGORITHM)
// ============================================================================
function renderBufferZonesAndOutbreaks(sxhList) {
  layerGroups.bufferZone.clearLayers();
  if (!sxhList || !sxhList.length) {
    document.getElementById("kpi-alert").innerText = "0";
    return;
  }

  // Giới hạn tính toán trên mẫu hiển thị để đạt 60fps mượt mà
  const maxBuffersToRender = Math.min(sxhList.length, 500);
  const sampleSXH = sxhList.slice(0, maxBuffersToRender);

  // Đánh dấu các ca bệnh có giao nhau trong bán kính 400m (vòng 200m giao nhau)
  const isOverlapping = new Array(sampleSXH.length).fill(false);
  let outbreakClusterCount = 0;

  for (let i = 0; i < sampleSXH.length; i++) {
    for (let j = i + 1; j < sampleSXH.length; j++) {
      const distMeters = calculateDistanceMeters(
        sampleSXH[i].lat, sampleSXH[i].lng,
        sampleSXH[j].lat, sampleSXH[j].lng
      );
      
      // Nếu 2 ca SXH cách nhau <= 400m (tức vùng đệm 200m giao nhau)
      if (distMeters <= 400) {
        isOverlapping[i] = true;
        isOverlapping[j] = true;
      }
    }
  }

  // Đếm số điểm nằm trong vùng giao nhau
  const overlapTotal = isOverlapping.filter(Boolean).length;
  outbreakClusterCount = Math.ceil(overlapTotal / 2);
  document.getElementById("kpi-alert").innerText = outbreakClusterCount.toLocaleString('vi-VN');

  // Vẽ các vòng đệm 200m
  sampleSXH.forEach((c, idx) => {
    const inOutbreak = isOverlapping[idx];
    
    // Nếu giao nhau: Viền đỏ báo động, nếu đứng 1 mình: Vòng cam 200m thông thường
    const strokeColor = inOutbreak ? "#ef4444" : "#f97316";
    const fillColor = inOutbreak ? "#ef4444" : "#f97316";
    const fillOpacity = inOutbreak ? 0.25 : 0.12;

    const bufferCircle = L.circle([c.lat, c.lng], {
      radius: 200, // 200 mét theo quy chuẩn dập dịch SXH Bộ Y tế
      color: strokeColor,
      dashArray: inOutbreak ? "6, 4" : "3, 3",
      weight: inOutbreak ? 2.2 : 1.2,
      fillColor: fillColor,
      fillOpacity: fillOpacity
    });

    const tooltipText = inOutbreak 
      ? `⚠️ <b>CẢNH BÁO Ổ DỊCH SXH GIAO THOA</b><br>Vùng đệm 200m ca #${c.id}<br>Địa bàn: ${c.w}`
      : `Vùng đệm xử lý dịch 200m<br>Ca SXH #${c.id} (${c.w})`;

    bufferCircle.bindTooltip(tooltipText, { sticky: true });
    layerGroups.bufferZone.addLayer(bufferCircle);
  });
}

// Công thức tính khoảng cách Haversine giữa 2 tọa độ (mét)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Bán kính trái đất tính bằng mét
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ============================================================================
// CHẾ ĐỘ GIẢ LẬP: CLICK THÊM CA BỆNH VÀ KIỂM TRA Ổ DỊCH (SIMULATION MODE)
// ============================================================================
function toggleSimulationMode() {
  // Yêu cầu đăng nhập tài khoản y tế mới được dùng tính năng Giả lập ca bệnh
  if (!window.authService || !window.authService.isAuthenticated()) {
    alert("Tính năng Giả lập ca bệnh yêu cầu đăng nhập tài khoản y tế để xác thực danh tính. Vui lòng đăng nhập!");
    if (typeof openLoginModal === "function") openLoginModal();
    return;
  }

  state.isSimulating = !state.isSimulating;
  const btn = document.getElementById("btn-toggle-sim");
  const banner = document.getElementById("sim-banner");

  if (state.isSimulating) {
    btn.classList.add("active");
    banner.classList.add("active");
    banner.classList.remove("danger");
    banner.innerHTML = `
      <i class="fa-solid fa-crosshairs fa-spin" style="color:var(--accent-orange);"></i>
      <span><b>CHẾ ĐỘ GIẢ LẬP ĐANG BẬT:</b> Hãy click một điểm bất kỳ trên bản đồ để thả ca bệnh mới và kiểm tra vùng đệm 200m!</span>
    `;
    map.getContainer().style.cursor = "crosshair";
  } else {
    btn.classList.remove("active");
    banner.classList.remove("active");
    map.getContainer().style.cursor = "";
  }
}

function onMapClickSimulation(e) {
  if (!state.isSimulating) return;

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  // Mở modal tạo ca bệnh giả lập
  document.getElementById("sim-lat").value = lat.toFixed(6);
  document.getElementById("sim-lng").value = lng.toFixed(6);
  document.getElementById("modal-sim").classList.add("active");
}

function confirmCreateSimCase() {
  const disease = document.getElementById("sim-disease").value;
  const lat = parseFloat(document.getElementById("sim-lat").value);
  const lng = parseFloat(document.getElementById("sim-lng").value);
  const dateStr = document.getElementById("sim-date").value || new Date().toISOString().substring(0, 10);

  const simId = 999000 + state.simCases.length + 1;
  const newCase = {
    id: simId,
    d_name: DISEASE_LABELS[disease] || "Sốt xuất huyết giả lập",
    grp: disease,
    type: "Giả lập thực địa",
    st: "Theo dõi phản ứng nhanh",
    w: "Vị trí giả lập Đà Nẵng",
    dt: dateStr,
    lat: lat,
    lng: lng,
    gen: "Nam",
    yob: "1995",
    fac: "Đội phản ứng nhanh CDC",
    rc: 1,
    isSim: true
  };

  state.simCases.push(newCase);
  state.rawCases.unshift(newCase);

  // Đóng modal
  document.getElementById("modal-sim").classList.remove("active");

  // Vẽ marker giả lập với vòng sáng đặc biệt
  const color = DISEASE_COLORS[disease] || "#f97316";
  const simMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: "sim-marker-pulse",
      html: `
        <div style="
          width: 22px;
          height: 22px;
          background: ${color};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 15px ${color};
          animation: pulse-dot 1.2s infinite;
        "></div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    })
  }).addTo(layerGroups.simulation);

  simMarker.bindPopup(`
    <div class="case-popup">
      <div class="case-popup-header">
        <span class="case-popup-title">CA BỆNH GIẢ LẬP #${simId}</span>
        <span class="badge-disease badge-sxh">GIẢ LẬP</span>
      </div>
      <div class="case-popup-body">
        <div><b>Bệnh:</b> ${newCase.d_name}</div>
        <div><b>Ngày phát hiện:</b> ${newCase.dt}</div>
        <div><b>Tọa độ:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      </div>
    </div>
  `).openPopup();

  // Kiểm tra tương tác vùng đệm 200m nếu là SXH
  if (disease === "SXH") {
    // Vẽ vùng đệm 200m cho ca này
    const buffer = L.circle([lat, lng], {
      radius: 200,
      color: "#f97316",
      dashArray: "5, 5",
      fillColor: "#f97316",
      fillOpacity: 0.2
    }).addTo(layerGroups.simulation);

    // Quét các ca SXH hiện có trong bán kính 400m
    let hasNearby = false;
    let nearbyCase = null;
    let minDistance = 99999;

    state.rawCases.forEach(c => {
      if (c.id !== simId && c.grp === "SXH") {
        const d = calculateDistanceMeters(lat, lng, c.lat, c.lng);
        if (d <= 400 && d < minDistance) {
          hasNearby = true;
          minDistance = d;
          nearbyCase = c;
        }
      }
    });

    const banner = document.getElementById("sim-banner");
    if (hasNearby && nearbyCase) {
      // Báo động đỏ
      buffer.setStyle({ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.35, weight: 3 });
      
      // Vẽ đường kết nối nguy cơ
      L.polyline([[lat, lng], [nearbyCase.lat, nearbyCase.lng]], {
        color: "#ef4444",
        dashArray: "5, 10",
        weight: 2.5
      }).addTo(layerGroups.simulation);

      banner.classList.add("danger");
      banner.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation fa-beat" style="color:#ef4444; font-size:1.2rem;"></i>
        <span><b>BÁO ĐỘNG ĐỎ Ổ DỊCH:</b> Ca giả lập #${simId} giao cắt vùng đệm 200m với ca bệnh #${nearbyCase.id} (${minDistance.toFixed(0)}m)! <b>Kích hoạt quy trình dập dịch khẩn cấp!</b></span>
      `;
    } else {
      banner.classList.remove("danger");
      banner.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color:#10b981;"></i>
        <span>Đã thêm ca bệnh giả lập #${simId}. Vùng đệm 200m an toàn (chưa giao cắt với ca SXH nào khác trong bán kính 400m).</span>
      `;
    }
  }

  // Tái áp dụng bộ lọc để đồng bộ KPI
  applyFilters();
}

// ============================================================================
// BỘ LỌC ĐA TIÊU CHÍ (ADVANCED FILTERING)
// ============================================================================
function applyFilters() {
  const disease = state.activeDisease;
  const diagType = state.activeDiagType;
  const ward = state.activeWard;
  const status = state.activeStatus;
  const month = state.activeMonth;

  // PHÂN QUYỀN ĐỊA BÀN THEO TÀI KHOẢN (RBAC SCOPING)
  const userScopeWard = window.authService ? window.authService.getUserScopeWard() : null;

  state.filteredCases = state.rawCases.filter(c => {
    // 0. Phân quyền Trạm Y tế: Nếu là Trạm Y tế, CHỈ XEM ca thuộc địa bàn mình quản lý
    if (userScopeWard && userScopeWard !== "ALL") {
      if (c.w !== userScopeWard) return false;
    }

    // 1. Lọc theo bệnh
    if (disease !== "ALL" && c.grp !== disease) return false;
    
    // 2. Lọc theo phân loại chẩn đoán
    if (diagType !== "ALL") {
      if (diagType === "CONFIRMED" && !c.type.includes("Xác định")) return false;
      if (diagType === "SUSPECT" && !c.type.includes("Nghi ngờ")) return false;
    }

    // 3. Lọc theo xã/phường (Đối với Admin hoặc Khách)
    if (userScopeWard === "ALL" || userScopeWard === null) {
      if (ward !== "ALL" && c.w !== ward) return false;
    }

    // 4. Lọc theo tình trạng
    if (status !== "ALL") {
      if (status === "INPATIENT" && !c.st.includes("nội trú")) return false;
      if (status === "OUTPATIENT" && !c.st.includes("ngoại trú")) return false;
      if (status === "DISCHARGED" && !c.st.includes("Ra viện")) return false;
      if (status === "DEATH" && !c.st.includes("Tử vong")) return false;
    }

    // 5. Lọc theo tháng (Time slider)
    if (month !== "ALL") {
      if (!c.dt || !c.dt.startsWith(month)) return false;
    }

    return true;
  });

  // 1. Cập nhật thẻ số liệu KPI
  updateKPICards();

  // 2. Cập nhật biểu đồ phân tích Sidebar
  updateCharts();

  // 3. Điều phối hiển thị View Mode (Guest Dashboard vs Bản đồ GIS)
  updateViewMode();
}

// ============================================================================
// CẬP NHẬT KPI SUMMARY CARDS
// ============================================================================
function updateKPICards() {
  const cases = state.filteredCases;
  const total = cases.length;

  let sxh = 0;
  let tcm = 0;
  let cum = 0;

  cases.forEach(c => {
    if (c.grp === "SXH") sxh++;
    else if (c.grp === "TCM") tcm++;
    else if (c.grp === "CUM") cum++;
  });

  const isAuth = window.authService && window.authService.isAuthenticated();

  const elTotal = document.getElementById("kpi-total");
  const elSxh = document.getElementById("kpi-sxh");
  const elTcm = document.getElementById("kpi-tcm");
  const elSxhSub = document.getElementById("kpi-sxh-sub");
  const elAlert = document.getElementById("kpi-alert");

  if (elTotal) elTotal.innerText = total.toLocaleString('vi-VN');
  if (elSxh) elSxh.innerText = sxh.toLocaleString('vi-VN');
  if (elTcm) elTcm.innerText = tcm.toLocaleString('vi-VN');
  
  if (isAuth) {
    if (elSxhSub) elSxhSub.innerText = `${sxh.toLocaleString('vi-VN')} vùng đệm 200m`;
  } else {
    if (elSxhSub) elSxhSub.innerText = `Đăng nhập xem vùng đệm`;
    if (elAlert) elAlert.innerHTML = `<span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-solid fa-lock"></i> Cần đăng nhập</span>`;
  }
}

// ============================================================================
// BIỂU ĐỒ CHART.JS
// ============================================================================
function initCharts() {
  // Chart 1: Cơ cấu bệnh (Doughnut)
  const ctxDisease = document.getElementById("chart-disease");
  if (ctxDisease) {
    state.charts.disease = new Chart(ctxDisease, {
      type: "doughnut",
      data: {
        labels: ["SXH", "TCM", "Cúm", "Lao", "Sởi", "Khác"],
        datasets: [{
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            DISEASE_COLORS.SXH,
            DISEASE_COLORS.TCM,
            DISEASE_COLORS.CUM,
            DISEASE_COLORS.LAO,
            DISEASE_COLORS.SOI,
            DISEASE_COLORS.KHAC
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#94a3b8", font: { size: 10 }, boxWidth: 10 }
          }
        },
        cutout: "65%"
      }
    });
  }

  // Chart 2: Diễn tiến theo tháng (Line/Bar)
  const ctxTrend = document.getElementById("chart-trend");
  if (ctxTrend) {
    state.charts.trend = new Chart(ctxTrend, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Số ca mắc",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: "#64748b", font: { size: 9 }, maxRotation: 45 },
            grid: { display: false }
          },
          y: {
            ticks: { color: "#64748b", font: { size: 9 } },
            grid: { color: "#1e293b" }
          }
        }
      }
    });
  }
}

function updateCharts() {
  const cases = state.filteredCases;

  // 1. Cơ cấu bệnh
  if (state.charts.disease) {
    const counts = { SXH: 0, TCM: 0, CUM: 0, LAO: 0, SOI: 0, KHAC: 0 };
    cases.forEach(c => {
      if (counts[c.grp] !== undefined) counts[c.grp]++;
      else counts.KHAC++;
    });

    state.charts.disease.data.datasets[0].data = [
      counts.SXH, counts.TCM, counts.CUM, counts.LAO, counts.SOI, counts.KHAC
    ];
    state.charts.disease.update("none");
  }

  // 2. Diễn tiến theo tháng
  if (state.charts.trend) {
    const monthMap = {};
    state.allMonths.forEach(m => monthMap[m] = 0);

    cases.forEach(c => {
      if (c.dt && c.dt.length >= 7) {
        const m = c.dt.substring(0, 7);
        if (monthMap[m] !== undefined) monthMap[m]++;
      }
    });

    state.charts.trend.data.labels = state.allMonths.map(m => m.substring(5) + "/" + m.substring(2, 4));
    state.charts.trend.data.datasets[0].data = state.allMonths.map(m => monthMap[m]);
    state.charts.trend.update("none");
  }
}

// ============================================================================
// BIỂU ĐỒ & BÁO CÁO DÀNH CHO GIAO DIỆN KHÁCH (GUEST OVERVIEW DASHBOARD)
// ============================================================================
function initGuestCharts() {
  // Chart 1: Diễn tiến theo tháng (Combo Bar + Line Chart)
  const ctxGuestTrend = document.getElementById("guest-chart-trend");
  if (ctxGuestTrend) {
    state.guestCharts.trend = new Chart(ctxGuestTrend, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            type: "bar",
            label: "Sốt xuất huyết Dengue",
            data: [],
            backgroundColor: "rgba(249, 115, 22, 0.8)",
            borderColor: "#f97316",
            borderWidth: 1,
            borderRadius: 4,
            order: 2
          },
          {
            type: "bar",
            label: "Bệnh truyền nhiễm khác",
            data: [],
            backgroundColor: "rgba(6, 182, 212, 0.65)",
            borderColor: "#06b6d4",
            borderWidth: 1,
            borderRadius: 4,
            order: 3
          },
          {
            type: "line",
            label: "Tổng số ca mắc",
            data: [],
            borderColor: "#facc15",
            backgroundColor: "rgba(250, 204, 21, 0.15)",
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#facc15",
            tension: 0.3,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // Đã có custom legend pills ở trên
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString('vi-VN')} ca`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 45 },
            grid: { display: false }
          },
          y: {
            stacked: false,
            ticks: { color: "#94a3b8", font: { size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.35)" }
          }
        }
      }
    });
  }

  // Chart 2: Cơ cấu bệnh tật (Doughnut Chart)
  const ctxGuestDisease = document.getElementById("guest-chart-disease");
  if (ctxGuestDisease) {
    state.guestCharts.disease = new Chart(ctxGuestDisease, {
      type: "doughnut",
      data: {
        labels: ["Sốt xuất huyết", "Tay chân miệng", "Cúm mùa", "Bệnh Lao", "Sởi", "Bệnh khác"],
        datasets: [{
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            "#f97316", // SXH: Cam
            "#facc15", // TCM: Vàng chanh
            "#06b6d4", // Cúm: Cyan
            "#a855f7", // Lao: Tím
            "#ef4444", // Sởi: Đỏ
            "#64748b"  // Khác: Xám
          ],
          borderColor: "#0f172a",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd5e1", boxWidth: 12, padding: 8, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val.toLocaleString('vi-VN')} ca (${pct}%)`;
              }
            }
          }
        },
        cutout: "62%"
      }
    });
  }

  // Chart 3: So sánh ca bệnh 7 Quận/Huyện (Horizontal Stacked Bar Chart)
  const ctxGuestDistricts = document.getElementById("guest-chart-districts");
  if (ctxGuestDistricts) {
    state.guestCharts.districts = new Chart(ctxGuestDistricts, {
      type: "bar",
      data: {
        labels: ["Liên Chiểu", "Thanh Khê", "Cẩm Lệ", "Sơn Trà", "Ngũ Hành Sơn", "Hải Châu", "Hòa Vang"],
        datasets: [
          {
            label: "Sốt xuất huyết Dengue",
            data: [],
            backgroundColor: "rgba(249, 115, 22, 0.85)",
            borderRadius: 3
          },
          {
            label: "Tay chân miệng",
            data: [],
            backgroundColor: "rgba(250, 204, 21, 0.85)",
            borderRadius: 3
          },
          {
            label: "Cúm mùa",
            data: [],
            backgroundColor: "rgba(6, 182, 212, 0.85)",
            borderRadius: 3
          },
          {
            label: "Bệnh khác",
            data: [],
            backgroundColor: "rgba(168, 85, 247, 0.85)",
            borderRadius: 3
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 11 } }
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.parsed.x.toLocaleString('vi-VN')} ca`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#94a3b8", font: { size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.35)" }
          },
          y: {
            stacked: true,
            ticks: { color: "#f8fafc", font: { size: 11, weight: "600" } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

function updateGuestDashboard() {
  const cases = state.filteredCases || state.rawCases;
  const total = cases.length;

  let sxh = 0;
  let tcm = 0;
  let cum = 0;
  let lao = 0;
  let soi = 0;
  let other = 0;

  let stOutpatient = 0;
  let stInpatient = 0;
  let stDischarged = 0;

  cases.forEach(c => {
    // Phân loại nhóm bệnh
    if (c.grp === "SXH") sxh++;
    else if (c.grp === "TCM") tcm++;
    else if (c.grp === "CUM") cum++;
    else if (c.grp === "LAO") lao++;
    else if (c.grp === "SOI") soi++;
    else other++;

    // Tình trạng điều trị
    const st = c.st || "";
    if (st.includes("ngoại trú")) stOutpatient++;
    else if (st.includes("nội trú")) stInpatient++;
    else if (st.includes("Ra viện") || st.includes("khỏi")) stDischarged++;
    else stOutpatient++;
  });

  // Cập nhật số liệu các thẻ KPI Guest
  const elTotal = document.getElementById("guest-kpi-total");
  const elSxh = document.getElementById("guest-kpi-sxh");
  const elTcm = document.getElementById("guest-kpi-tcm");
  const elCum = document.getElementById("guest-kpi-cum");
  const elOut = document.getElementById("guest-st-out");
  const elIn = document.getElementById("guest-st-in");
  const elDis = document.getElementById("guest-st-dis");

  if (elTotal) elTotal.innerText = total.toLocaleString("vi-VN");
  if (elSxh) elSxh.innerText = sxh.toLocaleString("vi-VN");
  if (elTcm) elTcm.innerText = tcm.toLocaleString("vi-VN");
  if (elCum) elCum.innerText = cum.toLocaleString("vi-VN");
  if (elOut) elOut.innerText = stOutpatient.toLocaleString("vi-VN");
  if (elIn) elIn.innerText = stInpatient.toLocaleString("vi-VN");
  if (elDis) elDis.innerText = stDischarged.toLocaleString("vi-VN");

  // 1. Cập nhật Biểu đồ Diễn biến theo tháng (Combo Bar + Line)
  if (state.guestCharts && state.guestCharts.trend) {
    const sxhMap = {};
    const otherMap = {};
    const totalMap = {};
    state.allMonths.forEach(m => {
      sxhMap[m] = 0;
      otherMap[m] = 0;
      totalMap[m] = 0;
    });

    cases.forEach(c => {
      if (c.dt && c.dt.length >= 7) {
        const m = c.dt.substring(0, 7);
        if (totalMap[m] !== undefined) {
          totalMap[m]++;
          if (c.grp === "SXH") sxhMap[m]++;
          else otherMap[m]++;
        }
      }
    });

    state.guestCharts.trend.data.labels = state.allMonths.map(m => m.substring(5) + "/" + m.substring(2, 4));
    state.guestCharts.trend.data.datasets[0].data = state.allMonths.map(m => sxhMap[m]);
    state.guestCharts.trend.data.datasets[1].data = state.allMonths.map(m => otherMap[m]);
    state.guestCharts.trend.data.datasets[2].data = state.allMonths.map(m => totalMap[m]);
    state.guestCharts.trend.update("none");
  }

  // 2. Cập nhật Biểu đồ Cơ cấu bệnh (Doughnut)
  if (state.guestCharts && state.guestCharts.disease) {
    state.guestCharts.disease.data.datasets[0].data = [sxh, tcm, cum, lao, soi, other];
    state.guestCharts.disease.update();
  }

  // 3. Cập nhật Biểu đồ So sánh 7 Quận/Huyện (Horizontal Stacked Bar)
  const dKeywords = [
    { name: "Liên Chiểu", kw: ["liên chiểu", "hòa khánh", "hòa minh", "hải vân", "hòa hiệp"] },
    { name: "Thanh Khê", kw: ["thanh khê", "an khê", "tam thuận", "xuân hà", "tân chính", "chính gián", "vĩnh trung", "thạc gián"] },
    { name: "Cẩm Lệ", kw: ["cẩm lệ", "hòa xuân", "khuê trung", "hòa thọ", "hòa phát", "hòa an"] },
    { name: "Sơn Trà", kw: ["sơn trà", "an hải", "phước mỹ", "nại hiên đông", "thọ quang", "mân thái"] },
    { name: "Ngũ Hành Sơn", kw: ["ngũ hành sơn", "hòa hải", "hòa quý", "khuê mỹ", "mỹ an"] },
    { name: "Hải Châu", kw: ["hải châu", "hòa cường", "thạch thang", "thuận phước", "thanh bình", "bình hiên", "bình thuận", "nam dương", "phước ninh"] },
    { name: "Hòa Vang", kw: ["hòa vang", "hòa tiến", "bà nà", "hòa châu", "hòa phước", "hòa khương", "hòa nhơn", "hòa phong", "hòa sơn", "hòa ninh", "hòa liên", "hòa bắc", "hòa phú"] }
  ];

  const dStats = dKeywords.map(d => ({ name: d.name, sxh: 0, tcm: 0, cum: 0, other: 0 }));

  cases.forEach(c => {
    const w = (c.w || "").toLowerCase();
    for (let i = 0; i < dKeywords.length; i++) {
      if (dKeywords[i].kw.some(k => w.includes(k))) {
        if (c.grp === "SXH") dStats[i].sxh++;
        else if (c.grp === "TCM") dStats[i].tcm++;
        else if (c.grp === "CUM") dStats[i].cum++;
        else dStats[i].other++;
        break;
      }
    }
  });

  if (state.guestCharts && state.guestCharts.districts) {
    state.guestCharts.districts.data.datasets[0].data = dStats.map(d => d.sxh);
    state.guestCharts.districts.data.datasets[1].data = dStats.map(d => d.tcm);
    state.guestCharts.districts.data.datasets[2].data = dStats.map(d => d.cum);
    state.guestCharts.districts.data.datasets[3].data = dStats.map(d => d.other);
    state.guestCharts.districts.update("none");
  }

  // 4. Cập nhật Bảng Thống kê Quận/Huyện của Đà Nẵng
  renderGuestDistrictTable(cases, total);
}

function renderGuestDistrictTable(cases, total) {
  const tbody = document.getElementById("guest-districts-table-body");
  if (!tbody) return;

  const districtKeywords = [
    { name: "Quận Hải Châu", kw: ["hải châu", "hòa cường", "thạch thang", "thuận phước", "thanh bình", "bình hiên", "bình thuận", "nam dương", "phước ninh"] },
    { name: "Quận Thanh Khê", kw: ["thanh khê", "an khê", "tam thuận", "xuân hà", "tân chính", "chính gián", "vĩnh trung", "thạc gián"] },
    { name: "Quận Sơn Trà", kw: ["sơn trà", "an hải", "phước mỹ", "nại hiên đông", "thọ quang", "mân thái"] },
    { name: "Quận Ngũ Hành Sơn", kw: ["ngũ hành sơn", "hòa hải", "hòa quý", "khuê mỹ", "mỹ an"] },
    { name: "Quận Liên Chiểu", kw: ["liên chiểu", "hòa khánh", "hòa minh", "hải vân", "hòa hiệp"] },
    { name: "Quận Cẩm Lệ", kw: ["cẩm lệ", "hòa xuân", "khuê trung", "hòa thọ", "hòa phát", "hòa an"] },
    { name: "Huyện Hòa Vang", kw: ["hòa vang", "hòa tiến", "bà nà", "hòa châu", "hòa phước", "hòa khương", "hòa nhơn", "hòa phong", "hòa sơn", "hòa ninh", "hòa liên", "hòa bắc", "hòa phú"] },
    { name: "Giáp ranh & Khác (Tiếp nhận tại ĐN)", kw: [] }
  ];

  const stats = districtKeywords.map(d => ({
    name: d.name,
    sxh: 0,
    tcm: 0,
    cum: 0,
    other: 0,
    total: 0
  }));

  cases.forEach(c => {
    const w = (c.w || "").toLowerCase();
    let matchedIndex = -1;
    for (let i = 0; i < districtKeywords.length - 1; i++) {
      if (districtKeywords[i].kw.some(k => w.includes(k))) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex === -1) {
      matchedIndex = districtKeywords.length - 1; // Khác
    }

    stats[matchedIndex].total++;
    if (c.grp === "SXH") stats[matchedIndex].sxh++;
    else if (c.grp === "TCM") stats[matchedIndex].tcm++;
    else if (c.grp === "CUM") stats[matchedIndex].cum++;
    else stats[matchedIndex].other++;
  });

  let html = "";
  stats.forEach(st => {
    const pct = total > 0 ? ((st.total / total) * 100).toFixed(1) : "0.0";
    let badgeClass = "badge-safe";
    let badgeText = "Kiểm soát tốt";

    if (st.sxh > 800 || st.total > 1500) {
      badgeClass = "badge-danger";
      badgeText = "Nguy cơ cao";
    } else if (st.sxh > 400 || st.total > 800) {
      badgeClass = "badge-warning";
      badgeText = "Theo dõi chặt";
    }

    html += `
      <tr>
        <td style="font-weight:600; color:#f8fafc;">
          <i class="fa-solid fa-location-dot" style="color:var(--accent-cyan); margin-right:6px;"></i>
          ${st.name}
        </td>
        <td style="text-align:right; color:#f97316; font-weight:600;">${st.sxh.toLocaleString('vi-VN')}</td>
        <td style="text-align:right; color:#eab308; font-weight:600;">${st.tcm.toLocaleString('vi-VN')}</td>
        <td style="text-align:right; color:#06b6d4;">${st.cum.toLocaleString('vi-VN')}</td>
        <td style="text-align:right; color:#a855f7;">${st.other.toLocaleString('vi-VN')}</td>
        <td style="text-align:right; font-weight:700; color:#ffffff;">${st.total.toLocaleString('vi-VN')}</td>
        <td style="text-align:center;">
          <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
            <div style="width:70px; height:6px; background:#1e293b; border-radius:3px; overflow:hidden;">
              <div style="width:${Math.min(parseFloat(pct) * 3, 100)}%; height:100%; background:var(--accent-cyan);"></div>
            </div>
            <span style="font-size:0.72rem; color:#94a3b8; min-width:32px;">${pct}%</span>
          </div>
        </td>
        <td style="text-align:center;">
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ============================================================================
// ĐIỀU PHỐI CHẾ ĐỘ HIỂN THỊ: GUEST DASHBOARD VS AUTHENTICATED GIS MAP
// ============================================================================
function updateViewMode() {
  const isAuth = window.authService && window.authService.isAuthenticated();
  const user = window.authService ? window.authService.getCurrentUser() : null;
  const guestView = document.getElementById("guest-view");
  const mapEl = document.getElementById("map");
  const layerControl = document.getElementById("gis-layer-control");
  const mapLegend = document.getElementById("gis-map-legend");
  const timeDock = document.getElementById("gis-time-dock");
  const simBanner = document.getElementById("sim-banner");
  const btnSim = document.getElementById("btn-toggle-sim");
  const btnUpload = document.getElementById("btn-open-upload");

  if (!isAuth) {
    // CHẾ ĐỘ KHÁCH: KHÔNG CÓ BẢN ĐỒ, KHÔNG CHO PHÉP ZOOM
    if (guestView) guestView.style.display = "block";
    if (mapEl) mapEl.style.display = "none";
    if (layerControl) layerControl.style.display = "none";
    if (mapLegend) mapLegend.style.display = "none";
    if (timeDock) timeDock.style.display = "none";
    if (simBanner) simBanner.style.display = "none";
    if (btnSim) btnSim.style.display = "none";
    if (btnUpload) btnUpload.style.display = "none";

    // XÓA TOÀN BỘ CÁC ĐIỂM / LỚP TRÊN BẢN ĐỒ ĐỂ TUYỆT ĐỐI BẢO MẬT
    if (layerGroups.caseMarkers) layerGroups.caseMarkers.clearLayers();
    if (layerGroups.bufferZone) layerGroups.bufferZone.clearLayers();
    if (layerGroups.heatmap) layerGroups.heatmap.clearLayers();

    // Cập nhật thông tin tổng quan ca bệnh Đà Nẵng
    updateGuestDashboard();
  } else {
    // CHẾ ĐỘ ĐÃ ĐĂNG NHẬP (ADMIN HOẶC TRẠM Y TẾ): MỞ KHÓA BẢN ĐỒ GIS
    if (guestView) guestView.style.display = "none";
    if (mapEl) mapEl.style.display = "block";
    if (layerControl) layerControl.style.display = "block";
    if (mapLegend) mapLegend.style.display = "block";
    if (timeDock) timeDock.style.display = "block";

    if (user && user.role === "ADMIN") {
      if (btnSim) btnSim.style.display = "flex";
      if (btnUpload) btnUpload.style.display = "flex";
    } else {
      if (btnSim) btnSim.style.display = "none";
      if (btnUpload) btnUpload.style.display = "none";
    }

    // Leaflet cần invalidateSize để hiển thị đúng khung hình khi từ display:none sang display:block
    if (map) {
      setTimeout(() => {
        try {
          map.invalidateSize();
          updateEpidemiologyLayers();
        } catch (err) {
          console.warn("Lỗi cập nhật lớp dịch tễ sau đăng nhập:", err);
        }
      }, 150);
    } else {
      try {
        updateEpidemiologyLayers();
      } catch (err) {
        console.warn("Lỗi cập nhật lớp dịch tễ:", err);
      }
    }
  }
}
window.updateViewMode = updateViewMode;

// ============================================================================
// TIME SLIDER SIMULATION (TUA TIẾN ĐỘ THỜI GIAN)
// ============================================================================
function initTimeSliderRange() {
  const slider = document.getElementById("time-slider");
  if (!slider || !state.allMonths.length) return;

  slider.min = 0;
  slider.max = state.allMonths.length;
  slider.value = state.allMonths.length; // Mặc định ở cuối (Tất cả)

  updateTimeSliderDisplay();
}

function updateTimeSliderDisplay() {
  const slider = document.getElementById("time-slider");
  const label = document.getElementById("time-slider-val");
  const val = parseInt(slider.value);

  if (val >= state.allMonths.length) {
    state.activeMonth = "ALL";
    label.innerText = "Toàn thời gian (2025 - 2026)";
  } else {
    state.activeMonth = state.allMonths[val];
    label.innerText = `Tháng ${state.activeMonth.substring(5)}/${state.activeMonth.substring(0, 4)}`;
  }
}

function togglePlayTime() {
  const btn = document.getElementById("btn-play-time");
  const slider = document.getElementById("time-slider");

  state.isPlayingTime = !state.isPlayingTime;

  if (state.isPlayingTime) {
    btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    // Bắt đầu từ đầu nếu đang ở cuối
    if (parseInt(slider.value) >= state.allMonths.length) {
      slider.value = 0;
    }

    state.playInterval = setInterval(() => {
      let cur = parseInt(slider.value);
      if (cur < state.allMonths.length - 1) {
        slider.value = cur + 1;
        updateTimeSliderDisplay();
        applyFilters();
      } else {
        // Hết vòng lặp
        togglePlayTime();
      }
    }, 1200);
  } else {
    btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    clearInterval(state.playInterval);
  }
}

// ============================================================================
// GIAO DIỆN & SỰ KIỆN TƯƠNG TÁC
// ============================================================================
function initUIEvents() {
  // Sidebar Toggle
  const toggleBtn = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      toggleBtn.innerHTML = sidebar.classList.contains("collapsed") 
        ? `<i class="fa-solid fa-chevron-right"></i>` 
        : `<i class="fa-solid fa-chevron-left"></i>`;
      setTimeout(() => map.invalidateSize(), 350);
    });
  }

  // Quick Disease Pills
  document.querySelectorAll(".disease-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".disease-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.activeDisease = pill.getAttribute("data-val");
      applyFilters();
    });
  });

  // Filter Dropdowns
  document.getElementById("filter-diag").addEventListener("change", (e) => {
    state.activeDiagType = e.target.value;
    applyFilters();
  });

  document.getElementById("filter-ward").addEventListener("change", (e) => {
    state.activeWard = e.target.value;
    applyFilters();
  });

  document.getElementById("filter-status").addEventListener("change", (e) => {
    state.activeStatus = e.target.value;
    applyFilters();
  });

  // Time Slider Input
  const slider = document.getElementById("time-slider");
  if (slider) {
    slider.addEventListener("input", () => {
      updateTimeSliderDisplay();
      applyFilters();
    });
  }

  // Play Time Button
  const playBtn = document.getElementById("btn-play-time");
  if (playBtn) {
    playBtn.addEventListener("click", togglePlayTime);
  }

  // Simulation Toggle Button
  const simBtn = document.getElementById("btn-toggle-sim");
  if (simBtn) {
    simBtn.addEventListener("click", toggleSimulationMode);
  }

  // Modal Simulation Confirm
  document.getElementById("btn-confirm-sim").addEventListener("click", confirmCreateSimCase);
  document.getElementById("btn-cancel-sim").addEventListener("click", () => {
    document.getElementById("modal-sim").classList.remove("active");
  });

  // Layer Switcher Checkboxes
  const layerToggles = {
    "chk-layer-districts": layerGroups.districts,
    "chk-layer-cases": layerGroups.caseMarkers,
    "chk-layer-buffer": layerGroups.bufferZone,
    "chk-layer-heat": layerGroups.heatmap,
    "chk-layer-facilities": layerGroups.facilities
  };

  Object.entries(layerToggles).forEach(([chkId, layer]) => {
    const el = document.getElementById(chkId);
    if (el) {
      el.addEventListener("change", (e) => {
        if (e.target.checked) map.addLayer(layer);
        else map.removeLayer(layer);
      });
    }
  });

  // Base Map Switcher
  document.getElementById("select-basemap").addEventListener("change", (e) => {
    const type = e.target.value;
    Object.values(baseLayers).forEach(l => map.removeLayer(l));
    if (baseLayers[type]) {
      baseLayers[type].addTo(map);
      baseLayers[type].bringToBack();
    }
  });

  // Upload Modal Open/Close (Chỉ Admin CDC mới được nạp Excel)
  const uploadBtn = document.getElementById("btn-open-upload");
  const uploadModal = document.getElementById("modal-upload");
  if (uploadBtn && uploadModal) {
    uploadBtn.addEventListener("click", () => {
      if (!window.authService || !window.authService.isAdmin()) {
        alert("Chỉ Quản trị viên (Admin CDC) mới có quyền nạp và cập nhật dữ liệu Excel dịch bệnh!");
        if (!window.authService || !window.authService.isAuthenticated()) {
          openLoginModal();
        }
        return;
      }
      uploadModal.classList.add("active");
    });
    document.getElementById("btn-close-upload").addEventListener("click", () => uploadModal.classList.remove("active"));
  }

  // Xử lý nạp file Excel trực tiếp qua SheetJS
  initExcelUpload();
}

function populateWardDropdown() {
  const select = document.getElementById("filter-ward");
  if (!select) return;

  const userScopeWard = window.authService ? window.authService.getUserScopeWard() : null;

  const wardCounts = {};
  state.rawCases.forEach(c => {
    if (c.w) wardCounts[c.w] = (wardCounts[c.w] || 0) + 1;
  });

  const sortedWards = Object.entries(wardCounts).sort((a, b) => b[1] - a[1]);

  // Nếu là Trạm Y tế, cố định và khóa dropdown ở địa bàn của trạm
  if (userScopeWard && userScopeWard !== "ALL") {
    select.disabled = true;
    const count = wardCounts[userScopeWard] || 0;
    select.innerHTML = `<option value="${userScopeWard}">📍 [Địa bàn trạm] ${userScopeWard} (${count.toLocaleString('vi-VN')} ca)</option>`;
    state.activeWard = userScopeWard;
    return;
  }

  // Admin hoặc Khách: Cho phép chọn tất cả
  select.disabled = false;
  select.innerHTML = '<option value="ALL">Tất cả Xã/Phường (Toàn thành phố)</option>';
  sortedWards.forEach(([w, count]) => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.innerText = `${w} (${count.toLocaleString('vi-VN')} ca)`;
    if (state.activeWard === w) opt.selected = true;
    select.appendChild(opt);
  });
}

// ============================================================================
// TÍNH NĂNG NẠP FILE EXCEL TRỰC TIẾP (SHEETJS IN-BROWSER PARSER)
// ============================================================================
function initExcelUpload() {
  const dropzone = document.getElementById("excel-dropzone");
  const fileInput = document.getElementById("excel-file-input");

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedExcel(e.target.files[0]);
    }
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedExcel(e.dataTransfer.files[0]);
    }
  });
}

function processUploadedExcel(file) {
  if (typeof XLSX === "undefined") {
    alert("Thư viện SheetJS chưa được tải.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      alert(`Đã đọc thành công ${jsonData.length} bản ghi từ file Excel mới! Hệ thống đang cập nhật bản đồ...`);
      document.getElementById("modal-upload").classList.remove("active");
    } catch (err) {
      alert("Lỗi khi đọc file Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================================
// XUẤT BÁO CÁO (PRINT / EXPORT REPORT)
// ============================================================================
function printReport() {
  window.print();
}

// ============================================================================
// ĐỒNG BỘ BẢN ĐỒ VỚI HỆ THỐNG PHÂN QUYỀN TRẠM Y TẾ
// ============================================================================

function flyToUserArea(user) {
  if (!map) return;
  if (!user || user.role === 'ADMIN') {
    map.flyTo([16.0544, 108.2022], 12, { duration: 1.2 });
    return;
  }

  // Nếu là Trạm Y tế: tìm tọa độ các ca bệnh của phường đó để tính tâm
  const wardCases = state.rawCases.filter(c => c.w === user.ward);
  if (wardCases.length > 0) {
    let sumLat = 0, sumLng = 0;
    const sample = wardCases.slice(0, 30);
    sample.forEach(c => {
      sumLat += c.lat;
      sumLng += c.lng;
    });
    const avgLat = sumLat / sample.length;
    const avgLng = sumLng / sample.length;
    map.flyTo([avgLat, avgLng], 14, { duration: 1.5 });
  } else {
    map.flyTo([16.0544, 108.2022], 13, { duration: 1.2 });
  }
}

// Lắng nghe sự kiện đăng nhập / đăng xuất để đồng bộ dữ liệu và bản đồ
window.addEventListener('auth:change', (e) => {
  const user = e.detail ? e.detail.user : null;
  populateWardDropdown();
  flyToUserArea(user);
  applyFilters();
});
