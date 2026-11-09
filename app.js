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
  
  // 1. Tải dữ liệu
  await loadData();
  
  // 2. Khởi tạo bản đồ Leaflet
  initMap();
  
  // 3. Khởi tạo UI tương tác & Sự kiện
  initUIEvents();
  
  // 4. Khởi tạo các biểu đồ Chart.js
  initCharts();
  
  // 5. Cập nhật hiển thị lần đầu
  applyFilters();
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
  layerGroups.caseMarkers.clearLayers();
  layerGroups.bufferZone.clearLayers();
  layerGroups.heatmap.clearLayers();

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

    // Popup thông tin ca bệnh
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
            <span class="case-popup-val">${c.w}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Đơn vị tiếp nhận:</span>
            <span class="case-popup-val" style="text-align:right; max-width:140px;">${c.fac || "CDC"}</span>
          </div>
          <div class="case-popup-row">
            <span class="case-popup-label">Tọa độ:</span>
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

  // Cập nhật thẻ số liệu KPI
  updateKPICards();

  // Cập nhật biểu đồ
  updateCharts();
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

  state.filteredCases = state.rawCases.filter(c => {
    // 1. Lọc theo bệnh
    if (disease !== "ALL" && c.grp !== disease) return false;
    
    // 2. Lọc theo phân loại chẩn đoán
    if (diagType !== "ALL") {
      if (diagType === "CONFIRMED" && !c.type.includes("Xác định")) return false;
      if (diagType === "SUSPECT" && !c.type.includes("Nghi ngờ")) return false;
    }

    // 3. Lọc theo xã/phường
    if (ward !== "ALL" && c.w !== ward) return false;

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

  // Render lại các lớp bản đồ tương ứng
  updateEpidemiologyLayers();
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

  document.getElementById("kpi-total").innerText = total.toLocaleString('vi-VN');
  document.getElementById("kpi-sxh").innerText = sxh.toLocaleString('vi-VN');
  document.getElementById("kpi-tcm").innerText = tcm.toLocaleString('vi-VN');
  
  // Vùng đệm 200m tương ứng số ca SXH
  document.getElementById("kpi-sxh-sub").innerText = `${sxh.toLocaleString('vi-VN')} vùng đệm 200m`;
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

  // Upload Modal Open/Close
  const uploadBtn = document.getElementById("btn-open-upload");
  const uploadModal = document.getElementById("modal-upload");
  if (uploadBtn && uploadModal) {
    uploadBtn.addEventListener("click", () => uploadModal.classList.add("active"));
    document.getElementById("btn-close-upload").addEventListener("click", () => uploadModal.classList.remove("active"));
  }

  // Xử lý nạp file Excel trực tiếp qua SheetJS
  initExcelUpload();
}

function populateWardDropdown() {
  const select = document.getElementById("filter-ward");
  if (!select) return;

  const wardCounts = {};
  state.rawCases.forEach(c => {
    if (c.w) wardCounts[c.w] = (wardCounts[c.w] || 0) + 1;
  });

  const sortedWards = Object.entries(wardCounts).sort((a, b) => b[1] - a[1]);
  
  select.innerHTML = '<option value="ALL">Tất cả Xã/Phường</option>';
  sortedWards.forEach(([w, count]) => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.innerText = `${w} (${count.toLocaleString('vi-VN')} ca)`;
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
