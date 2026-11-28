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
  },
  guestDistrictFilter: "all",
  guestRegionStats: []
};
window.state = state;

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
// QUẢN LÝ GIAO DIỆN CHẾ ĐỘ SÁNG / TỐI (THEME MANAGER)
// ============================================================================
function initTheme() {
  const saved = localStorage.getItem("CDC_THEME_MODE") || "dark";
  applyTheme(saved, false);
}
window.initTheme = initTheme;

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const nextTheme = current === "dark" ? "light" : "dark";
  applyTheme(nextTheme, true);
}
window.toggleTheme = toggleTheme;

function applyTheme(theme, save = true) {
  if (save) {
    try {
      localStorage.setItem("CDC_THEME_MODE", theme);
    } catch (e) {}
  }

  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    document.documentElement.classList.add("light-theme");
    if (document.body) document.body.classList.add("light-theme");
  } else {
    document.documentElement.classList.remove("light-theme");
    if (document.body) document.body.classList.remove("light-theme");
  }

  // Cập nhật biểu tượng và chữ hiển thị trên nút toggle
  const icon = document.getElementById("theme-toggle-icon");
  const text = document.getElementById("theme-toggle-text");
  const btn = document.getElementById("btn-toggle-theme");

  if (theme === "light") {
    if (icon) {
      icon.className = "fa-solid fa-moon";
      icon.style.color = "#3b82f6";
    }
    if (text) text.innerText = "Giao Diện Sáng";
    if (btn) btn.title = "Đang ở chế độ Sáng. Bấm để chuyển sang chế độ Tối";
  } else {
    if (icon) {
      icon.className = "fa-solid fa-sun";
      icon.style.color = "#fbbf24";
    }
    if (text) text.innerText = "Giao Diện Tối";
    if (btn) btn.title = "Đang ở chế độ Tối. Bấm để chuyển sang chế độ Sáng";
  }

  // Cập nhật màu sắc biểu đồ Chart.js
  updateChartsTheme(theme);

  // Cập nhật bản đồ Leaflet
  updateMapTheme(theme);
}
window.applyTheme = applyTheme;

function updateChartsTheme(theme) {
  const isLight = (theme === "light");
  const tickColor = isLight ? "#64748b" : "#94a3b8";
  const labelColor = isLight ? "#1e293b" : "#f8fafc";
  const legendColor = isLight ? "#334155" : "#cbd5e1";
  const gridColor = isLight ? "rgba(203, 213, 225, 0.6)" : "rgba(51, 65, 85, 0.35)";
  const doughnutBorder = isLight ? "#ffffff" : "#0f172a";

  // Guest Charts
  if (state.guestCharts) {
    if (state.guestCharts.trend) {
      const c = state.guestCharts.trend;
      if (c.options.scales && c.options.scales.x) {
        c.options.scales.x.ticks.color = tickColor;
      }
      if (c.options.scales && c.options.scales.y) {
        c.options.scales.y.ticks.color = tickColor;
        c.options.scales.y.grid.color = gridColor;
      }
      c.update("none");
    }

    if (state.guestCharts.disease) {
      const c = state.guestCharts.disease;
      if (c.data.datasets && c.data.datasets[0]) {
        c.data.datasets[0].borderColor = doughnutBorder;
      }
      if (c.options.plugins && c.options.plugins.legend) {
        c.options.plugins.legend.labels.color = legendColor;
      }
      c.update("none");
    }

    if (state.guestCharts.districts) {
      const c = state.guestCharts.districts;
      if (c.options.scales && c.options.scales.x) {
        c.options.scales.x.ticks.color = tickColor;
        c.options.scales.x.grid.color = gridColor;
      }
      if (c.options.scales && c.options.scales.y) {
        c.options.scales.y.ticks.color = labelColor;
      }
      if (c.options.plugins && c.options.plugins.legend) {
        c.options.plugins.legend.labels.color = legendColor;
      }
      c.update("none");
    }
  }

  // Sidebar Charts
  if (state.charts) {
    if (state.charts.disease) {
      const c = state.charts.disease;
      if (c.options.plugins && c.options.plugins.legend) {
        c.options.plugins.legend.labels.color = tickColor;
      }
      c.update("none");
    }
    if (state.charts.trend) {
      const c = state.charts.trend;
      if (c.options.scales && c.options.scales.x) c.options.scales.x.ticks.color = tickColor;
      if (c.options.scales && c.options.scales.y) {
        c.options.scales.y.ticks.color = tickColor;
        c.options.scales.y.grid.color = gridColor;
      }
      c.update("none");
    }
  }
}

function updateMapTheme(theme) {
  if (typeof map === "undefined" || !map || typeof baseLayers === "undefined" || !baseLayers) return;
  const isLight = (theme === "light");
  const layerSelect = document.getElementById("select-base-layer");
  if (layerSelect) {
    if (!isLight && layerSelect.value === "light") {
      layerSelect.value = "dark";
      layerSelect.dispatchEvent(new Event("change"));
    } else if (isLight && layerSelect.value === "dark") {
      layerSelect.value = "light";
      layerSelect.dispatchEvent(new Event("change"));
    }
  }
}

// ============================================================================
// KHỞI ĐỘNG ỨNG DỤNG
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Khởi động Hệ thống Bản đồ Dịch tễ học số CDC Đà Nẵng...");
  
  // Khởi tạo Chế độ Giao diện (Sáng / Tối)
  initTheme();
  
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
    updateChartsTheme(document.documentElement.getAttribute("data-theme") || "dark");
  } catch (err) {
    console.warn("Lỗi khởi tạo biểu đồ:", err);
  }

  try {
    // 5. Cập nhật hiển thị lần đầu
    applyFilters();
    
    // 6. Đồng bộ ngầm dữ liệu Google Sheet 2026 của CDC Đà Nẵng (nếu có mạng)
    if (window.cdcMacroService) {
      setTimeout(() => {
        window.cdcMacroService.syncLive(false).catch(e => console.warn("Background sync warning:", e));
      }, 1000);
    }
  } catch (err) {
    console.warn("Lỗi lọc dữ liệu ban đầu:", err);
  }
});

// ============================================================================
// HỆ THỐNG LƯU TRỮ DỮ LIỆU BỀN VỮNG INDEXEDDB (HỖ TRỢ DATASET LỚN > 5MB)
// ============================================================================
const IDB_CONFIG = {
  dbName: "CDCDanangDB",
  version: 1,
  storeName: "epidemiology_custom"
};

function openEpidemiologyDB() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = window.indexedDB.open(IDB_CONFIG.dbName, IDB_CONFIG.version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.storeName)) {
        db.createObjectStore(IDB_CONFIG.storeName, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => {
      console.warn("Lỗi mở IndexedDB:", e.target.error);
      resolve(null);
    };
  });
}

async function saveCustomCasesToIDB(cases, meta = {}) {
  try {
    const db = await openEpidemiologyDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction([IDB_CONFIG.storeName], "readwrite");
      const store = tx.objectStore(IDB_CONFIG.storeName);
      store.put({
        key: "custom_dataset",
        cases: cases,
        meta: {
          updatedAt: new Date().toISOString(),
          total: cases.length,
          source: meta.source || "excel",
          fileName: meta.fileName || "",
          sheetUrl: meta.sheetUrl || ""
        }
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn("Lỗi ghi IndexedDB:", e.target.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("Lỗi saveCustomCasesToIDB:", err);
    return false;
  }
}

async function loadCustomCasesFromIDB() {
  try {
    const db = await openEpidemiologyDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction([IDB_CONFIG.storeName], "readonly");
      const store = tx.objectStore(IDB_CONFIG.storeName);
      const req = store.get("custom_dataset");
      req.onsuccess = (e) => resolve(e.target.result || null);
      req.onerror = (e) => {
        console.warn("Lỗi đọc IndexedDB:", e.target.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("Lỗi loadCustomCasesFromIDB:", err);
    return null;
  }
}

async function clearCustomCasesFromIDB() {
  try {
    const db = await openEpidemiologyDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction([IDB_CONFIG.storeName], "readwrite");
      const store = tx.objectStore(IDB_CONFIG.storeName);
      store.delete("custom_dataset");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("Lỗi clearCustomCasesFromIDB:", err);
    return false;
  }
}

// ============================================================================
// TẢI DỮ LIỆU (Tự động thích ứng cả mở file:// và http://)
// ============================================================================
async function loadData() {
  // 1. Kiểm tra xem có file Excel tùy chỉnh / Google Sheet lưu trong IndexedDB không
  try {
    const idbResult = await loadCustomCasesFromIDB();
    if (idbResult && Array.isArray(idbResult.cases) && idbResult.cases.length > 0) {
      state.rawCases = idbResult.cases;
      state.isCustomExcelLoaded = true;
      state.customMeta = idbResult.meta || {};
      console.log(`Đã tải ${idbResult.cases.length} ca bệnh từ IndexedDB (${state.customMeta.source || 'tùy chỉnh'}).`);
    } else {
      // Fallback kiểm tra localStorage (nếu có bản cũ)
      const customDataStr = localStorage.getItem("CDC_CUSTOM_EPIDEMIOLOGY_DATA");
      if (customDataStr) {
        const parsed = JSON.parse(customDataStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.rawCases = parsed;
          state.isCustomExcelLoaded = true;
          saveCustomCasesToIDB(parsed, { source: "excel" });
          localStorage.removeItem("CDC_CUSTOM_EPIDEMIOLOGY_DATA");
        }
      }
    }
  } catch (err) {
    console.warn("Lỗi đọc dữ liệu tùy chỉnh:", err);
  }

  // Nếu chưa có dữ liệu tùy chỉnh, nạp bộ dữ liệu mặc định ban đầu
  if (!state.rawCases || state.rawCases.length === 0) {
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

  // Khởi tạo trạng thái nguồn dữ liệu trong modal
  updateUploadStatusBanner();

  console.log(`Đã nạp thành công ${state.rawCases.length} ca bệnh và ${state.facilities.length} cơ sở y tế.`);

  // 4. Kiểm tra tự động đồng bộ Google Sheets nếu Quản trị viên đã kích hoạt
  const autoSync = localStorage.getItem("CDC_GSHEET_AUTOSYNC") === "true";
  const gsheetUrl = localStorage.getItem("CDC_GSHEET_URL");
  if (autoSync && gsheetUrl) {
    setTimeout(() => {
      console.log("Đang tự động đồng bộ dữ liệu mới nhất từ Google Sheets...");
      syncFromGoogleSheets(gsheetUrl, true).catch(err => {
        console.warn("Lỗi auto-sync Google Sheets:", err);
      });
    }, 1200);
  }
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
  const isAuth = window.authService && window.authService.isAuthenticated();
  const macro = window.CDC_2026_MACRO_DATA;

  // Nếu ở chế độ khách và có dữ liệu chuẩn macro CDC 2026 từ Google Sheet
  if (!isAuth && macro && macro.kpis && !state.isCustomExcelLoaded) {
    const elTotal = document.getElementById("kpi-total");
    const elSxh = document.getElementById("kpi-sxh");
    const elTcm = document.getElementById("kpi-tcm");
    const elSxhSub = document.getElementById("kpi-sxh-sub");
    const elAlert = document.getElementById("kpi-alert");

    if (elTotal) elTotal.innerText = (macro.kpis.totalCases2026 || 19739).toLocaleString('vi-VN');
    if (elSxh) elSxh.innerText = (macro.kpis.sxh?.total2026 || 15020).toLocaleString('vi-VN');
    if (elTcm) elTcm.innerText = (macro.kpis.tcm?.total2026 || 4719).toLocaleString('vi-VN');
    if (elSxhSub) elSxhSub.innerText = `${macro.kpis.sxh?.odnTotal || 859} ổ dịch nhỏ (Tuần 48)`;
    if (elAlert) elAlert.innerText = (macro.kpis.odnSummary?.total || 937).toLocaleString('vi-VN');
    return;
  }

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
// DỊCH VỤ ĐỒNG BỘ DỮ LIỆU DỊCH TỄ HỌC 2026 TỪ GOOGLE SHEET (CDC ĐÀ NẴNG)
// ============================================================================
// ============================================================================
// DỮ LIỆU DỰ PHÒNG CDC 2026 (ĐẢM BẢO HOẠT ĐỘNG 100% KỂ CẢ KHI MẤT FILE NGOÀI)
// ============================================================================
if (typeof window.CDC_2026_MACRO_DATA === "undefined" || !window.CDC_2026_MACRO_DATA) {
  try {
    window.CDC_2026_MACRO_DATA = {"sheetId":"1lCHJzAgXeHj13K8avXetNlLKCmyCo_OHLNcPPh_bFRg","kpis":{"updatedWeek":"Tuần 48 (Giai đoạn 2025 - 2026)","updatedDate":"2026-11-28","totalCases2026":19739,"totalThisWeek":2115,"totalPopulation":2866101,"totalDeaths":0,"incidenceRatePer100k":688.7,"sxh":{"total2026":15020,"thisWeek":2078,"prevWeek":2219,"weekChange":"Giảm 6%","samePeriod2025":3579,"ratio2025":"Tăng 4,2 lần","odnTotal":859,"odnThisWeek":54,"odnPrevWeek":94,"odnWeekChange":"Giảm 43%","odn2025":169,"odnRatio2025":"Tăng 5,1 lần"},"tcm":{"total2026":4719,"thisWeek":37,"prevWeek":44,"weekChange":"Giảm 16%","samePeriod2025":1948,"ratio2025":"Tăng 2,4 lần","odnTotal":78,"odnThisWeek":1,"odnPrevWeek":3,"odnWeekChange":"Giảm 67%","odn2025":8,"odnRatio2025":"Tăng 9,8 lần"},"odnSummary":{"total":937,"thisWeek":55}},"weeklyTrends":[{"week":"T1","label":"Tuần 1","sxh_2026":72,"sxh_2025":91,"tcm_2026":25,"tcm_2025":20,"total_2026":97},{"week":"T2","label":"Tuần 2","sxh_2026":94,"sxh_2025":191,"tcm_2026":38,"tcm_2025":50,"total_2026":132},{"week":"T3","label":"Tuần 3","sxh_2026":108,"sxh_2025":261,"tcm_2026":18,"tcm_2025":77,"total_2026":126},{"week":"T4","label":"Tuần 4","sxh_2026":80,"sxh_2025":293,"tcm_2026":28,"tcm_2025":90,"total_2026":108},{"week":"T5","label":"Tuần 5","sxh_2026":79,"sxh_2025":312,"tcm_2026":34,"tcm_2025":100,"total_2026":113},{"week":"T6","label":"Tuần 6","sxh_2026":86,"sxh_2025":337,"tcm_2026":25,"tcm_2025":115,"total_2026":111},{"week":"T7","label":"Tuần 7","sxh_2026":49,"sxh_2025":379,"tcm_2026":22,"tcm_2025":157,"total_2026":71},{"week":"T8","label":"Tuần 8","sxh_2026":14,"sxh_2025":403,"tcm_2026":3,"tcm_2025":176,"total_2026":17},{"week":"T9","label":"Tuần 9","sxh_2026":46,"sxh_2025":436,"tcm_2026":41,"tcm_2025":197,"total_2026":87},{"week":"T10","label":"Tuần 10","sxh_2026":37,"sxh_2025":448,"tcm_2026":45,"tcm_2025":214,"total_2026":82},{"week":"T11","label":"Tuần 11","sxh_2026":33,"sxh_2025":470,"tcm_2026":53,"tcm_2025":237,"total_2026":86},{"week":"T12","label":"Tuần 12","sxh_2026":46,"sxh_2025":493,"tcm_2026":65,"tcm_2025":270,"total_2026":111},{"week":"T13","label":"Tuần 13","sxh_2026":46,"sxh_2025":518,"tcm_2026":86,"tcm_2025":312,"total_2026":132},{"week":"T14","label":"Tuần 14","sxh_2026":36,"sxh_2025":540,"tcm_2026":105,"tcm_2025":362,"total_2026":141},{"week":"T15","label":"Tuần 15","sxh_2026":36,"sxh_2025":554,"tcm_2026":215,"tcm_2025":415,"total_2026":251},{"week":"T16","label":"Tuần 16","sxh_2026":33,"sxh_2025":579,"tcm_2026":220,"tcm_2025":495,"total_2026":253},{"week":"T17","label":"Tuần 17","sxh_2026":43,"sxh_2025":597,"tcm_2026":230,"tcm_2025":552,"total_2026":273},{"week":"T18","label":"Tuần 18","sxh_2026":28,"sxh_2025":607,"tcm_2026":179,"tcm_2025":584,"total_2026":207},{"week":"T19","label":"Tuần 19","sxh_2026":34,"sxh_2025":627,"tcm_2026":196,"tcm_2025":641,"total_2026":230},{"week":"T20","label":"Tuần 20","sxh_2026":35,"sxh_2025":664,"tcm_2026":195,"tcm_2025":713,"total_2026":230},{"week":"T21","label":"Tuần 21","sxh_2026":43,"sxh_2025":692,"tcm_2026":207,"tcm_2025":776,"total_2026":250},{"week":"T22","label":"Tuần 22","sxh_2026":41,"sxh_2025":706,"tcm_2026":233,"tcm_2025":838,"total_2026":274},{"week":"T23","label":"Tuần 23","sxh_2026":37,"sxh_2025":724,"tcm_2026":157,"tcm_2025":903,"total_2026":194},{"week":"T24","label":"Tuần 24","sxh_2026":58,"sxh_2025":748,"tcm_2026":133,"tcm_2025":953,"total_2026":191},{"week":"T25","label":"Tuần 25","sxh_2026":74,"sxh_2025":776,"tcm_2026":145,"tcm_2025":1004,"total_2026":219},{"week":"T26","label":"Tuần 26","sxh_2026":48,"sxh_2025":796,"tcm_2026":121,"tcm_2025":1044,"total_2026":169},{"week":"T27","label":"Tuần 27","sxh_2026":81,"sxh_2025":820,"tcm_2026":141,"tcm_2025":1065,"total_2026":222},{"week":"T28","label":"Tuần 28","sxh_2026":61,"sxh_2025":853,"tcm_2026":140,"tcm_2025":1107,"total_2026":201},{"week":"T29","label":"Tuần 29","sxh_2026":108,"sxh_2025":889,"tcm_2026":137,"tcm_2025":1156,"total_2026":245},{"week":"T30","label":"Tuần 30","sxh_2026":96,"sxh_2025":930,"tcm_2026":133,"tcm_2025":1180,"total_2026":229},{"week":"T31","label":"Tuần 31","sxh_2026":158,"sxh_2025":997,"tcm_2026":132,"tcm_2025":1212,"total_2026":290},{"week":"T32","label":"Tuần 32","sxh_2026":152,"sxh_2025":1051,"tcm_2026":108,"tcm_2025":1255,"total_2026":260},{"week":"T33","label":"Tuần 33","sxh_2026":159,"sxh_2025":1125,"tcm_2026":121,"tcm_2025":1302,"total_2026":280},{"week":"T34","label":"Tuần 34","sxh_2026":170,"sxh_2025":1209,"tcm_2026":138,"tcm_2025":1356,"total_2026":308},{"week":"T35","label":"Tuần 35","sxh_2026":249,"sxh_2025":1305,"tcm_2026":78,"tcm_2025":1399,"total_2026":327},{"week":"T36","label":"Tuần 36","sxh_2026":249,"sxh_2025":1397,"tcm_2026":41,"tcm_2025":1446,"total_2026":290},{"week":"T37","label":"Tuần 37","sxh_2026":394,"sxh_2025":1508,"tcm_2026":53,"tcm_2025":1521,"total_2026":447},{"week":"T38","label":"Tuần 38","sxh_2026":397,"sxh_2025":1619,"tcm_2026":73,"tcm_2025":1583,"total_2026":470},{"week":"T39","label":"Tuần 39","sxh_2026":351,"sxh_2025":1739,"tcm_2026":68,"tcm_2025":1652,"total_2026":419},{"week":"T40","label":"Tuần 40","sxh_2026":462,"sxh_2025":1906,"tcm_2026":65,"tcm_2025":1704,"total_2026":527},{"week":"T41","label":"Tuần 41","sxh_2026":494,"sxh_2025":2138,"tcm_2026":65,"tcm_2025":1750,"total_2026":559},{"week":"T42","label":"Tuần 42","sxh_2026":706,"sxh_2025":2356,"tcm_2026":69,"tcm_2025":1810,"total_2026":775},{"week":"T43","label":"Tuần 43","sxh_2026":765,"sxh_2025":2565,"tcm_2026":69,"tcm_2025":1836,"total_2026":834},{"week":"T44","label":"Tuần 44","sxh_2026":1016,"sxh_2025":2712,"tcm_2026":73,"tcm_2025":1858,"total_2026":1089},{"week":"T45","label":"Tuần 45","sxh_2026":1394,"sxh_2025":2914,"tcm_2026":63,"tcm_2025":1874,"total_2026":1457},{"week":"T46","label":"Tuần 46","sxh_2026":1925,"sxh_2025":3145,"tcm_2026":52,"tcm_2025":1893,"total_2026":1977},{"week":"T47","label":"Tuần 47","sxh_2026":2219,"sxh_2025":3384,"tcm_2026":44,"tcm_2025":1923,"total_2026":2263},{"week":"T48","label":"Tuần 48","sxh_2026":2078,"sxh_2025":3579,"tcm_2026":37,"tcm_2025":1948,"total_2026":2115}],"monthlyTrends2026":[{"month":"Tháng 01","sxh_2026":354,"tcm_2026":109,"sxh_2025":293,"total_2026":463},{"month":"Tháng 02","sxh_2026":228,"tcm_2026":84,"sxh_2025":110,"total_2026":312},{"month":"Tháng 03","sxh_2026":208,"tcm_2026":290,"sxh_2025":115,"total_2026":498},{"month":"Tháng 04","sxh_2026":148,"tcm_2026":770,"sxh_2025":79,"total_2026":918},{"month":"Tháng 05","sxh_2026":140,"tcm_2026":777,"sxh_2025":95,"total_2026":917},{"month":"Tháng 06","sxh_2026":258,"tcm_2026":789,"sxh_2025":104,"total_2026":1047},{"month":"Tháng 07","sxh_2026":346,"tcm_2026":551,"sxh_2025":134,"total_2026":897},{"month":"Tháng 08","sxh_2026":888,"tcm_2026":577,"sxh_2025":375,"total_2026":1465},{"month":"Tháng 09","sxh_2026":1391,"tcm_2026":235,"sxh_2025":434,"total_2026":1626},{"month":"Tháng 10","sxh_2026":3443,"tcm_2026":341,"sxh_2025":973,"total_2026":3784},{"month":"Tháng 11","sxh_2026":7616,"tcm_2026":196,"sxh_2025":867,"total_2026":7812},{"month":"Tháng 12","sxh_2026":0,"tcm_2026":0,"sxh_2025":0,"total_2026":0}],"hotspots":{"sxhTopCases":[{"ward":"Phường Ngũ Hành Sơn","cases":204,"rate":1406.2,"district":"Ngũ Hành Sơn"},{"ward":"Phường Điện Bàn Đông","cases":126,"rate":918.2,"district":"Điện Bàn"},{"ward":"Xã Thăng Bình","cases":106,"rate":1213,"district":"Thăng Bình"},{"ward":"Phường An Khê","cases":103,"rate":947.5,"district":"Thanh Khê"},{"ward":"Phường Sơn Trà","cases":93,"rate":944,"district":"Sơn Trà"},{"ward":"Phường Hòa Cường","cases":92,"rate":528.9,"district":"Hải Châu"},{"ward":"Phường Thanh Khê","cases":80,"rate":385.4,"district":"Thanh Khê"},{"ward":"Phường An Hải","cases":73,"rate":601.5,"district":"Sơn Trà"},{"ward":"Phường Hải Châu","cases":60,"rate":315.4,"district":"Hải Châu"},{"ward":"Xã Duy Xuyên","cases":58,"rate":1187,"district":"Duy Xuyên"}],"sxhTopRates":[{"ward":"Xã Khâm Đức","rate":1951.8,"cases":183,"district":"Phước Sơn"},{"ward":"Phường Điện Bàn Bắc","rate":1803,"cases":612,"district":"Điện Bàn"},{"ward":"Phường Ngũ Hành Sơn","rate":1406.2,"cases":1567,"district":"Ngũ Hành Sơn"},{"ward":"Xã Thăng Bình","rate":1213,"cases":648,"district":"Thăng Bình"},{"ward":"Xã Duy Xuyên","rate":1187,"cases":598,"district":"Duy Xuyên"},{"ward":"Phường An Khê","rate":947.5,"cases":920,"district":"Thanh Khê"},{"ward":"Phường Sơn Trà","rate":944,"cases":781,"district":"Sơn Trà"},{"ward":"Phường Điện Bàn Đông","rate":918.2,"cases":681,"district":"Điện Bàn"},{"ward":"Phường An Hải","rate":601.5,"cases":589,"district":"Sơn Trà"},{"ward":"Phường Hòa Cường","rate":528.9,"cases":480,"district":"Hải Châu"}],"tcmTopCases":[{"ward":"Phường Sơn Trà","cases":4,"rate":199.4,"district":"Sơn Trà"},{"ward":"Phường Thanh Khê","cases":3,"rate":140.3,"district":"Thanh Khê"},{"ward":"Phường Ngũ Hành Sơn","cases":3,"rate":252.2,"district":"Ngũ Hành Sơn"},{"ward":"Phường Liên Chiểu","cases":3,"rate":198.5,"district":"Liên Chiểu"},{"ward":"Xã Thu Bồn","cases":3,"rate":165.2,"district":"Duy Xuyên"}]},"wards":[{"district":"Hải Châu","ward":"Phường Hải Châu","pop":108108,"sxh_w48":60,"sxh_cum":341,"sxh_rate":315.43,"tcm_w48":1,"tcm_cum":133,"tcm_rate":123.03,"total_cum":474},{"district":"Hải Châu","ward":"Phường Hòa Cường","pop":90751,"sxh_w48":92,"sxh_cum":480,"sxh_rate":528.92,"tcm_w48":1,"tcm_cum":166,"tcm_rate":182.92,"total_cum":646},{"district":"Thanh Khê","ward":"Phường Thanh Khê","pop":182432,"sxh_w48":80,"sxh_cum":703,"sxh_rate":385.35,"tcm_w48":3,"tcm_cum":256,"tcm_rate":140.33,"total_cum":959},{"district":"Thanh Khê","ward":"Phường An Khê","pop":97096,"sxh_w48":103,"sxh_cum":920,"sxh_rate":947.52,"tcm_w48":0,"tcm_cum":187,"tcm_rate":192.59,"total_cum":1107},{"district":"Sơn Trà","ward":"Phường An Hải","pop":97928,"sxh_w48":73,"sxh_cum":589,"sxh_rate":601.46,"tcm_w48":0,"tcm_cum":124,"tcm_rate":126.62,"total_cum":713},{"district":"Sơn Trà","ward":"Phường Sơn Trà","pop":82733,"sxh_w48":93,"sxh_cum":781,"sxh_rate":944,"tcm_w48":4,"tcm_cum":165,"tcm_rate":199.44,"total_cum":946},{"district":"Ngũ Hành Sơn","ward":"Phường Ngũ Hành Sơn","pop":111434,"sxh_w48":204,"sxh_cum":1567,"sxh_rate":1406.21,"tcm_w48":3,"tcm_cum":281,"tcm_rate":252.17,"total_cum":1848},{"district":"Liên Chiểu","ward":"Phường Hải Vân","pop":54597,"sxh_w48":43,"sxh_cum":439,"sxh_rate":804.07,"tcm_w48":0,"tcm_cum":122,"tcm_rate":223.46,"total_cum":561},{"district":"Liên Chiểu","ward":"Phường Liên Chiểu","pop":82123,"sxh_w48":59,"sxh_cum":516,"sxh_rate":628.33,"tcm_w48":3,"tcm_cum":151,"tcm_rate":183.87,"total_cum":667},{"district":"Liên Chiểu","ward":"Phường Hòa Khánh","pop":131038,"sxh_w48":48,"sxh_cum":484,"sxh_rate":369.36,"tcm_w48":0,"tcm_cum":145,"tcm_rate":110.65,"total_cum":629},{"district":"Cẩm  Lệ","ward":"Phường Cẩm Lệ","pop":86334,"sxh_w48":85,"sxh_cum":550,"sxh_rate":637.06,"tcm_w48":1,"tcm_cum":171,"tcm_rate":198.07,"total_cum":721},{"district":"Cẩm Lệ","ward":"Phường Hòa Xuân","pop":97798,"sxh_w48":51,"sxh_cum":375,"sxh_rate":383.44,"tcm_w48":0,"tcm_cum":180,"tcm_rate":184.05,"total_cum":555},{"district":"Hòa Vang","ward":"Xã Hòa Vang","pop":25492,"sxh_w48":8,"sxh_cum":108,"sxh_rate":423.66,"tcm_w48":0,"tcm_cum":50,"tcm_rate":196.14,"total_cum":158},{"district":"Hòa Vang","ward":"Xã Bà Nà","pop":21577,"sxh_w48":11,"sxh_cum":86,"sxh_rate":398.57,"tcm_w48":1,"tcm_cum":55,"tcm_rate":254.9,"total_cum":141},{"district":"Hòa Vang","ward":"Xã Hòa Tiến","pop":38721,"sxh_w48":18,"sxh_cum":187,"sxh_rate":482.94,"tcm_w48":0,"tcm_cum":63,"tcm_rate":162.7,"total_cum":250},{"district":"Núi Thành","ward":"Xã Núi Thành","pop":59512,"sxh_w48":9,"sxh_cum":109,"sxh_rate":183.16,"tcm_w48":0,"tcm_cum":73,"tcm_rate":122.66,"total_cum":182},{"district":"Núi Thành","ward":"Xã Tam Mỹ","pop":15440,"sxh_w48":0,"sxh_cum":20,"sxh_rate":129.53,"tcm_w48":0,"tcm_cum":14,"tcm_rate":90.67,"total_cum":34},{"district":"Núi Thành","ward":"Xã Tam Anh","pop":25798,"sxh_w48":6,"sxh_cum":54,"sxh_rate":209.32,"tcm_w48":0,"tcm_cum":67,"tcm_rate":259.71,"total_cum":121},{"district":"Núi Thành","ward":"Xã Đức Phú","pop":8266,"sxh_w48":0,"sxh_cum":4,"sxh_rate":48.39,"tcm_w48":0,"tcm_cum":10,"tcm_rate":120.98,"total_cum":14},{"district":"Núi Thành","ward":"Xã Tam Xuân","pop":36690,"sxh_w48":5,"sxh_cum":44,"sxh_rate":119.92,"tcm_w48":0,"tcm_cum":115,"tcm_rate":313.44,"total_cum":159},{"district":"Núi Thành","ward":"Xã Tam Hải","pop":6994,"sxh_w48":1,"sxh_cum":9,"sxh_rate":128.68,"tcm_w48":0,"tcm_cum":2,"tcm_rate":28.6,"total_cum":11},{"district":"Tam Kỳ","ward":"Phường Tam Kỳ","pop":32650,"sxh_w48":5,"sxh_cum":40,"sxh_rate":122.51,"tcm_w48":0,"tcm_cum":89,"tcm_rate":272.59,"total_cum":129},{"district":"Tam Kỳ","ward":"Phường Quảng Phú","pop":38855,"sxh_w48":12,"sxh_cum":60,"sxh_rate":154.42,"tcm_w48":0,"tcm_cum":63,"tcm_rate":162.14,"total_cum":123},{"district":"Tam Kỳ","ward":"Phường Hương Trà","pop":31067,"sxh_w48":9,"sxh_cum":37,"sxh_rate":119.1,"tcm_w48":0,"tcm_cum":56,"tcm_rate":180.26,"total_cum":93},{"district":"Tam Kỳ","ward":"Phường Bàn Thạch","pop":24490,"sxh_w48":25,"sxh_cum":155,"sxh_rate":632.91,"tcm_w48":0,"tcm_cum":97,"tcm_rate":396.08,"total_cum":252},{"district":"Phú Ninh","ward":"Xã Tây Hồ","pop":28893,"sxh_w48":15,"sxh_cum":99,"sxh_rate":342.64,"tcm_w48":0,"tcm_cum":83,"tcm_rate":287.27,"total_cum":182},{"district":"Phú Ninh","ward":"Xã Chiên Đàn","pop":28119,"sxh_w48":10,"sxh_cum":136,"sxh_rate":483.66,"tcm_w48":1,"tcm_cum":81,"tcm_rate":288.06,"total_cum":217},{"district":"Phú Ninh","ward":"Xã Phú Ninh","pop":23097,"sxh_w48":5,"sxh_cum":28,"sxh_rate":121.23,"tcm_w48":0,"tcm_cum":38,"tcm_rate":164.52,"total_cum":66},{"district":"Tiên Phước","ward":"Xã Lãnh Ngọc","pop":12153,"sxh_w48":0,"sxh_cum":11,"sxh_rate":90.51,"tcm_w48":0,"tcm_cum":24,"tcm_rate":197.48,"total_cum":35},{"district":"Tiên Phước","ward":"Xã Tiên Phước","pop":22672,"sxh_w48":3,"sxh_cum":26,"sxh_rate":114.68,"tcm_w48":0,"tcm_cum":59,"tcm_rate":260.23,"total_cum":85},{"district":"Tiên Phước","ward":"Xã Thạnh Bình","pop":19765,"sxh_w48":4,"sxh_cum":39,"sxh_rate":197.32,"tcm_w48":1,"tcm_cum":86,"tcm_rate":435.11,"total_cum":125},{"district":"Tiên Phước","ward":"Xã Sơn Cẩm Hà","pop":13784,"sxh_w48":4,"sxh_cum":20,"sxh_rate":145.1,"tcm_w48":2,"tcm_cum":15,"tcm_rate":108.82,"total_cum":35},{"district":"Bắc Trà My","ward":"Xã Trà Liên","pop":5779,"sxh_w48":1,"sxh_cum":5,"sxh_rate":86.52,"tcm_w48":0,"tcm_cum":10,"tcm_rate":173.04,"total_cum":15},{"district":"Bắc Trà My","ward":"Xã Trà Giáp","pop":5305,"sxh_w48":0,"sxh_cum":2,"sxh_rate":37.7,"tcm_w48":0,"tcm_cum":9,"tcm_rate":169.65,"total_cum":11},{"district":"Bắc Trà My","ward":"Xã Trà Tân","pop":5472,"sxh_w48":0,"sxh_cum":5,"sxh_rate":91.37,"tcm_w48":0,"tcm_cum":8,"tcm_rate":146.2,"total_cum":13},{"district":"Bắc Trà My","ward":"Xã Trà Đốc","pop":9246,"sxh_w48":2,"sxh_cum":8,"sxh_rate":86.52,"tcm_w48":0,"tcm_cum":14,"tcm_rate":151.42,"total_cum":22},{"district":"Bắc Trà My","ward":"Xã Trà My","pop":17269,"sxh_w48":3,"sxh_cum":15,"sxh_rate":86.86,"tcm_w48":1,"tcm_cum":29,"tcm_rate":167.93,"total_cum":44},{"district":"Nam Trà My","ward":"Xã Nam Trà My","pop":7976,"sxh_w48":1,"sxh_cum":6,"sxh_rate":75.23,"tcm_w48":0,"tcm_cum":6,"tcm_rate":75.23,"total_cum":12},{"district":"Nam Trà My","ward":"Xã Trà Tập","pop":7420,"sxh_w48":1,"sxh_cum":3,"sxh_rate":40.43,"tcm_w48":1,"tcm_cum":4,"tcm_rate":53.91,"total_cum":7},{"district":"Nam Trà My","ward":"Xã Trà Vân","pop":4648,"sxh_w48":0,"sxh_cum":1,"sxh_rate":21.51,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":1},{"district":"Nam Trà My","ward":"Xã Trà Linh","pop":6697,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":0},{"district":"Nam Trà My","ward":"Xã Trà Leng","pop":5950,"sxh_w48":0,"sxh_cum":11,"sxh_rate":184.87,"tcm_w48":0,"tcm_cum":3,"tcm_rate":50.42,"total_cum":14},{"district":"Thăng Bình","ward":"Xã Thăng Bình","pop":47142,"sxh_w48":106,"sxh_cum":572,"sxh_rate":1213.36,"tcm_w48":1,"tcm_cum":60,"tcm_rate":127.28,"total_cum":632},{"district":"Thăng Bình","ward":"Xã Thăng An","pop":42206,"sxh_w48":49,"sxh_cum":208,"sxh_rate":492.82,"tcm_w48":0,"tcm_cum":91,"tcm_rate":215.61,"total_cum":299},{"district":"Thăng Bình","ward":"Xã Thăng Trường","pop":22202,"sxh_w48":42,"sxh_cum":121,"sxh_rate":545,"tcm_w48":0,"tcm_cum":64,"tcm_rate":288.26,"total_cum":185},{"district":"Thăng Bình","ward":"Xã Thăng Điền","pop":34950,"sxh_w48":0,"sxh_cum":97,"sxh_rate":277.54,"tcm_w48":0,"tcm_cum":82,"tcm_rate":234.62,"total_cum":179},{"district":"Thăng Bình","ward":"Xã Thăng Phú","pop":12618,"sxh_w48":14,"sxh_cum":75,"sxh_rate":594.39,"tcm_w48":0,"tcm_cum":24,"tcm_rate":190.2,"total_cum":99},{"district":"Thăng Bình","ward":"Xã Đồng Dương","pop":19248,"sxh_w48":10,"sxh_cum":114,"sxh_rate":592.27,"tcm_w48":0,"tcm_cum":30,"tcm_rate":155.86,"total_cum":144},{"district":"Quế Sơn","ward":"Xã Quế Sơn Trung","pop":26246,"sxh_w48":9,"sxh_cum":51,"sxh_rate":194.32,"tcm_w48":1,"tcm_cum":21,"tcm_rate":80.01,"total_cum":72},{"district":"Quế Sơn","ward":"Xã Quế Sơn","pop":26389,"sxh_w48":2,"sxh_cum":43,"sxh_rate":162.95,"tcm_w48":0,"tcm_cum":19,"tcm_rate":72,"total_cum":62},{"district":"Quế Sơn","ward":"Xã Xuân Phú","pop":30912,"sxh_w48":49,"sxh_cum":340,"sxh_rate":1099.9,"tcm_w48":0,"tcm_cum":25,"tcm_rate":80.87,"total_cum":365},{"district":"Nông Sơn","ward":"Xã Nông Sơn","pop":17069,"sxh_w48":9,"sxh_cum":29,"sxh_rate":169.9,"tcm_w48":0,"tcm_cum":16,"tcm_rate":93.74,"total_cum":45},{"district":"Nông Sơn","ward":"Xã Quế Phước","pop":10332,"sxh_w48":0,"sxh_cum":4,"sxh_rate":38.71,"tcm_w48":0,"tcm_cum":23,"tcm_rate":222.61,"total_cum":27},{"district":"Duy Xuyên","ward":"Xã Duy Nghĩa","pop":26533,"sxh_w48":0,"sxh_cum":113,"sxh_rate":425.88,"tcm_w48":0,"tcm_cum":33,"tcm_rate":124.37,"total_cum":146},{"district":"Duy Xuyên","ward":"Xã Nam Phước","pop":48325,"sxh_w48":8,"sxh_cum":126,"sxh_rate":260.73,"tcm_w48":1,"tcm_cum":47,"tcm_rate":97.26,"total_cum":173},{"district":"Duy Xuyên","ward":"Xã Duy Xuyên","pop":26630,"sxh_w48":57,"sxh_cum":316,"sxh_rate":1186.63,"tcm_w48":0,"tcm_cum":14,"tcm_rate":52.57,"total_cum":330},{"district":"Duy Xuyên","ward":"Xã Thu Bồn","pop":29780,"sxh_w48":21,"sxh_cum":172,"sxh_rate":577.57,"tcm_w48":3,"tcm_cum":34,"tcm_rate":114.17,"total_cum":206},{"district":"Điện Bàn","ward":"Phường Điện Bàn","pop":36875,"sxh_w48":33,"sxh_cum":274,"sxh_rate":743.05,"tcm_w48":2,"tcm_cum":79,"tcm_rate":214.24,"total_cum":353},{"district":"Điện Bàn","ward":"Phường Điện Bàn Đông","pop":74167,"sxh_w48":126,"sxh_cum":681,"sxh_rate":918.2,"tcm_w48":0,"tcm_cum":180,"tcm_rate":242.7,"total_cum":861},{"district":"Điện Bàn","ward":"Phường An Thắng","pop":31290,"sxh_w48":34,"sxh_cum":209,"sxh_rate":667.95,"tcm_w48":0,"tcm_cum":67,"tcm_rate":214.13,"total_cum":276},{"district":"Điện Bàn","ward":"Phường Điện Bàn Bắc","pop":29285,"sxh_w48":86,"sxh_cum":528,"sxh_rate":1802.97,"tcm_w48":0,"tcm_cum":83,"tcm_rate":283.42,"total_cum":611},{"district":"Điện Bàn","ward":"Xã Điện Bàn Tây","pop":44473,"sxh_w48":22,"sxh_cum":284,"sxh_rate":638.59,"tcm_w48":0,"tcm_cum":60,"tcm_rate":134.91,"total_cum":344},{"district":"Điện Bàn","ward":"Xã Gò Nổi","pop":24902,"sxh_w48":14,"sxh_cum":58,"sxh_rate":232.91,"tcm_w48":0,"tcm_cum":32,"tcm_rate":128.5,"total_cum":90},{"district":"Hội An","ward":"Phường Hội An","pop":31364,"sxh_w48":35,"sxh_cum":198,"sxh_rate":631.3,"tcm_w48":0,"tcm_cum":43,"tcm_rate":137.1,"total_cum":241},{"district":"Hội An","ward":"Phường Hội An Đông","pop":29160,"sxh_w48":24,"sxh_cum":146,"sxh_rate":500.69,"tcm_w48":0,"tcm_cum":59,"tcm_rate":202.33,"total_cum":205},{"district":"Hội An","ward":"Phường Hội An Tây","pop":40955,"sxh_w48":90,"sxh_cum":408,"sxh_rate":996.22,"tcm_w48":0,"tcm_cum":78,"tcm_rate":190.45,"total_cum":486},{"district":"Hội An","ward":"Xã Tân Hiệp","pop":1976,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":3,"tcm_rate":151.82,"total_cum":3},{"district":"Đại Lộc","ward":"Xã Đại Lộc","pop":53650,"sxh_w48":38,"sxh_cum":221,"sxh_rate":411.93,"tcm_w48":1,"tcm_cum":43,"tcm_rate":80.15,"total_cum":264},{"district":"Đại Lộc","ward":"Xã Hà Nha","pop":30615,"sxh_w48":16,"sxh_cum":73,"sxh_rate":238.45,"tcm_w48":0,"tcm_cum":11,"tcm_rate":35.93,"total_cum":84},{"district":"Đại Lộc","ward":"Xã Thượng Đức","pop":17518,"sxh_w48":3,"sxh_cum":25,"sxh_rate":142.71,"tcm_w48":2,"tcm_cum":12,"tcm_rate":68.5,"total_cum":37},{"district":"Đại Lộc","ward":"Xã Vu Gia","pop":22033,"sxh_w48":3,"sxh_cum":46,"sxh_rate":208.78,"tcm_w48":0,"tcm_cum":17,"tcm_rate":77.16,"total_cum":63},{"district":"Đại Lộc","ward":"Xã Phú Thuận","pop":22309,"sxh_w48":7,"sxh_cum":58,"sxh_rate":259.98,"tcm_w48":1,"tcm_cum":17,"tcm_rate":76.2,"total_cum":75},{"district":"Nam Giang","ward":"Xã Thạnh Mỹ","pop":8309,"sxh_w48":2,"sxh_cum":52,"sxh_rate":625.83,"tcm_w48":0,"tcm_cum":1,"tcm_rate":12.04,"total_cum":53},{"district":"Nam Giang","ward":"Xã Bến Giằng","pop":7716,"sxh_w48":7,"sxh_cum":31,"sxh_rate":401.76,"tcm_w48":0,"tcm_cum":2,"tcm_rate":25.92,"total_cum":33},{"district":"Nam Giang","ward":"Xã Nam Giang","pop":4816,"sxh_w48":0,"sxh_cum":1,"sxh_rate":20.76,"tcm_w48":0,"tcm_cum":2,"tcm_rate":41.53,"total_cum":3},{"district":"Nam Giang","ward":"Xã Đắc Pring","pop":2665,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":1,"tcm_rate":37.52,"total_cum":1},{"district":"Nam Giang","ward":"Xã La Dêê","pop":2343,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":7,"tcm_rate":298.76,"total_cum":7},{"district":"Nam Giang","ward":"Xã La Êê","pop":2095,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":1,"tcm_rate":47.73,"total_cum":1},{"district":"Đông Giang","ward":"Xã Sông Vàng","pop":5812,"sxh_w48":2,"sxh_cum":4,"sxh_rate":68.82,"tcm_w48":1,"tcm_cum":6,"tcm_rate":103.23,"total_cum":10},{"district":"Đông Giang","ward":"Xã Sông Kôn","pop":7425,"sxh_w48":1,"sxh_cum":1,"sxh_rate":13.47,"tcm_w48":0,"tcm_cum":4,"tcm_rate":53.87,"total_cum":5},{"district":"Đông Giang","ward":"Xã Đông Giang","pop":9008,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":1,"tcm_rate":11.1,"total_cum":1},{"district":"Đông Giang","ward":"Xã Bến Hiên","pop":4151,"sxh_w48":0,"sxh_cum":1,"sxh_rate":24.09,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":1},{"district":"Tây Giang","ward":"Xã Avương","pop":4986,"sxh_w48":0,"sxh_cum":1,"sxh_rate":20.06,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":1},{"district":"Tây Giang","ward":"Xã Tây Giang","pop":9029,"sxh_w48":0,"sxh_cum":6,"sxh_rate":66.45,"tcm_w48":0,"tcm_cum":2,"tcm_rate":22.15,"total_cum":8},{"district":"Tây Giang","ward":"Xã Hùng Sơn","pop":8124,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":0},{"district":"Hiệp Đức","ward":"Xã Hiệp Đức","pop":12751,"sxh_w48":3,"sxh_cum":43,"sxh_rate":337.23,"tcm_w48":1,"tcm_cum":6,"tcm_rate":47.06,"total_cum":49},{"district":"Hiệp Đức","ward":"Xã Việt An","pop":19660,"sxh_w48":2,"sxh_cum":21,"sxh_rate":106.82,"tcm_w48":0,"tcm_cum":9,"tcm_rate":45.78,"total_cum":30},{"district":"Hiệp Đức","ward":"Xã Phước Trà","pop":5933,"sxh_w48":0,"sxh_cum":3,"sxh_rate":50.56,"tcm_w48":0,"tcm_cum":1,"tcm_rate":16.85,"total_cum":4},{"district":"Phước Sơn","ward":"Xã Khâm Đức","pop":9376,"sxh_w48":5,"sxh_cum":183,"sxh_rate":1951.79,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":183},{"district":"Phước Sơn","ward":"Xã Phước Năng","pop":6511,"sxh_w48":0,"sxh_cum":8,"sxh_rate":122.87,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":8},{"district":"Phước Sơn","ward":"Xã Phước Chánh","pop":3916,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":0},{"district":"Phước Sơn","ward":"Xã Phước Thành","pop":4047,"sxh_w48":0,"sxh_cum":0,"sxh_rate":0,"tcm_w48":0,"tcm_cum":0,"tcm_rate":0,"total_cum":0},{"district":"Phước Sơn","ward":"Xã Phước Hiệp","pop":4105,"sxh_w48":0,"sxh_cum":2,"sxh_rate":48.72,"tcm_w48":0,"tcm_cum":5,"tcm_rate":121.8,"total_cum":7}]};
  } catch (e) {
    console.warn("Không thể nạp macro fallback:", e);
  }
}

const cdcMacroService = {
  sheetId: "1lCHJzAgXeHj13K8avXetNlLKCmyCo_OHLNcPPh_bFRg",
  isSyncing: false,
  lastSyncTime: null,

  getData() {
    return window.CDC_2026_MACRO_DATA || null;
  },

  async syncLive(isManual = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const btnText = document.getElementById("cdc-btn-sync-text");
    const syncIcon = document.getElementById("cdc-sync-icon");
    const statusLabel = document.getElementById("cdc-sync-status-label");

    if (btnText) btnText.innerText = "Đang cập nhật...";
    if (syncIcon) syncIcon.classList.add("fa-spin");
    if (statusLabel) statusLabel.innerText = "Đang kết nối cơ sở dữ liệu báo cáo CDC Đà Nẵng...";

    try {
      const url = `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:json&sheet=Table%202026`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP Status: " + res.status);
      const text = await res.text();
      const json = JSON.parse(text.replace(/^[^{]*\(/, "").replace(/\);?\s*$/, ""));

      if (json && json.table && json.table.rows && json.table.rows.length > 5) {
        this.parseAndUpdateTable2026(json.table.rows);
        this.lastSyncTime = new Date();
        const timeStr = this.lastSyncTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        if (statusLabel) {
          const kpis = window.CDC_2026_MACRO_DATA?.kpis;
          statusLabel.innerText = `CDC 2026: Tuần 48 (${(kpis?.totalCases2026 || 19739).toLocaleString("vi-VN")} ca) • Cập nhật lúc ${timeStr}`;
        }
        if (isManual) {
          if (typeof showNotification === "function") {
            showNotification("Đã cập nhật thành công số liệu dịch tễ mới nhất từ báo cáo tổng hợp!", "success");
          }
        }
        updateGuestDashboard();
      }
    } catch (err) {
      console.warn("Lỗi cập nhật dữ liệu trực tuyến CDC:", err);
      if (statusLabel) {
        statusLabel.innerText = "Dữ liệu CDC 2026 (Tuần 48) • Sẵn sàng chế độ lưu trữ";
      }
      if (isManual) {
        if (typeof showNotification === "function") {
          showNotification("Đang sử dụng số liệu chuẩn lưu trữ từ báo cáo tổng hợp gần nhất.", "info");
        }
      }
    } finally {
      this.isSyncing = false;
      if (btnText) btnText.innerText = "Cập nhật dữ liệu mới nhất";
      if (syncIcon) syncIcon.classList.remove("fa-spin");
    }
  },

  parseAndUpdateTable2026(rows) {
    if (!window.CDC_2026_MACRO_DATA) return;
    const kpis = window.CDC_2026_MACRO_DATA.kpis || {};

    const parseNum = (val) => {
      if (typeof val === "number") return val;
      if (!val) return 0;
      const clean = String(val).replace(/\./g, "").replace(/,/g, ".").trim();
      return parseFloat(clean) || 0;
    };

    // Row 2: Ca SXH, Row 3: ODN SXH, Row 4: Ca TCM, Row 5: ODN TCM
    const rowSxh = rows.find(r => r.c && r.c[1] && String(r.c[1].v).trim() === "Ca SXH");
    const rowOdnSxh = rows.find(r => r.c && r.c[1] && String(r.c[1].v).trim() === "ODN SXH");
    const rowTcm = rows.find(r => r.c && r.c[1] && String(r.c[1].v).trim() === "Ca TCM");
    const rowOdnTcm = rows.find(r => r.c && r.c[1] && String(r.c[1].v).trim() === "ODN TCM");

    if (rowSxh && rowSxh.c) {
      if (rowSxh.c[2]) kpis.sxh.prevWeek = parseNum(rowSxh.c[2].v);
      if (rowSxh.c[3]) kpis.sxh.thisWeek = parseNum(rowSxh.c[3].v);
      if (rowSxh.c[4]) kpis.sxh.weekChange = String(rowSxh.c[4].v).trim();
      if (rowSxh.c[5]) kpis.sxh.total2026 = parseNum(rowSxh.c[5].v);
      if (rowSxh.c[6]) kpis.sxh.samePeriod2025 = parseNum(rowSxh.c[6].v);
      if (rowSxh.c[7]) kpis.sxh.ratio2025 = String(rowSxh.c[7].v).trim();
    }

    if (rowOdnSxh && rowOdnSxh.c) {
      if (rowOdnSxh.c[2]) kpis.sxh.odnPrevWeek = parseNum(rowOdnSxh.c[2].v);
      if (rowOdnSxh.c[3]) kpis.sxh.odnThisWeek = parseNum(rowOdnSxh.c[3].v);
      if (rowOdnSxh.c[4]) kpis.sxh.odnWeekChange = String(rowOdnSxh.c[4].v).trim();
      if (rowOdnSxh.c[5]) kpis.sxh.odnTotal = parseNum(rowOdnSxh.c[5].v);
      if (rowOdnSxh.c[6]) kpis.sxh.odn2025 = parseNum(rowOdnSxh.c[6].v);
      if (rowOdnSxh.c[7]) kpis.sxh.odnRatio2025 = String(rowOdnSxh.c[7].v).trim();
    }

    if (rowTcm && rowTcm.c) {
      if (rowTcm.c[2]) kpis.tcm.prevWeek = parseNum(rowTcm.c[2].v);
      if (rowTcm.c[3]) kpis.tcm.thisWeek = parseNum(rowTcm.c[3].v);
      if (rowTcm.c[4]) kpis.tcm.weekChange = String(rowTcm.c[4].v).trim();
      if (rowTcm.c[5]) kpis.tcm.total2026 = parseNum(rowTcm.c[5].v);
      if (rowTcm.c[6]) kpis.tcm.samePeriod2025 = parseNum(rowTcm.c[6].v);
      if (rowTcm.c[7]) kpis.tcm.ratio2025 = String(rowTcm.c[7].v).trim();
    }

    if (rowOdnTcm && rowOdnTcm.c) {
      if (rowOdnTcm.c[2]) kpis.tcm.odnPrevWeek = parseNum(rowOdnTcm.c[2].v);
      if (rowOdnTcm.c[3]) kpis.tcm.odnThisWeek = parseNum(rowOdnTcm.c[3].v);
      if (rowOdnTcm.c[4]) kpis.tcm.odnWeekChange = String(rowOdnTcm.c[4].v).trim();
      if (rowOdnTcm.c[5]) kpis.tcm.odnTotal = parseNum(rowOdnTcm.c[5].v);
      if (rowOdnTcm.c[6]) kpis.tcm.odn2025 = parseNum(rowOdnTcm.c[6].v);
      if (rowOdnTcm.c[7]) kpis.tcm.odnRatio2025 = String(rowOdnTcm.c[7].v).trim();
    }

    kpis.totalCases2026 = (kpis.sxh.total2026 || 0) + (kpis.tcm.total2026 || 0);
    kpis.totalThisWeek = (kpis.sxh.thisWeek || 0) + (kpis.tcm.thisWeek || 0);
    kpis.odnSummary = {
      total: (kpis.sxh.odnTotal || 0) + (kpis.tcm.odnTotal || 0),
      thisWeek: (kpis.sxh.odnThisWeek || 0) + (kpis.tcm.odnThisWeek || 0)
    };
    if (kpis.totalPopulation > 0) {
      kpis.incidenceRatePer100k = Number(((kpis.totalCases2026 / kpis.totalPopulation) * 100000).toFixed(1));
    }
  }
};
window.cdcMacroService = cdcMacroService;
window.triggerCdcLiveSync = function(isManual) {
  return cdcMacroService.syncLive(isManual);
};

// ============================================================================
// BIỂU ĐỒ & BÁO CÁO DÀNH CHO GIAO DIỆN KHÁCH (GUEST OVERVIEW DASHBOARD)
// ============================================================================
function initGuestCharts() {
  state.guestTrendMode = state.guestTrendMode || "week";

  // Chart 1: Đường cong dịch tễ 52 tuần & diễn tiến theo tháng (Combo Bar + Line Chart)
  const ctxGuestTrend = document.getElementById("guest-chart-trend");
  if (ctxGuestTrend) {
    state.guestCharts.trend = new Chart(ctxGuestTrend, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            type: "bar",
            label: "Sốt xuất huyết (2026)",
            data: [],
            backgroundColor: "rgba(249, 115, 22, 0.85)",
            borderColor: "#f97316",
            borderWidth: 1,
            borderRadius: 3,
            order: 3
          },
          {
            type: "bar",
            label: "Tay chân miệng (2026)",
            data: [],
            backgroundColor: "rgba(250, 204, 21, 0.85)",
            borderColor: "#facc15",
            borderWidth: 1,
            borderRadius: 3,
            order: 4
          },
          {
            type: "line",
            label: "SXH 2025 (Cùng kỳ)",
            data: [],
            borderColor: "#06b6d4",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 2,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: false,
            order: 2
          },
          {
            type: "line",
            label: "Tổng ca mắc 2026",
            data: [],
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#f59e0b",
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
            display: false // Sử dụng legend pills tùy biến phía trên
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function(context) {
                if (context.parsed.y === null || context.parsed.y === undefined) return "";
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
        labels: ["Sốt xuất huyết Dengue", "Tay chân miệng (TCM)", "Bệnh khác"],
        datasets: [{
          data: [15020, 4719, 0],
          backgroundColor: [
            "#f97316", // SXH: Cam
            "#facc15", // TCM: Vàng chanh
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

  // Chart 3: So sánh ca bệnh theo Địa bàn (Horizontal Stacked Bar Chart)
  const ctxGuestDistricts = document.getElementById("guest-chart-districts");
  if (ctxGuestDistricts) {
    state.guestCharts.districts = new Chart(ctxGuestDistricts, {
      type: "bar",
      data: {
        labels: [],
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
            ticks: { color: "#f8fafc", font: { size: 10, weight: "500" } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

// Tự động trích xuất và tính toán 12 tháng từ dữ liệu vĩ mô CDC (có cơ chế dự phòng fail-safe)
function getMonthlyTrendsData(macro) {
  if (macro && Array.isArray(macro.monthlyTrends2026) && macro.monthlyTrends2026.length === 12) {
    return macro.monthlyTrends2026;
  }
  const wt = (macro && macro.weeklyTrends) ? macro.weeklyTrends : [];
  const monthRanges = [
    { label: "Tháng 1", weeks: [1, 2, 3, 4] },
    { label: "Tháng 2", weeks: [5, 6, 7, 8] },
    { label: "Tháng 3", weeks: [9, 10, 11, 12, 13] },
    { label: "Tháng 4", weeks: [14, 15, 16, 17] },
    { label: "Tháng 5", weeks: [18, 19, 20, 21] },
    { label: "Tháng 6", weeks: [22, 23, 24, 25, 26] },
    { label: "Tháng 7", weeks: [27, 28, 29, 30] },
    { label: "Tháng 8", weeks: [31, 32, 33, 34, 35] },
    { label: "Tháng 9", weeks: [36, 37, 38, 39] },
    { label: "Tháng 10", weeks: [40, 41, 42, 43, 44] },
    { label: "Tháng 11", weeks: [45, 46, 47, 48] },
    { label: "Tháng 12", weeks: [49, 50, 51, 52] }
  ];
  let prev2025 = 0;
  return monthRanges.map(mr => {
    const wItems = mr.weeks.map(w => wt[w - 1]).filter(Boolean);
    const sxh = wItems.reduce((acc, cur) => acc + (cur.sxh_2026 || 0), 0);
    const tcm = wItems.reduce((acc, cur) => acc + (cur.tcm_2026 || 0), 0);
    const lastItem = wItems[wItems.length - 1];
    const cum2025 = lastItem ? (lastItem.sxh_2025 || 0) : 0;
    const sxh2025 = Math.max(0, cum2025 - prev2025);
    if (cum2025 > 0) prev2025 = cum2025;
    return {
      month: mr.label,
      sxh_2026: sxh,
      tcm_2026: tcm,
      sxh_2025: sxh2025,
      total_2026: sxh + tcm
    };
  });
}

// Chuyển đổi chế độ xem Đường cong Dịch tễ (52 tuần vs Theo Tháng)
window.setGuestTrendMode = function(mode) {
  state.guestTrendMode = mode || "week";
  const btnWeek = document.getElementById("btn-trend-week");
  const btnMonth = document.getElementById("btn-trend-month");
  if (btnWeek) btnWeek.classList.toggle("active", state.guestTrendMode === "week");
  if (btnMonth) btnMonth.classList.toggle("active", state.guestTrendMode === "month");

  const titleEl = document.getElementById("guest-trend-title");
  const tagEl = document.getElementById("guest-trend-tag");
  const subEl = document.getElementById("guest-trend-subtitle");

  if (state.guestTrendMode === "week") {
    if (titleEl) titleEl.innerText = "Diễn Biến 52 Tuần Dịch Tễ Năm 2026 vs Cùng Kỳ 2025";
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-chart-line" style="color:#f97316;"></i> ĐƯỜNG CONG DỊCH TỄ (52 TUẦN DỊCH TỄ)';
    if (subEl) subEl.innerText = "Hiển thị chi tiết số ca mắc mới ghi nhận từng tuần (Tuần 1 đến Tuần 48)";
  } else {
    if (titleEl) titleEl.innerText = "Tổng Hợp Ca Mắc Theo Tháng (12 Tháng Năm 2026)";
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-calendar-days" style="color:#0ea5e9;"></i> TỔNG HỢP THEO THÁNG (12 THÁNG NĂM 2026)';
    if (subEl) subEl.innerText = "Số liệu ca bệnh tổng hợp theo 12 tháng dương lịch (Đỉnh dịch Tháng 11: 7.812 ca)";
  }
  updateGuestTrendChart(state.guestTrendMode);
};

function updateGuestTrendChart(mode = "week") {
  if (!state.guestCharts || !state.guestCharts.trend) {
    initGuestCharts();
    if (!state.guestCharts || !state.guestCharts.trend) return;
  }
  const macro = window.CDC_2026_MACRO_DATA;
  const chart = state.guestCharts.trend;

  if (mode === "week" && macro && macro.weeklyTrends) {
    const wt = macro.weeklyTrends;
    chart.data.labels = wt.map(w => w.label || ("Tuần " + String(w.week || "").replace("T", "")));
    chart.data.datasets[0].data = wt.map(w => w.sxh_2026 || 0);
    chart.data.datasets[0].barPercentage = 0.95;
    chart.data.datasets[1].data = wt.map(w => w.tcm_2026 || 0);
    chart.data.datasets[1].barPercentage = 0.95;
    chart.data.datasets[2].data = wt.map(w => w.sxh_2025 || 0);
    chart.data.datasets[3].data = wt.map(w => w.total_2026 || 0);
    chart.update();
  } else if (mode === "month" && macro) {
    const mt = getMonthlyTrendsData(macro);
    chart.data.labels = mt.map(m => String(m.month || "").replace("Tháng 0", "Tháng "));
    chart.data.datasets[0].data = mt.map(m => m.sxh_2026 || 0);
    chart.data.datasets[0].barPercentage = 0.65;
    chart.data.datasets[1].data = mt.map(m => m.tcm_2026 || 0);
    chart.data.datasets[1].barPercentage = 0.65;
    chart.data.datasets[2].data = mt.map(m => m.sxh_2025 || 0);
    chart.data.datasets[3].data = mt.map(m => m.total_2026 || 0);
    chart.update();
  } else {
    // FALLBACK KHI NẠP FILE EXCEL TÙY BIẾN
    if (mode === "week") {
      const weekSXH = Array(52).fill(0);
      const weekTCM = Array(52).fill(0);
      const weekTotal = Array(52).fill(0);
      const labels = [];
      for (let w = 1; w <= 52; w++) labels.push("Tuần " + w);

      state.rawCases.forEach(c => {
        if (c.dt) {
          const d = new Date(c.dt);
          if (!isNaN(d.getTime())) {
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            const wNum = Math.min(52, Math.max(1, Math.ceil((((d - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7)));
            weekTotal[wNum - 1]++;
            if (c.grp === "SXH") weekSXH[wNum - 1]++;
            else if (c.grp === "TCM") weekTCM[wNum - 1]++;
          }
        }
      });

      chart.data.labels = labels;
      chart.data.datasets[0].data = weekSXH;
      chart.data.datasets[0].barPercentage = 0.95;
      chart.data.datasets[1].data = weekTCM;
      chart.data.datasets[1].barPercentage = 0.95;
      chart.data.datasets[2].data = labels.map(() => null);
      chart.data.datasets[3].data = weekTotal;
      chart.update();
    } else {
      const sxhMap = {};
      const tcmMap = {};
      const totalMap = {};
      const months = state.allMonths && state.allMonths.length > 0
        ? state.allMonths
        : ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
      months.forEach(m => {
        sxhMap[m] = 0;
        tcmMap[m] = 0;
        totalMap[m] = 0;
      });

      state.rawCases.forEach(c => {
        if (c.dt && c.dt.length >= 7) {
          const m = c.dt.substring(0, 7);
          if (totalMap[m] !== undefined) {
            totalMap[m]++;
            if (c.grp === "SXH") sxhMap[m]++;
            else if (c.grp === "TCM") tcmMap[m]++;
          }
        }
      });

      chart.data.labels = months.map(m => m.includes("-") ? (m.substring(5) + "/" + m.substring(2, 4)) : m);
      chart.data.datasets[0].data = months.map(m => sxhMap[m] || 0);
      chart.data.datasets[0].barPercentage = 0.65;
      chart.data.datasets[1].data = months.map(m => tcmMap[m] || 0);
      chart.data.datasets[1].barPercentage = 0.65;
      chart.data.datasets[2].data = months.map(() => null);
      chart.data.datasets[3].data = months.map(m => totalMap[m] || 0);
      chart.update();
    }
  }
}

function updateGuestDashboard() {
  const macro = window.CDC_2026_MACRO_DATA;
  const isAuth = window.authService && window.authService.isAuthenticated();

  // 1. NẾU CÓ DỮ LIỆU CHUẨN CDC 2026 TỪ GOOGLE SHEET VÀ CHƯA NẠP FILE RIÊNG
  if (macro && macro.kpis && !state.isCustomExcelLoaded) {
    const kpis = macro.kpis;
    const elTotal = document.getElementById("guest-kpi-total");
    const elW48Total = document.getElementById("guest-kpi-w48-total");
    const elSxh = document.getElementById("guest-kpi-sxh");
    const elW48Sxh = document.getElementById("guest-kpi-w48-sxh");
    const elTcm = document.getElementById("guest-kpi-tcm");
    const elW48Tcm = document.getElementById("guest-kpi-w48-tcm");
    const elOdn = document.getElementById("guest-kpi-odn");
    const elW48Odn = document.getElementById("guest-kpi-w48-odn");
    const elRate = document.getElementById("guest-kpi-rate");
    const elDeaths = document.getElementById("guest-kpi-deaths");

    if (elTotal) elTotal.innerText = (kpis.totalCases2026 || 19739).toLocaleString("vi-VN");
    if (elW48Total) elW48Total.innerText = (kpis.totalThisWeek || 2115).toLocaleString("vi-VN");
    if (elSxh) elSxh.innerText = (kpis.sxh?.total2026 || 15020).toLocaleString("vi-VN");
    if (elW48Sxh) elW48Sxh.innerText = (kpis.sxh?.thisWeek || 2078).toLocaleString("vi-VN");
    if (elTcm) elTcm.innerText = (kpis.tcm?.total2026 || 4719).toLocaleString("vi-VN");
    if (elW48Tcm) elW48Tcm.innerText = (kpis.tcm?.thisWeek || 37).toLocaleString("vi-VN");
    if (elOdn) elOdn.innerText = (kpis.odnSummary?.total || 937).toLocaleString("vi-VN");
    if (elW48Odn) elW48Odn.innerText = (kpis.odnSummary?.thisWeek || 55).toLocaleString("vi-VN");
    if (elRate) elRate.innerText = (kpis.incidenceRatePer100k || 688.7).toLocaleString("vi-VN");
    if (elDeaths) elDeaths.innerText = (kpis.totalDeaths || 0) + " ca (0,0%)";

    // Cập nhật Biểu đồ Đường cong Dịch tễ
    updateGuestTrendChart(state.guestTrendMode || "week");

    // Cập nhật Biểu đồ Cơ cấu bệnh (SXH: 15.020, TCM: 4.719)
    if (state.guestCharts && state.guestCharts.disease) {
      state.guestCharts.disease.data.labels = ["Sốt xuất huyết Dengue", "Tay chân miệng (TCM)", "Bệnh khác"];
      state.guestCharts.disease.data.datasets[0].data = [
        kpis.sxh?.total2026 || 15020,
        kpis.tcm?.total2026 || 4719,
        0
      ];
      state.guestCharts.disease.update();
    }

    // Cập nhật Điểm Nóng Dịch Tễ Tuần 48
    renderGuestHotspots(macro.hotspots);

    // Cập nhật 15 Khu vực theo dữ liệu 94 Xã/Phường
    updateGuestDistrictsAnalysisFromMacro(macro);
    return;
  }

  // 2. FALLBACK CHO TRƯỜNG HỢP NẠP FILE EXCEL TÙY BIẾN
  const cases = (!isAuth) ? state.rawCases : (state.filteredCases || state.rawCases);
  const total = cases.length;

  let sxh = 0;
  let tcm = 0;
  let cum = 0;
  let other = 0;

  cases.forEach(c => {
    if (c.grp === "SXH") sxh++;
    else if (c.grp === "TCM") tcm++;
    else if (c.grp === "CUM") cum++;
    else other++;
  });

  const elTotal = document.getElementById("guest-kpi-total");
  const elSxh = document.getElementById("guest-kpi-sxh");
  const elTcm = document.getElementById("guest-kpi-tcm");
  if (elTotal) elTotal.innerText = total.toLocaleString("vi-VN");
  if (elSxh) elSxh.innerText = sxh.toLocaleString("vi-VN");
  if (elTcm) elTcm.innerText = tcm.toLocaleString("vi-VN");

  updateGuestTrendChart("month");

  if (state.guestCharts && state.guestCharts.disease) {
    state.guestCharts.disease.data.labels = ["Sốt xuất huyết Dengue", "Tay chân miệng (TCM)", "Bệnh khác"];
    state.guestCharts.disease.data.datasets[0].data = [sxh, tcm, other];
    state.guestCharts.disease.update();
  }

  updateGuestDistrictsAnalysis(cases, total);
}

function renderGuestHotspots(hotspots) {
  if (!hotspots) return;
  const listCases = document.getElementById("hotspot-list-cases");
  const listRates = document.getElementById("hotspot-list-rates");

  if (listCases && hotspots.sxhTopCases) {
    listCases.innerHTML = hotspots.sxhTopCases.slice(0, 5).map((item, idx) => `
      <div class="hotspot-item">
        <span class="hotspot-rank rank-${idx + 1}">${idx + 1}</span>
        <div class="hotspot-info">
          <div class="hotspot-name">${item.ward} <span class="hotspot-district">${item.district}</span></div>
          <div class="hotspot-metric"><b style="color:#ef4444;">${item.cases} ca</b> mới • Tỷ lệ: ${item.rate.toLocaleString("vi-VN")} /100k</div>
        </div>
      </div>
    `).join("");
  }

  if (listRates && hotspots.sxhTopRates) {
    listRates.innerHTML = hotspots.sxhTopRates.slice(0, 5).map((item, idx) => `
      <div class="hotspot-item">
        <span class="hotspot-rank rank-${idx + 1}">${idx + 1}</span>
        <div class="hotspot-info">
          <div class="hotspot-name">${item.ward} <span class="hotspot-district">${item.district}</span></div>
          <div class="hotspot-metric"><b style="color:#38bdf8;">${item.rate.toLocaleString("vi-VN")}</b> /100k • ${item.cases} ca tích lũy</div>
        </div>
      </div>
    `).join("");
  }
}

// ============================================================================
// DANH MỤC 15 KHU VỰC ĐỊA BÀN TOÀN THÀNH PHỐ & VÙNG MỞ RỘNG (94 TRẠM Y TẾ)
// ============================================================================
const EPIDEMIOLOGY_REGIONS = [
  {
    id: "lienchieu",
    name: "Quận Liên Chiểu",
    shortName: "Liên Chiểu",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["liên chiểu", "hòa khánh", "hòa minh", "hải vân", "hòa hiệp"]
  },
  {
    id: "thanhkhe",
    name: "Quận Thanh Khê",
    shortName: "Thanh Khê",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["thanh khê", "an khê", "tam thuận", "xuân hà", "tân chính", "chính gián", "vĩnh trung", "thạc gián"]
  },
  {
    id: "dienban",
    name: "Thị xã Điện Bàn",
    shortName: "TX. Điện Bàn",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["điện bàn", "gò nổi", "vĩnh điện", "điện ngọc", "điện nam", "điện dương", "điện tiến", "điện hồng", "điện thọ", "điện phước", "điện an", "điện trung", "điện quang", "điện phong", "điện minh", "điện phương"]
  },
  {
    id: "duyxuyen",
    name: "Huyện Duy Xuyên",
    shortName: "H. Duy Xuyên",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["duy xuyên", "nam phước", "duy nghĩa", "thu bồn", "xuân phú", "duy hải", "duy vinh", "duy phước", "duy thành", "duy trung", "duy sơn", "duy trinh", "duy châu", "duy hòa", "duy tân", "duy phú"]
  },
  {
    id: "thangbinh",
    name: "Huyện Thăng Bình",
    shortName: "H. Thăng Bình",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["thăng bình", "thăng an", "thăng điền", "thăng trường", "thăng phú", "an thắng", "đồng dương", "thạnh bình", "hà lam", "bình minh", "bình đào", "bình triều", "bình giang", "bình phục", "bình nguyên", "bình tú", "bình sa", "bình hải", "bình quế", "bình phú", "bình định", "bình quý", "bình chánh", "bình trung", "bình an", "bình nam"]
  },
  {
    id: "tamky_nuithanh",
    name: "TP. Tam Kỳ & Núi Thành",
    shortName: "Tam Kỳ - Núi Thành",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["tam kỳ", "hương trà", "bàn thạch", "chiên đàn", "an mỹ", "an xuân", "an sơn", "hòa hương", "phước hòa", "an phú", "trường xuân", "tân thạnh", "núi thành", "tam xuân", "tam anh", "tam mỹ", "tam hải", "tam quang", "tam nghĩa", "tam hiệp", "tam giang", "tam hòa", "tam tiến", "tây hồ", "quảng phú", "phú ninh"]
  },
  {
    id: "camle",
    name: "Quận Cẩm Lệ",
    shortName: "Cẩm Lệ",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["cẩm lệ", "hòa xuân", "khuê trung", "hòa thọ", "hòa phát", "hòa an"]
  },
  {
    id: "sontra",
    name: "Quận Sơn Trà",
    shortName: "Sơn Trà",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["sơn trà", "an hải", "phước mỹ", "nại hiên đông", "thọ quang", "mân thái"]
  },
  {
    id: "hoian",
    name: "TP. Hội An",
    shortName: "TP. Hội An",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["hội an", "minh an", "cẩm phô", "sơn phong", "thanh hà", "cẩm châu", "cẩm an", "cửa đại", "cẩm hà", "cẩm thanh", "cẩm kim", "tân hiệp", "cù lao chàm"]
  },
  {
    id: "nguhanhson",
    name: "Quận Ngũ Hành Sơn",
    shortName: "Ngũ Hành Sơn",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["ngũ hành sơn", "hòa hải", "hòa quý", "khuê mỹ", "mỹ an"]
  },
  {
    id: "haichau",
    name: "Quận Hải Châu",
    shortName: "Hải Châu",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["hải châu", "hòa cường", "thạch thang", "thuận phước", "thanh bình", "bình hiên", "bình thuận", "nam dương", "phước ninh"]
  },
  {
    id: "hoavang",
    name: "Huyện Hòa Vang",
    shortName: "Hòa Vang",
    type: "central",
    badgeText: "Trung tâm TP",
    kw: ["hòa vang", "hòa tiến", "bà nà", "hòa châu", "hòa phước", "hòa khương", "hòa nhơn", "hòa phong", "hòa sơn", "hòa ninh", "hòa liên", "hòa bắc", "hòa phú"]
  },
  {
    id: "queson",
    name: "Huyện Quế Sơn & Nông Sơn",
    shortName: "Quế Sơn - Nông Sơn",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["quế sơn", "quế phước", "nông sơn", "đông phú", "hương an", "quế xuân", "quế phú", "quế hiệp", "quế thuận", "quế mỹ", "quế châu", "quế phong", "quế long", "quế lộc", "quế trung", "ninh phước", "phước ninh"]
  },
  {
    id: "dailoc",
    name: "Huyện Đại Lộc",
    shortName: "H. Đại Lộc",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["đại lộc", "vu gia", "hà nha", "thượng đức", "ái nghĩa", "đại hiệp", "đại nghĩa", "đại an", "đại hòa", "đại phước", "đại quang", "đại đồng", "đại hồng", "đại phong", "đại tân", "đại thắng", "đại chánh", "đại thạnh", "đại cường", "đại minh", "đại lãnh", "đại hưng", "đại sơn"]
  },
  {
    id: "other_expanded",
    name: "Địa Bàn Miền Núi & Lân Cận",
    shortName: "Miền núi & Khác",
    type: "expanded",
    badgeText: "Mở rộng - Sáp nhập",
    kw: ["tiên phước", "thạnh mỹ", "nam giang", "đông giang", "tây giang", "phước sơn", "hiệp đức", "bắc trà my", "nam trà my", "trà my", "khâm đức", "la dêê", "hoàng sa", "bình chương", "bình sơn", "lãnh ngọc", "phú thuận", "sơn cẩm hà", "bến giằng", "vạn tường", "việt an", "trà đốc", "trà leng"]
  }
];
window.EPIDEMIOLOGY_REGIONS = EPIDEMIOLOGY_REGIONS;

function mapWardDistrictToRegionId(districtStr) {
  const d = (districtStr || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/hải châu/i.test(d)) return "haichau";
  if (/thanh khê/i.test(d)) return "thanhkhe";
  if (/sơn trà/i.test(d)) return "sontra";
  if (/ngũ hành sơn/i.test(d)) return "nguhanhson";
  if (/liên chiểu/i.test(d)) return "lienchieu";
  if (/cẩm\s*lệ/i.test(d)) return "camle";
  if (/hòa vang/i.test(d)) return "hoavang";
  if (/điện bàn/i.test(d)) return "dienban";
  if (/hội an/i.test(d)) return "hoian";
  if (/duy xuyên/i.test(d)) return "duyxuyen";
  if (/thăng bình/i.test(d)) return "thangbinh";
  if (/tam kỳ|núi thành|phú ninh/i.test(d)) return "tamky_nuithanh";
  if (/quế sơn|nông sơn/i.test(d)) return "queson";
  if (/đại lộc/i.test(d)) return "dailoc";
  return "other_expanded";
}

function updateGuestDistrictsAnalysisFromMacro(macro) {
  const stats = EPIDEMIOLOGY_REGIONS.map(r => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    type: r.type,
    badgeText: r.badgeText,
    sxh: 0,
    tcm: 0,
    cum: 0,
    other: 0,
    total: 0,
    pop: 0
  }));

  const statsMap = {};
  stats.forEach(st => statsMap[st.id] = st);

  const wards = macro.wards || [];
  wards.forEach(w => {
    const regId = mapWardDistrictToRegionId(w.district);
    const target = statsMap[regId] || statsMap["other_expanded"];
    if (target) {
      target.sxh += (w.sxh_cum || 0);
      target.tcm += (w.tcm_cum || 0);
      target.total += (w.total_cum || 0);
      target.pop += (w.pop || 0);
    }
  });

  state.guestRegionStats = stats;
  state.guestTotalCases = macro.kpis?.totalCases2026 || 19739;
  renderGuestDistrictsView();
}

function updateGuestDistrictsAnalysis(cases, total) {
  const stats = EPIDEMIOLOGY_REGIONS.map(r => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    type: r.type,
    badgeText: r.badgeText,
    kw: r.kw,
    sxh: 0,
    tcm: 0,
    cum: 0,
    other: 0,
    total: 0,
    pop: 0
  }));

  const otherRegionIndex = stats.length - 1;

  cases.forEach(c => {
    const w = (c.w || "").toLowerCase();
    let matched = false;
    for (let i = 0; i < stats.length - 1; i++) {
      if (stats[i].kw.some(k => w.includes(k))) {
        stats[i].total++;
        if (c.grp === "SXH") stats[i].sxh++;
        else if (c.grp === "TCM") stats[i].tcm++;
        else if (c.grp === "CUM") stats[i].cum++;
        else stats[i].other++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      stats[otherRegionIndex].total++;
      if (c.grp === "SXH") stats[otherRegionIndex].sxh++;
      else if (c.grp === "TCM") stats[otherRegionIndex].tcm++;
      else if (c.grp === "CUM") stats[otherRegionIndex].cum++;
      else stats[otherRegionIndex].other++;
    }
  });

  state.guestRegionStats = stats;
  state.guestTotalCases = total;
  renderGuestDistrictsView();
}

window.setGuestDistrictFilter = function(filterType) {
  state.guestDistrictFilter = filterType || "all";
  ["all", "central", "expanded"].forEach(t => {
    const btn = document.getElementById("btn-dtab-" + t);
    if (btn) {
      if (t === state.guestDistrictFilter) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });
  renderGuestDistrictsView();
};

function renderGuestDistrictsView() {
  if (!state.guestRegionStats || state.guestRegionStats.length === 0) return;
  const filter = state.guestDistrictFilter || "all";
  const total = state.guestTotalCases || state.rawCases.length;

  let filtered = state.guestRegionStats.slice();
  if (filter === "central") {
    filtered = filtered.filter(r => r.type === "central");
  } else if (filter === "expanded") {
    filtered = filtered.filter(r => r.type === "expanded");
  }

  // Sắp xếp giảm dần theo tổng ca bệnh
  filtered.sort((a, b) => b.total - a.total);

  // 1. Cập nhật Biểu đồ Thanh ngang Xếp chồng
  if (state.guestCharts && state.guestCharts.districts) {
    state.guestCharts.districts.data.labels = filtered.map(d => d.shortName);
    state.guestCharts.districts.data.datasets[0].data = filtered.map(d => d.sxh);
    state.guestCharts.districts.data.datasets[1].data = filtered.map(d => d.tcm);
    state.guestCharts.districts.data.datasets[2].data = filtered.map(d => d.other || 0);
    state.guestCharts.districts.update("none");
  }

  // 2. Cập nhật Thẻ Cảnh báo Nguy cơ (Heatmap Risk Tiles)
  renderGuestRiskTiles(filtered);

  // 3. Cập nhật Bảng Thống kê Chi tiết
  renderGuestDistrictTable(filtered, total);
}

function renderGuestRiskTiles(stats) {
  const container = document.getElementById("guest-risk-district-grid");
  if (!container) return;

  const maxCases = stats.length > 0 ? Math.max(...stats.map(s => s.total)) : 1;

  let html = "";
  stats.forEach(st => {
    let riskClass = "risk-safe";
    let badgeClass = "badge-safe";
    let badgeText = "Kiểm soát tốt";
    let barColor = "#10b981";

    if (st.total >= 2000 || st.sxh >= 1200) {
      riskClass = "risk-high";
      badgeClass = "badge-high";
      badgeText = "Nguy cơ rất cao";
      barColor = "#ef4444";
    } else if (st.total >= 1500 || st.sxh >= 800) {
      riskClass = "risk-high";
      badgeClass = "badge-high";
      badgeText = "Nguy cơ cao";
      barColor = "#f97316";
    } else if (st.total >= 1000 || st.sxh >= 400) {
      riskClass = "risk-med";
      badgeClass = "badge-med";
      badgeText = "Theo dõi chặt";
      barColor = "#eab308";
    }

    const pctBar = Math.min(100, Math.max(12, Math.round((st.total / maxCases) * 100)));
    const rateText = st.pop > 0 ? ((st.total / st.pop) * 100000).toFixed(1) + " /100k" : "";
    const typeBadge = st.type === "central" 
      ? '<span style="font-size:0.65rem; padding:0.1rem 0.35rem; border-radius:4px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); margin-left:0.35rem;">Trung tâm</span>'
      : '<span style="font-size:0.65rem; padding:0.1rem 0.35rem; border-radius:4px; background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3); margin-left:0.35rem;">Mở rộng</span>';

    html += `
      <div class="district-risk-card ${riskClass}">
        <div class="d-risk-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:0.25rem;">
            <span class="d-name" style="font-weight:600; font-size:0.82rem;">${st.name}</span>
            ${typeBadge}
          </div>
          <span class="d-badge ${badgeClass}" style="font-size:0.68rem; padding:0.15rem 0.45rem;">${badgeText}</span>
        </div>
        <div class="d-numbers" style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:0.25rem;">
          <div><b style="font-size:0.88rem;">${st.total.toLocaleString('vi-VN')}</b> ca bệnh ${rateText ? `<small style="color:var(--text-dim); margin-left:4px;">(${rateText})</small>` : ''}</div>
          <div class="d-sub" style="font-size:0.7rem;">SXH: <b style="color:var(--accent-orange);">${st.sxh.toLocaleString('vi-VN')}</b> | TCM: <b class="val-tcm" style="color:var(--accent-yellow);">${st.tcm.toLocaleString('vi-VN')}</b></div>
        </div>
        <div class="d-bar" style="height:5px; border-radius:3px; overflow:hidden; margin-top:0.25rem;">
          <div style="width:${pctBar}%; height:100%; background:${barColor}; border-radius:3px;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderGuestDistrictTable(stats, total) {
  const tbody = document.getElementById("guest-districts-table-body");
  if (!tbody) return;

  let totalSxh = 0;
  let totalTcm = 0;
  let totalCum = 0;
  let totalOther = 0;
  let totalFiltered = 0;

  let html = "";
  stats.forEach(st => {
    totalSxh += st.sxh;
    totalTcm += st.tcm;
    totalCum += st.cum;
    totalOther += st.other;
    totalFiltered += st.total;

    const pct = total > 0 ? ((st.total / total) * 100).toFixed(1) : "0.0";
    let badgeClass = "badge-safe";
    let badgeText = "Kiểm soát tốt";

    if (st.total >= 2000 || st.sxh >= 1200) {
      badgeClass = "badge-danger";
      badgeText = "Nguy cơ rất cao";
    } else if (st.total >= 1500 || st.sxh >= 800) {
      badgeClass = "badge-danger";
      badgeText = "Nguy cơ cao";
    } else if (st.total >= 1000 || st.sxh >= 400) {
      badgeClass = "badge-warning";
      badgeText = "Theo dõi chặt";
    }

    const typeBadge = st.type === "central" 
      ? '<span style="font-size:0.68rem; padding:0.15rem 0.45rem; border-radius:4px; background:rgba(56,189,248,0.15); color:var(--accent-cyan); border:1px solid rgba(56,189,248,0.3); white-space:nowrap;"><i class="fa-solid fa-city"></i> Trung tâm TP</span>'
      : '<span style="font-size:0.68rem; padding:0.15rem 0.45rem; border-radius:4px; background:rgba(168,85,247,0.15); color:var(--accent-purple); border:1px solid rgba(168,85,247,0.3); white-space:nowrap;"><i class="fa-solid fa-map-pin"></i> Mở rộng - Sáp nhập</span>';

    html += `
      <tr>
        <td class="td-district-name" style="font-weight:600;">
          <i class="fa-solid fa-location-dot" style="color:var(--accent-cyan); margin-right:6px;"></i>
          ${st.name}
        </td>
        <td style="text-align:center;">${typeBadge}</td>
        <td class="td-sxh" style="text-align:right; color:var(--accent-orange); font-weight:600;">${st.sxh.toLocaleString('vi-VN')}</td>
        <td class="td-tcm" style="text-align:right; color:var(--accent-yellow); font-weight:600;">${st.tcm.toLocaleString('vi-VN')}</td>
        <td class="td-cum" style="text-align:right; color:var(--accent-cyan);">${(st.cum || 0).toLocaleString('vi-VN')}</td>
        <td class="td-other" style="text-align:right; color:var(--accent-purple);">${(st.other || 0).toLocaleString('vi-VN')}</td>
        <td class="td-total-cases" style="text-align:right; font-weight:700;">${st.total.toLocaleString('vi-VN')}</td>
        <td style="text-align:center;">
          <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
            <div style="width:70px; height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
              <div style="width:${Math.min(parseFloat(pct) * 5, 100)}%; height:100%; background:var(--accent-cyan);"></div>
            </div>
            <span style="font-size:0.72rem; color:var(--text-muted); min-width:32px;">${pct}%</span>
          </div>
        </td>
        <td style="text-align:center;">
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </td>
      </tr>
    `;
  });

  // Hàng tổng kết nếu hiển thị toàn bộ
  const filter = state.guestDistrictFilter || "all";
  if (filter === "all") {
    html += `
      <tr class="table-summary-row" style="font-weight:700;">
        <td style="color:var(--accent-cyan);">
          <i class="fa-solid fa-calculator" style="margin-right:6px;"></i> TỔNG CỘNG TOÀN ĐỊA BÀN
        </td>
        <td style="text-align:center;">
          <span style="font-size:0.68rem; padding:0.15rem 0.45rem; border-radius:4px; background:rgba(56,189,248,0.15); color:var(--accent-cyan); border:1px solid rgba(56,189,248,0.4);">
            15 Khu vực (94 TYT)
          </span>
        </td>
        <td class="sum-sxh" style="text-align:right; color:var(--accent-orange);">${totalSxh.toLocaleString('vi-VN')}</td>
        <td class="sum-tcm" style="text-align:right; color:var(--accent-yellow);">${totalTcm.toLocaleString('vi-VN')}</td>
        <td class="sum-cum" style="text-align:right; color:var(--accent-cyan);">${totalCum.toLocaleString('vi-VN')}</td>
        <td class="sum-other" style="text-align:right; color:var(--accent-purple);">${totalOther.toLocaleString('vi-VN')}</td>
        <td class="sum-total" style="text-align:right; color:var(--accent-cyan); font-size:0.92rem;">${totalFiltered.toLocaleString('vi-VN')}</td>
        <td style="text-align:center; color:var(--accent-cyan);">100.0%</td>
        <td style="text-align:center;">
          <span class="status-badge badge-warning" style="background:rgba(56,189,248,0.15); color:var(--accent-cyan); border-color:rgba(56,189,248,0.4);">
            Toàn hệ thống
          </span>
        </td>
      </tr>
    `;
  }

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
  const viewToggle = document.getElementById("view-mode-toggle");
  const btnViewMap = document.getElementById("btn-view-map");
  const btnViewDash = document.getElementById("btn-view-dashboard");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");

  if (!isAuth) {
    // CHẾ ĐỘ KHÁCH: KHÔNG CÓ BẢN ĐỒ, KHÔNG CHO PHÉP ZOOM
    if (viewToggle) viewToggle.style.display = "none";
    if (guestView) guestView.style.display = "block";
    if (mapEl) mapEl.style.display = "none";
    if (layerControl) layerControl.style.display = "none";
    if (mapLegend) mapLegend.style.display = "none";
    if (timeDock) timeDock.style.display = "none";
    if (simBanner) simBanner.style.display = "none";
    if (btnSim) btnSim.style.display = "none";
    if (btnUpload) btnUpload.style.display = "none";
    if (sidebarToggle) sidebarToggle.style.display = "none";
    if (sidebar) sidebar.style.display = "none";

    // XÓA TOÀN BỘ CÁC ĐIỂM / LỚP TRÊN BẢN ĐỒ ĐỂ TUYỆT ĐỐI BẢO MẬT
    if (layerGroups.caseMarkers) layerGroups.caseMarkers.clearLayers();
    if (layerGroups.bufferZone) layerGroups.bufferZone.clearLayers();
    if (layerGroups.heatmap) layerGroups.heatmap.clearLayers();

    // Cập nhật thông tin tổng quan ca bệnh Đà Nẵng
    updateGuestDashboard();
  } else {
    // CHẾ ĐỘ ĐÃ ĐĂNG NHẬP (ADMIN HOẶC TRẠM Y TẾ): HIỆN BỘ CHUYỂN GÓC NHÌN & MỞ KHÓA BẢN ĐỒ GIS
    if (viewToggle) viewToggle.style.display = "inline-flex";
    if (btnViewMap) btnViewMap.classList.add("active");
    if (btnViewDash) btnViewDash.classList.remove("active");

    if (guestView) guestView.style.display = "none";
    if (mapEl) mapEl.style.display = "block";
    if (layerControl) layerControl.style.display = "block";
    if (mapLegend) mapLegend.style.display = "block";
    if (timeDock) timeDock.style.display = "block";
    if (sidebarToggle) sidebarToggle.style.display = "";
    if (sidebar) sidebar.style.display = "";

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

// Chuyển đổi giữa góc nhìn Bản đồ GIS và Dashboard Trang chủ khi đã đăng nhập
function switchMainView(view) {
  const isAuth = window.authService && window.authService.isAuthenticated();
  if (!isAuth) return;

  const btnMap = document.getElementById("btn-view-map");
  const btnDash = document.getElementById("btn-view-dashboard");
  const guestView = document.getElementById("guest-view");
  const mapEl = document.getElementById("map");
  const layerControl = document.getElementById("gis-layer-control");
  const mapLegend = document.getElementById("gis-map-legend");
  const timeDock = document.getElementById("gis-time-dock");

  if (view === "dashboard") {
    if (btnDash) btnDash.classList.add("active");
    if (btnMap) btnMap.classList.remove("active");

    if (guestView) guestView.style.display = "block";
    if (mapEl) mapEl.style.display = "none";
    if (layerControl) layerControl.style.display = "none";
    if (mapLegend) mapLegend.style.display = "none";
    if (timeDock) timeDock.style.display = "none";

    updateGuestDashboard();
  } else {
    if (btnMap) btnMap.classList.add("active");
    if (btnDash) btnDash.classList.remove("active");

    if (guestView) guestView.style.display = "none";
    if (mapEl) mapEl.style.display = "block";
    if (layerControl) layerControl.style.display = "block";
    if (mapLegend) mapLegend.style.display = "block";
    if (timeDock) timeDock.style.display = "block";

    if (map) {
      setTimeout(() => {
        try {
          map.invalidateSize();
          updateEpidemiologyLayers();
        } catch (err) {
          console.warn("Lỗi refresh Leaflet map:", err);
        }
      }, 100);
    }
  }
}
window.switchMainView = switchMainView;

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
  // Sidebar Toggle (Tự động thu gọn trên mobile <= 768px để không che khuất màn hình)
  const toggleBtn = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    if (window.innerWidth <= 768) {
      sidebar.classList.add("collapsed");
      toggleBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    }
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      toggleBtn.innerHTML = sidebar.classList.contains("collapsed") 
        ? `<i class="fa-solid fa-chevron-right"></i>` 
        : `<i class="fa-solid fa-chevron-left"></i>`;
      setTimeout(() => { if (map) map.invalidateSize(); }, 350);
    });
  }

  // Nút chuyển đổi chế độ xem Đường cong Dịch tễ (52 tuần vs Theo Tháng)
  const btnTrendWeek = document.getElementById("btn-trend-week");
  const btnTrendMonth = document.getElementById("btn-trend-month");
  if (btnTrendWeek) {
    btnTrendWeek.addEventListener("click", (e) => {
      e.preventDefault();
      setGuestTrendMode("week");
    });
  }
  if (btnTrendMonth) {
    btnTrendMonth.addEventListener("click", (e) => {
      e.preventDefault();
      setGuestTrendMode("month");
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
      updateUploadStatusBanner();
      initGSheetFormValues();
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

// ============================================================================
// QUẢN LÝ TRẠNG THÁI NGUỒN DỮ LIỆU DỊCH TỄ TÙY CHỈNH (INDEXEDDB & GOOGLE SHEETS)
// ============================================================================
function updateUploadStatusBanner() {
  const statusEl = document.getElementById("data-source-status");
  const btnReset = document.getElementById("btn-reset-default-data");
  if (!statusEl) return;

  const count = (state.rawCases || []).length.toLocaleString("vi-VN");
  if (state.isCustomExcelLoaded) {
    const isGSheet = state.customMeta && state.customMeta.source === "gsheet";
    const icon = isGSheet ? "fa-table" : "fa-file-excel";
    const color = isGSheet ? "#0284c7" : "#10b981";
    const title = isGSheet ? "Google Sheets Trực Tuyến" : "File Excel tùy chỉnh";
    statusEl.innerHTML = `<span style="color:#34d399; font-weight:600;"><i class="fa-solid ${icon}" style="color:${color}; margin-right:0.35rem;"></i>Đang dùng: ${title} (${count} ca bệnh)</span>`;
    if (btnReset) btnReset.style.display = "inline-flex";
  } else {
    statusEl.innerHTML = `<span style="color:#94a3b8;"><i class="fa-solid fa-database" style="color:var(--accent-cyan); margin-right:0.35rem;"></i>Đang dùng: Bộ dữ liệu gốc hệ thống (${count} ca bệnh)</span>`;
    if (btnReset) btnReset.style.display = "none";
  }
}
window.updateUploadStatusBanner = updateUploadStatusBanner;

// Chuyển đổi tab trong modal nạp dữ liệu
function switchUploadTab(tab) {
  const tabExcel = document.getElementById("upload-tab-excel");
  const tabGSheet = document.getElementById("upload-tab-gsheet");
  const btnExcel = document.getElementById("tab-btn-excel");
  const btnGSheet = document.getElementById("tab-btn-gsheet");
  const msgEl = document.getElementById("excel-upload-msg");
  if (msgEl) msgEl.style.display = "none";

  if (tab === "gsheet") {
    if (tabExcel) tabExcel.style.display = "none";
    if (tabGSheet) tabGSheet.style.display = "block";
    if (btnExcel) btnExcel.classList.remove("active");
    if (btnGSheet) btnGSheet.classList.add("active");
  } else {
    if (tabExcel) tabExcel.style.display = "block";
    if (tabGSheet) tabGSheet.style.display = "none";
    if (btnExcel) btnExcel.classList.add("active");
    if (btnGSheet) btnGSheet.classList.remove("active");
  }
}
window.switchUploadTab = switchUploadTab;

// Nạp giá trị lưu trữ của Google Sheets vào form modal
function initGSheetFormValues() {
  const urlInput = document.getElementById("gsheet-url-input");
  const chkAuto = document.getElementById("chk-gsheet-autosync");
  if (urlInput) {
    urlInput.value = localStorage.getItem("CDC_GSHEET_URL") || "";
  }
  if (chkAuto) {
    chkAuto.checked = localStorage.getItem("CDC_GSHEET_AUTOSYNC") === "true";
  }
}
window.initGSheetFormValues = initGSheetFormValues;

// Hàm chuẩn hóa các hàng dữ liệu ca bệnh từ file Excel hoặc Google Sheets
function normalizeCaseRows(jsonData) {
  return jsonData.map((row, idx) => {
    const id = row["id"] || row["ID"] || row["Mã ca"] || row["Mã"] || row["STT"] || (idx + 1);
    const d_name = String(row["d_name"] || row["Tên bệnh"] || row["Bệnh"] || row["Chẩn đoán"] || "Sốt xuất huyết Dengue").trim();

    // Tự động nhận diện nhóm bệnh
    let grp = String(row["grp"] || row["Nhóm bệnh"] || row["Mã nhóm"] || "").trim().toUpperCase();
    if (!grp) {
      const dLower = d_name.toLowerCase();
      if (dLower.includes("sốt xuất huyết") || dLower.includes("dengue")) grp = "SXH";
      else if (dLower.includes("chân miệng") || dLower.includes("tay chân miệng") || dLower.includes("tcm")) grp = "TCM";
      else if (dLower.includes("cúm") || dLower.includes("hội chứng cúm")) grp = "CUM";
      else if (dLower.includes("lao")) grp = "LAO";
      else if (dLower.includes("sởi")) grp = "SOI";
      else if (dLower.includes("sốt rét")) grp = "SOT_RET";
      else if (dLower.includes("viêm gan")) grp = "VIEM_GAN";
      else if (dLower.includes("thủy đậu")) grp = "THUY_DAU";
      else if (dLower.includes("dại")) grp = "DAI";
      else grp = "KHAC";
    }

    const type = String(row["type"] || row["Loại chẩn đoán"] || row["Chẩn đoán"] || "Xác định phòng xét nghiệm").trim();
    const st = String(row["st"] || row["Tình trạng"] || row["Tình trạng điều trị"] || "Điều trị ngoại trú").trim();

    // Xã / Phường
    let w = String(row["w"] || row["Xã/Phường"] || row["Xã phường"] || row["Phường/Xã"] || row["Phường"] || row["Xã"] || row["Địa bàn"] || "").trim();
    if (!w) w = "Phường Hải Châu";

    // Ngày tháng
    let rawDate = row["dt"] || row["Ngày mắc"] || row["Ngày chẩn đoán"] || row["Ngày báo cáo"] || row["Ngày"] || "";
    let dt = "";
    if (rawDate instanceof Date) {
      const yyyy = rawDate.getFullYear();
      const mm = String(rawDate.getMonth() + 1).padStart(2, "0");
      const dd = String(rawDate.getDate()).padStart(2, "0");
      dt = `${yyyy}-${mm}-${dd}`;
    } else if (typeof rawDate === "number") {
      const d = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dt = `${yyyy}-${mm}-${dd}`;
    } else {
      dt = String(rawDate).trim();
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dt)) {
        const parts = dt.split("/");
        dt = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    if (!dt || dt.length < 7) {
      const now = new Date();
      dt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    // Tọa độ Lat / Lng
    let lat = parseFloat(row["lat"] || row["Vĩ độ"] || row["Latitude"] || 0);
    let lng = parseFloat(row["lng"] || row["Kinh độ"] || row["Longitude"] || 0);
    if (!lat || isNaN(lat) || !lng || isNaN(lng) || lat < 14 || lat > 18 || lng < 106 || lng > 110) {
      const facilityMatch = (window.DANANG_FACILITIES || []).find(f => f.ward && f.ward.toLowerCase() === w.toLowerCase());
      if (facilityMatch && facilityMatch.lat && facilityMatch.lng) {
        const jitterLat = (Math.random() - 0.5) * 0.008;
        const jitterLng = (Math.random() - 0.5) * 0.008;
        lat = Number((facilityMatch.lat + jitterLat).toFixed(6));
        lng = Number((facilityMatch.lng + jitterLng).toFixed(6));
      } else {
        const jitterLat = (Math.random() - 0.5) * 0.015;
        const jitterLng = (Math.random() - 0.5) * 0.015;
        lat = Number((16.0544 + jitterLat).toFixed(6));
        lng = Number((108.2022 + jitterLng).toFixed(6));
      }
    }

    const gen = String(row["gen"] || row["Giới tính"] || "Nam").trim();
    const yob = String(row["yob"] || row["Năm sinh"] || row["Tuổi"] || "").trim();
    const fac = String(row["fac"] || row["Cơ sở y tế"] || row["Bệnh viện"] || row["Nơi điều trị"] || "").trim();
    const rc = parseInt(row["rc"] || 0);

    return { id, d_name, grp, type, st, w, dt, lat, lng, gen, yob, fac, rc };
  });
}

// Cập nhật bộ dữ liệu mới vào State, IndexedDB và làm mới toàn bộ giao diện
async function applyNewDataset(newCases, meta = {}) {
  // 1. Lưu trữ bền vững vào IndexedDB (dung lượng > 5MB an toàn)
  await saveCustomCasesToIDB(newCases, meta);
  state.isCustomExcelLoaded = true;
  state.customMeta = meta;
  state.rawCases = newCases;

  // 2. Cập nhật danh sách tháng
  const monthsSet = new Set(newCases.map(c => c.dt ? c.dt.substring(0, 7) : "").filter(m => /^\d{4}-\d{2}$/.test(m)));
  if (monthsSet.size > 0) {
    state.allMonths = Array.from(monthsSet).sort();
    state.activeMonthIndex = state.allMonths.length - 1;
    initTimeSliderRange();
  }

  // 3. Đồng bộ giao diện
  populateWardDropdown();
  applyFilters();
  updateGuestDashboard();
  updateUploadStatusBanner();

  // 4. Nếu bản đồ đang mở, cập nhật các lớp bản đồ
  if (map && document.getElementById("map") && document.getElementById("map").style.display !== "none") {
    try {
      updateEpidemiologyLayers();
    } catch (e) {
      console.warn("Lỗi update map layers:", e);
    }
  }
}

// Xử lý nạp file Excel từ máy tính
function processUploadedExcel(file) {
  if (typeof XLSX === "undefined") {
    alert("Thư viện SheetJS chưa được tải.");
    return;
  }

  const msgEl = document.getElementById("excel-upload-msg");
  if (msgEl) {
    msgEl.style.display = "block";
    msgEl.style.background = "rgba(14, 165, 233, 0.2)";
    msgEl.style.border = "1px solid #0ea5e9";
    msgEl.style.color = "#7dd3fc";
    msgEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đọc và phân tích file <b>${file.name}</b>...`;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!jsonData || jsonData.length === 0) {
        throw new Error("File Excel không có dữ liệu hoặc không đọc được các hàng.");
      }

      const newCases = normalizeCaseRows(jsonData);

      await applyNewDataset(newCases, {
        source: "excel",
        fileName: file.name,
        uploadedAt: new Date().toISOString()
      });

      if (msgEl) {
        msgEl.style.display = "block";
        msgEl.style.background = "rgba(16, 185, 129, 0.2)";
        msgEl.style.border = "1px solid #10b981";
        msgEl.style.color = "#6ee7b7";
        msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đã nạp thành công <b>${newCases.length.toLocaleString("vi-VN")}</b> ca bệnh từ file Excel! Đã lưu an toàn vào IndexedDB.`;
      }
    } catch (err) {
      console.error("Lỗi khi xử lý file Excel:", err);
      if (msgEl) {
        msgEl.style.display = "block";
        msgEl.style.background = "rgba(239, 68, 68, 0.2)";
        msgEl.style.border = "1px solid #ef4444";
        msgEl.style.color = "#fca5a5";
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Lỗi khi xử lý file Excel: ${err.message}`;
      }
      alert("Lỗi khi đọc file Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Đồng bộ trực tuyến từ liên kết Google Sheets
async function syncFromGoogleSheets(url, isAuto = false) {
  if (typeof XLSX === "undefined") {
    if (!isAuto) alert("Thư viện SheetJS chưa được tải.");
    return;
  }

  const msgEl = document.getElementById("excel-upload-msg");
  if (msgEl && !isAuto) {
    msgEl.style.display = "block";
    msgEl.style.background = "rgba(14, 165, 233, 0.2)";
    msgEl.style.border = "1px solid #0ea5e9";
    msgEl.style.color = "#7dd3fc";
    msgEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang kết nối và trích xuất dữ liệu từ Google Sheets...`;
  }

  try {
    let csvFetchUrl = "";

    // 1. Kiểm tra dạng Publish to web (/pubhtml hoặc /pub)
    if (url.includes("/pubhtml")) {
      csvFetchUrl = url.replace("/pubhtml", "/pub?output=csv");
    } else if (url.includes("/pub?")) {
      csvFetchUrl = url.includes("output=csv") ? url : `${url}&output=csv`;
    } else {
      // 2. Trích xuất Sheet ID & GID từ link chia sẻ thông thường
      const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch || !idMatch[1]) {
        throw new Error("Không nhận diện được ID bảng tính từ đường dẫn Google Sheets đã nhập.");
      }
      const sheetId = idMatch[1];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : "0";

      // Sử dụng endpoint gviz tqx=out:csv (chuẩn Google Sheets client-side CSV)
      csvFetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    }

    console.log("Đang nạp Google Sheets từ:", csvFetchUrl);
    const resp = await fetch(csvFetchUrl);
    if (!resp.ok) {
      throw new Error(`Máy chủ Google phản hồi mã lỗi ${resp.status} (${resp.statusText}). Vui lòng kiểm tra quyền chia sẻ công khai.`);
    }

    const csvText = await resp.text();
    if (!csvText || csvText.trim().length === 0) {
      throw new Error("Bảng tính Google Sheets trống hoặc không có dòng dữ liệu nào.");
    }

    if (csvText.includes("<!DOCTYPE html") || csvText.includes("<html")) {
      throw new Error("Không thể tải file CSV. Vui lòng đảm bảo bảng tính được chia sẻ ở chế độ: 'Bất kỳ ai có đường liên kết đều xem được'.");
    }

    const workbook = XLSX.read(csvText, { type: "string", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!jsonData || jsonData.length === 0) {
      throw new Error("Không tìm thấy dòng dữ liệu nào trong sheet Google Sheets.");
    }

    const newCases = normalizeCaseRows(jsonData);

    await applyNewDataset(newCases, {
      source: "gsheet",
      sheetUrl: url,
      syncedAt: new Date().toISOString()
    });

    if (msgEl && !isAuto) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(16, 185, 129, 0.2)";
      msgEl.style.border = "1px solid #10b981";
      msgEl.style.color = "#6ee7b7";
      msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đã đồng bộ thành công <b>${newCases.length.toLocaleString("vi-VN")}</b> ca bệnh từ Google Sheets!`;
    }
  } catch (err) {
    console.error("Lỗi đồng bộ Google Sheets:", err);
    if (msgEl && !isAuto) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.style.color = "#fca5a5";
      msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Lỗi đồng bộ: ${err.message}`;
    }
    if (!isAuto) {
      alert("Lỗi đồng bộ Google Sheets: " + err.message);
    }
  }
}
window.syncFromGoogleSheets = syncFromGoogleSheets;

// Xử lý nút bấm "Đồng Bộ Ngay" Google Sheets từ modal
async function handleManualGSheetSync() {
  const urlInput = document.getElementById("gsheet-url-input");
  const chkAuto = document.getElementById("chk-gsheet-autosync");
  const url = urlInput ? urlInput.value.trim() : "";
  if (!url) {
    alert("Vui lòng dán liên kết Google Sheets (chia sẻ công khai hoặc đã xuất bản web)!");
    if (urlInput) urlInput.focus();
    return;
  }

  const isAuto = chkAuto ? chkAuto.checked : false;
  localStorage.setItem("CDC_GSHEET_URL", url);
  localStorage.setItem("CDC_GSHEET_AUTOSYNC", isAuto ? "true" : "false");

  await syncFromGoogleSheets(url, false);
}
window.handleManualGSheetSync = handleManualGSheetSync;

// Khôi phục về bộ dữ liệu mặc định ban đầu
window.resetToDefaultData = async function() {
  if (!confirm("Bạn có chắc chắn muốn xóa dữ liệu tùy chỉnh và quay lại bộ dữ liệu gốc của hệ thống?")) {
    return;
  }
  try {
    localStorage.removeItem("CDC_CUSTOM_EPIDEMIOLOGY_DATA");
    localStorage.removeItem("CDC_GSHEET_AUTOSYNC");
    localStorage.removeItem("CDC_GSHEET_URL");
    await clearCustomCasesFromIDB();
  } catch (e) {
    console.warn("Lỗi xóa dữ liệu tùy chỉnh:", e);
  }
  state.isCustomExcelLoaded = false;
  state.customMeta = null;
  if (window.EPIDEMIOLOGY_DATA && window.EPIDEMIOLOGY_DATA.cases) {
    state.rawCases = window.EPIDEMIOLOGY_DATA.cases;
  } else {
    state.rawCases = [];
  }

  const monthsSet = new Set(state.rawCases.map(c => c.dt ? c.dt.substring(0, 7) : "").filter(m => /^\d{4}-\d{2}$/.test(m)));
  if (monthsSet.size > 0) {
    state.allMonths = Array.from(monthsSet).sort();
    state.activeMonthIndex = state.allMonths.length - 1;
    initTimeSliderRange();
  }

  populateWardDropdown();
  applyFilters();
  updateGuestDashboard();
  updateUploadStatusBanner();

  const msgEl = document.getElementById("excel-upload-msg");
  if (msgEl) {
    msgEl.style.display = "block";
    msgEl.style.background = "rgba(56, 189, 248, 0.2)";
    msgEl.style.border = "1px solid #38bdf8";
    msgEl.style.color = "#bae6fd";
    msgEl.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Đã khôi phục thành công bộ dữ liệu gốc của hệ thống (${state.rawCases.length.toLocaleString("vi-VN")} ca).`;
  }
};

// Xuất file data_epidemiology.js chuẩn hóa toàn hệ thống (1-Click Deploy)
window.exportDataEpidemiologyJs = function() {
  if (!state.rawCases || state.rawCases.length === 0) {
    alert("Không có dữ liệu ca bệnh để xuất!");
    return;
  }

  const cases = state.rawCases;
  const disease_stats = {};
  const diag_type_stats = {};
  const status_stats = {};
  const wardCounts = {};
  const monthlyCounts = {};

  let total_sxh = 0;
  let total_tcm = 0;
  let total_cum = 0;
  let total_lao = 0;
  let total_soi = 0;
  let total_sot_ret = 0;

  cases.forEach(c => {
    // Nhóm bệnh
    const grp = c.grp || "KHAC";
    disease_stats[grp] = (disease_stats[grp] || 0) + 1;
    if (grp === "SXH") total_sxh++;
    else if (grp === "TCM") total_tcm++;
    else if (grp === "CUM") total_cum++;
    else if (grp === "LAO") total_lao++;
    else if (grp === "SOI") total_soi++;
    else if (grp === "SOT_RET") total_sot_ret++;

    // Loại chẩn đoán
    const type = c.type || "Nghi ngờ (lâm sàng)";
    diag_type_stats[type] = (diag_type_stats[type] || 0) + 1;

    // Tình trạng điều trị
    const st = c.st || "Điều trị nội trú";
    status_stats[st] = (status_stats[st] || 0) + 1;

    // Phường xã
    if (c.w) wardCounts[c.w] = (wardCounts[c.w] || 0) + 1;

    // Tháng
    if (c.dt && c.dt.length >= 7) {
      const m = c.dt.substring(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) {
        monthlyCounts[m] = (monthlyCounts[m] || 0) + 1;
      }
    }
  });

  const top_wards = Object.entries(wardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  const monthly_trend = Object.keys(monthlyCounts)
    .sort()
    .map(m => ({ month: m, count: monthlyCounts[m] }));

  const summary = {
    total_cases: cases.length,
    total_sxh,
    total_tcm,
    total_cum,
    total_lao,
    total_soi,
    total_sot_ret,
    disease_stats,
    diag_type_stats,
    status_stats,
    top_wards,
    monthly_trend
  };

  const fileData = {
    summary,
    cases
  };

  const jsContent = "window.EPIDEMIOLOGY_DATA = " + JSON.stringify(fileData) + ";\n";
  const blob = new Blob([jsContent], { type: "application/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data_epidemiology.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(`Đã xuất thành công file data_epidemiology.js (${cases.length.toLocaleString('vi-VN')} ca bệnh).\n\nBạn có thể copy/ghi đè file này vào thư mục dự án và commit lên GitHub để áp dụng vĩnh viễn cho tất cả mọi người dùng trên host!`);
};

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
  const mapEl = document.getElementById("map");
  if (!mapEl || mapEl.style.display === "none" || !user) {
    return; // Không thực hiện flyTo khi bản đồ đang ẩn hoặc chưa đăng nhập
  }

  if (user.role === 'ADMIN') {
    map.flyTo([16.0544, 108.2022], 12, { duration: 1.2 });
    return;
  }

  // Nếu là Trạm Y tế: tìm tọa độ các ca bệnh của phường đó để tính tâm
  const wardCases = state.rawCases.filter(c => c.w === user.ward && typeof c.lat === "number" && !isNaN(c.lat) && typeof c.lng === "number" && !isNaN(c.lng));
  if (wardCases.length > 0) {
    let sumLat = 0, sumLng = 0;
    const sample = wardCases.slice(0, 30);
    sample.forEach(c => {
      sumLat += c.lat;
      sumLng += c.lng;
    });
    const avgLat = sumLat / sample.length;
    const avgLng = sumLng / sample.length;
    if (!isNaN(avgLat) && !isNaN(avgLng)) {
      map.flyTo([avgLat, avgLng], 14, { duration: 1.5 });
      return;
    }
  }

  // Fallback: tìm trong danh mục cơ sở y tế
  const fac = (window.DANANG_FACILITIES || []).find(f => f.ward === user.ward && f.lat && f.lng);
  if (fac) {
    map.flyTo([fac.lat, fac.lng], 14, { duration: 1.5 });
    return;
  }

  map.flyTo([16.0544, 108.2022], 13, { duration: 1.2 });
}

// Lắng nghe sự kiện đăng nhập / đăng xuất để đồng bộ dữ liệu và bản đồ
window.addEventListener('auth:change', (e) => {
  const user = e.detail ? e.detail.user : null;
  if (!user) {
    state.activeDisease = "ALL";
    state.activeDiagType = "ALL";
    state.activeWard = "ALL";
    state.activeStatus = "ALL";
    state.activeMonth = "ALL";
  }
  populateWardDropdown();
  flyToUserArea(user);
  applyFilters();
});
