/**
 * ============================================================================
 * CDC ĐÀ NẴNG - MODULE XÁC THỰC, PHÂN QUYỀN & QUẢN TRỊ TÀI KHOẢN (RBAC)
 * Hoạt động độc lập, bảo mật cao: SHA-256 + Salt, Anti-Brute Force, Session Expiry
 * ============================================================================
 */

const AUTH_STORAGE_KEY = "CDC_EPIDEMIOLOGY_USERS_DB";
const AUTH_SESSION_KEY = "CDC_EPIDEMIOLOGY_SESSION";
const AUTH_ATTEMPTS_KEY = "CDC_AUTH_ATTEMPTS";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // Khóa 5 phút nếu nhập sai quá 5 lần
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;  // Phiên đăng nhập có hiệu lực 8 tiếng

// Danh sách các Xã/Phường trọng điểm của Đà Nẵng để cấp tài khoản
const DANANG_WARDS_LIST = [
  "Phường Hải Châu", "Phường Hòa Cường", "Phường Thạch Thang", "Phường Thuận Phước", "Phường Thanh Bình",
  "Phường Bình Hiên", "Phường Bình Thuận", "Phường Nam Dương", "Phường Thanh Khê", "Phường An Khê",
  "Phường Tam Thuận", "Phường Xuân Hà", "Phường Tân Chính", "Phường Chính Gián", "Phường Vĩnh Trung",
  "Phường Thạc Gián", "Phường Sơn Trà", "Phường An Hải", "Phường Phước Mỹ", "Phường Nại Hiên Đông",
  "Phường Thọ Quang", "Phường Mân Thái", "Phường Ngũ Hành Sơn", "Phường Hòa Hải", "Phường Hòa Quý",
  "Phường Khuê Mỹ", "Phường Mỹ An", "Phường Liên Chiểu", "Phường Hòa Khánh", "Phường Hòa Minh",
  "Phường Hải Vân", "Phường Hòa Hiệp", "Phường Cẩm Lệ", "Phường Hòa Xuân", "Phường Khuê Trung",
  "Phường Hòa Thọ Đông", "Phường Hòa Thọ Tây", "Phường Hòa Phát", "Phường Hòa An", "Xã Hòa Vang",
  "Xã Hòa Tiến", "Xã Bà Nà", "Xã Hòa Châu", "Xã Hòa Phước", "Xã Hòa Khương", "Xã Hòa Nhơn",
  "Xã Hòa Phong", "Xã Hòa Sơn", "Xã Hòa Ninh", "Xã Hòa Liên", "Xã Hòa Bắc", "Xã Hòa Phú"
];

// TIỆN ÍCH MẬT MÃ HỌC (WEB CRYPTO API)
async function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + ":" + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

class SecureAuthService {
  constructor() {
    this.currentUser = this.loadValidSession();
  }

  isFirstRun() {
    const users = this.getUsers();
    return !users || users.length === 0 || !users.some(u => u.role === "ADMIN");
  }

  getUsers() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn("Lỗi đọc CSDL người dùng:", e);
      return [];
    }
  }

  saveUsers(users) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
      return true;
    } catch (e) {
      console.error("Lỗi lưu CSDL người dùng:", e);
      return false;
    }
  }

  // Khởi tạo tài khoản Quản trị viên ban đầu (First-run Setup)
  async setupInitialAdmin(username, password, fullName) {
    if (!this.isFirstRun()) {
      return { success: false, message: "Hệ thống đã có tài khoản Quản trị viên!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    if (!trimmedUser || trimmedUser.length < 3) {
      return { success: false, message: "Tên đăng nhập phải có ít nhất 3 ký tự!" };
    }

    if (!password || password.length < 6) {
      return { success: false, message: "Mật khẩu quản trị phải có ít nhất 6 ký tự để đảm bảo an toàn!" };
    }

    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const adminUser = {
      username: trimmedUser,
      passwordHash: passwordHash,
      salt: salt,
      name: (fullName || "Quản Trị Viên CDC Đà Nẵng").trim(),
      role: "ADMIN",
      ward: "ALL",
      createdAt: new Date().toISOString()
    };

    this.saveUsers([adminUser]);
    await this.login(trimmedUser, password);

    return { success: true, message: "Khởi tạo Quản trị viên thành công!", user: adminUser };
  }

  // Chống Brute-force
  checkLockout() {
    try {
      const stored = localStorage.getItem(AUTH_ATTEMPTS_KEY);
      if (!stored) return { locked: false, remainingSec: 0 };
      const data = JSON.parse(stored);
      const now = Date.now();
      if (data.attempts >= MAX_FAILED_ATTEMPTS) {
        const elapsed = now - data.lastFailed;
        if (elapsed < LOCKOUT_DURATION_MS) {
          const remainingSec = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
          return { locked: true, remainingSec };
        } else {
          localStorage.removeItem(AUTH_ATTEMPTS_KEY);
          return { locked: false, remainingSec: 0 };
        }
      }
    } catch (e) {}
    return { locked: false, remainingSec: 0 };
  }

  recordFailedAttempt() {
    try {
      const stored = localStorage.getItem(AUTH_ATTEMPTS_KEY);
      const data = stored ? JSON.parse(stored) : { attempts: 0, lastFailed: 0 };
      data.attempts += 1;
      data.lastFailed = Date.now();
      localStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify(data));
      return data.attempts;
    } catch (e) {
      return 1;
    }
  }

  resetFailedAttempts() {
    try {
      localStorage.removeItem(AUTH_ATTEMPTS_KEY);
    } catch (e) {}
  }

  loadValidSession() {
    try {
      const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);
      if (!sessionStr) return null;
      const session = JSON.parse(sessionStr);
      if (!session || !session.expiresAt || Date.now() > session.expiresAt) {
        this.logout();
        return null;
      }
      return session.user;
    } catch (e) {
      return null;
    }
  }

  async login(username, password) {
    const lockout = this.checkLockout();
    if (lockout.locked) {
      return { 
        success: false, 
        message: `Hệ thống tạm khóa do nhập sai quá nhiều lần. Thử lại sau ${lockout.remainingSec} giây!` 
      };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === trimmedUser);

    if (!user) {
      const attempts = this.recordFailedAttempt();
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      return { 
        success: false, 
        message: remaining > 0 
          ? `Tên đăng nhập hoặc mật khẩu không đúng! (Còn ${remaining} lần thử)`
          : `Bạn đã nhập sai 5 lần. Tạm khóa 5 phút để bảo vệ hệ thống!` 
      };
    }

    const inputHash = await hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      const attempts = this.recordFailedAttempt();
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      return { 
        success: false, 
        message: remaining > 0 
          ? `Tên đăng nhập hoặc mật khẩu không đúng! (Còn ${remaining} lần thử)`
          : `Bạn đã nhập sai 5 lần. Tạm khóa 5 phút để bảo vệ hệ thống!` 
      };
    }

    this.resetFailedAttempts();

    const sessionUser = {
      username: user.username,
      name: user.name,
      role: user.role,
      ward: user.ward,
      district: user.district || ""
    };

    const sessionData = {
      user: sessionUser,
      loggedInAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS
    };

    this.currentUser = sessionUser;
    try {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("auth:change", { detail: { user: sessionUser } }));
    return { success: true, user: sessionUser };
  }

  logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("auth:change", { detail: { user: null } }));
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === "ADMIN";
  }

  isTYT() {
    return this.currentUser && this.currentUser.role === "TYT";
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserScopeWard() {
    if (!this.currentUser) return null;
    if (this.currentUser.role === "ADMIN") return "ALL";
    return this.currentUser.ward;
  }

  async createTYTAccount({ username, password, name, ward, district }) {
    if (!this.isAdmin()) {
      return { success: false, message: "Chỉ Quản trị viên mới có quyền tạo tài khoản!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    if (!trimmedUser || trimmedUser.length < 3) {
      return { success: false, message: "Tên đăng nhập phải có ít nhất 3 ký tự!" };
    }

    if (!password || password.length < 6) {
      return { success: false, message: "Mật khẩu phải có ít nhất 6 ký tự!" };
    }

    if (!name || !ward) {
      return { success: false, message: "Vui lòng điền tên đơn vị và chọn địa bàn phụ trách!" };
    }

    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === trimmedUser)) {
      return { success: false, message: `Tên đăng nhập "${username}" đã tồn tại trên hệ thống!` };
    }

    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser = {
      username: trimmedUser,
      passwordHash: passwordHash,
      salt: salt,
      name: name.trim(),
      role: "TYT",
      ward: ward.trim(),
      district: district ? district.trim() : "",
      createdAt: new Date().toISOString().substring(0, 10)
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, message: `Đã tạo tài khoản cho "${name}" thành công!`, user: newUser };
  }

  deleteUser(username) {
    if (!this.isAdmin()) {
      return { success: false, message: "Chỉ Quản trị viên mới có quyền xóa tài khoản!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    if (this.currentUser && this.currentUser.username.toLowerCase() === trimmedUser) {
      return { success: false, message: "Không thể tự xóa tài khoản quản trị đang đăng nhập!" };
    }

    let users = this.getUsers();
    const initialLen = users.length;
    users = users.filter(u => u.username.toLowerCase() !== trimmedUser);

    if (users.length === initialLen) {
      return { success: false, message: "Không tìm thấy tài khoản cần xóa!" };
    }

    this.saveUsers(users);
    return { success: true, message: `Đã xóa tài khoản "${username}" thành công!` };
  }
}

// Khởi tạo instance toàn cục
window.authService = new SecureAuthService();

// ============================================================================
// CÁC HÀM TƯƠNG TÁC GIAO DIỆN (UI INTERACTION FUNCTIONS)
// Sẵn sàng ngay lập tức, không phụ thuộc vào tải dữ liệu bản đồ
// ============================================================================

window.openLoginModal = function() {
  const modal = document.getElementById("modal-login");
  const err = document.getElementById("login-error-msg");
  if (err) err.style.display = "none";

  const boxNormal = document.getElementById("box-login-normal");
  const boxFirstRun = document.getElementById("box-first-run-setup");
  const modalTitle = document.getElementById("login-modal-title");

  const isFirst = window.authService ? window.authService.isFirstRun() : false;
  if (isFirst) {
    if (boxNormal) boxNormal.style.display = "none";
    if (boxFirstRun) boxFirstRun.style.display = "block";
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-key" style="color:var(--accent-cyan);"></i> Khởi Tạo Quản Trị Viên (Lần đầu)`;
    const setupUser = document.getElementById("setup-username");
    if (setupUser) setupUser.focus();
  } else {
    if (boxNormal) boxNormal.style.display = "block";
    if (boxFirstRun) boxFirstRun.style.display = "none";
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-shield-halved" style="color:var(--accent-cyan);"></i> Đăng Nhập Hệ Thống Dịch Tễ`;
    const userInput = document.getElementById("login-username");
    if (userInput) userInput.focus();
  }

  if (modal) modal.classList.add("active");
};

window.closeLoginModal = function() {
  const modal = document.getElementById("modal-login");
  if (modal) modal.classList.remove("active");
};

window.handleFirstRunSetup = async function() {
  const userEl = document.getElementById("setup-username");
  const nameEl = document.getElementById("setup-fullname");
  const passEl = document.getElementById("setup-password");
  const passConfirmEl = document.getElementById("setup-password-confirm");
  const errBox = document.getElementById("login-error-msg");

  const username = userEl ? userEl.value.trim() : "";
  const name = nameEl ? nameEl.value.trim() : "";
  const password = passEl ? passEl.value : "";
  const passwordConfirm = passConfirmEl ? passConfirmEl.value : "";

  if (password !== passwordConfirm) {
    if (errBox) {
      errBox.innerText = "Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại!";
      errBox.style.display = "block";
    }
    return;
  }

  if (password.length < 6) {
    if (errBox) {
      errBox.innerText = "Mật khẩu quản trị phải có ít nhất 6 ký tự để đảm bảo an toàn!";
      errBox.style.display = "block";
    }
    return;
  }

  const res = await window.authService.setupInitialAdmin(username, password, name);
  if (res.success) {
    alert("Khởi tạo tài khoản Quản trị viên thành công! Bạn đã được đăng nhập tự động.");
    closeLoginModal();
    updateAuthUI();
  } else {
    if (errBox) {
      errBox.innerText = res.message;
      errBox.style.display = "block";
    }
  }
};

window.handleLoginSubmit = async function() {
  const userInput = document.getElementById("login-username");
  const passInput = document.getElementById("login-password");
  const errBox = document.getElementById("login-error-msg");

  const username = userInput ? userInput.value : "";
  const password = passInput ? passInput.value : "";

  const res = await window.authService.login(username, password);
  if (res.success) {
    closeLoginModal();
    if (userInput) userInput.value = "";
    if (passInput) passInput.value = "";
    updateAuthUI();
  } else {
    if (errBox) {
      errBox.innerText = res.message;
      errBox.style.display = "block";
    }
  }
};

window.handleLogoutClick = function() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống dịch tễ?")) {
    window.authService.logout();
    updateAuthUI();
  }
};

window.openUsersModal = function() {
  if (!window.authService || !window.authService.isAdmin()) {
    alert("Chỉ Quản trị viên (Admin CDC) mới có quyền quản lý tài khoản!");
    return;
  }

  const modal = document.getElementById("modal-users");
  if (modal) modal.classList.add("active");

  renderUsersTable();
  populateNewWardOptions();
};

window.closeUsersModal = function() {
  const modal = document.getElementById("modal-users");
  if (modal) modal.classList.remove("active");
};

window.renderUsersTable = function() {
  const tbody = document.getElementById("user-table-body");
  const countBadge = document.getElementById("user-count-badge");
  if (!tbody) return;

  const users = window.authService.getUsers();
  if (countBadge) countBadge.innerText = `${users.length} tài khoản`;

  tbody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    const isRootAdmin = u.role === "ADMIN";
    const roleLabel = u.role === "ADMIN" 
      ? '<span class="user-role-badge role-admin">ADMIN</span>' 
      : '<span class="user-role-badge role-tyt">TRẠM Y TẾ</span>';

    tr.innerHTML = `
      <td><b>${u.username}</b></td>
      <td>${u.name}</td>
      <td>${roleLabel}</td>
      <td><span style="color:var(--accent-cyan); font-weight:500;">${u.ward === "ALL" ? "Toàn thành phố" : u.ward}</span></td>
      <td style="text-align:center;">
        ${isRootAdmin 
          ? '<span style="color:var(--text-dim); font-size:0.65rem;">Cố định</span>' 
          : `<button type="button" class="btn-action-del" onclick="handleDeleteUser('${u.username}')" title="Xóa tài khoản"><i class="fa-solid fa-trash"></i></button>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.populateNewWardOptions = function() {
  const select = document.getElementById("new-ward");
  if (!select) return;

  select.innerHTML = '<option value="">-- Chọn Xã / Phường quản lý --</option>';
  DANANG_WARDS_LIST.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.innerText = w;
    select.appendChild(opt);
  });
};

window.handleCreateUserSubmit = async function() {
  const username = document.getElementById("new-username").value;
  const password = document.getElementById("new-password").value;
  const name = document.getElementById("new-fullname").value;
  const ward = document.getElementById("new-ward").value;
  const msgBox = document.getElementById("user-mgmt-msg");

  const res = await window.authService.createTYTAccount({ username, password, name, ward });

  if (msgBox) {
    msgBox.innerText = res.message;
    msgBox.style.display = "block";
    msgBox.style.background = res.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
    msgBox.style.color = res.success ? "#6ee7b7" : "#fca5a5";
    msgBox.style.border = res.success ? "1px solid #10b981" : "1px solid #ef4444";
  }

  if (res.success) {
    document.getElementById("form-create-user").reset();
    renderUsersTable();
  }
};

window.handleDeleteUser = function(username) {
  if (confirm(`Bạn có chắc chắn muốn xóa tài khoản Trạm Y tế "${username}"?`)) {
    const res = window.authService.deleteUser(username);
    const msgBox = document.getElementById("user-mgmt-msg");
    if (msgBox) {
      msgBox.innerText = res.message;
      msgBox.style.display = "block";
      msgBox.style.background = res.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
      msgBox.style.color = res.success ? "#6ee7b7" : "#fca5a5";
      msgBox.style.border = res.success ? "1px solid #10b981" : "1px solid #ef4444";
    }
    renderUsersTable();
  }
};

window.updateAuthUI = function() {
  const user = window.authService ? window.authService.getCurrentUser() : null;
  const btnLogin = document.getElementById("btn-open-login");
  const profileBox = document.getElementById("user-profile-box");
  const btnManage = document.getElementById("btn-open-manage-users");
  const btnLogout = document.getElementById("btn-logout");

  const scopeBanner = document.getElementById("scope-banner");
  const scopeIcon = document.getElementById("scope-icon");
  const scopeTitle = document.getElementById("scope-title");
  const scopeDesc = document.getElementById("scope-desc");

  if (user) {
    if (btnLogin) btnLogin.style.display = "none";
    if (profileBox) profileBox.style.display = "flex";
    if (btnLogout) btnLogout.style.display = "flex";

    const nameEl = document.getElementById("user-display-name");
    if (nameEl) nameEl.innerText = user.name;

    const roleBadge = document.getElementById("user-display-role");
    const avatarBadge = document.getElementById("user-avatar-badge");

    if (user.role === "ADMIN") {
      if (roleBadge) {
        roleBadge.innerText = "ADMIN (TOÀN TP)";
        roleBadge.className = "user-role-badge role-admin";
      }
      if (avatarBadge) {
        avatarBadge.className = "user-avatar avatar-admin";
        avatarBadge.innerHTML = `<i class="fa-solid fa-user-shield"></i>`;
      }
      if (btnManage) btnManage.style.display = "flex";

      if (scopeBanner) {
        scopeBanner.className = "scope-alert-card scope-admin";
        if (scopeIcon) scopeIcon.className = "fa-solid fa-shield-halved";
        if (scopeTitle) scopeTitle.innerText = "CHẾ ĐỘ QUẢN TRỊ VIÊN CDC (TOÀN THÀNH PHỐ)";
        if (scopeDesc) scopeDesc.innerText = "Toàn quyền truy cập cả thành phố: Xem chi tiết toàn bộ ca bệnh, quản lý trạm y tế, dập dịch.";
      }
    } else {
      if (roleBadge) {
        roleBadge.innerText = `TRẠM Y TẾ: ${user.ward}`;
        roleBadge.className = "user-role-badge role-tyt";
      }
      if (avatarBadge) {
        avatarBadge.className = "user-avatar avatar-tyt";
        avatarBadge.innerHTML = `<i class="fa-solid fa-house-medical"></i>`;
      }
      if (btnManage) btnManage.style.display = "none";

      if (scopeBanner) {
        scopeBanner.className = "scope-alert-card scope-tyt";
        if (scopeIcon) scopeIcon.className = "fa-solid fa-house-medical-flag";
        if (scopeTitle) scopeTitle.innerText = `ĐỊA BÀN QUẢN LÝ: ${user.ward.toUpperCase()}`;
        if (scopeDesc) scopeDesc.innerText = `Hệ thống tự động giới hạn chỉ hiển thị các ca bệnh thuộc địa bàn ${user.ward} để điều tra dịch tễ.`;
      }
    }
  } else {
    if (btnLogin) btnLogin.style.display = "flex";
    if (profileBox) profileBox.style.display = "none";
    if (btnManage) btnManage.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";

    if (scopeBanner) {
      scopeBanner.className = "scope-alert-card scope-guest";
      if (scopeIcon) scopeIcon.className = "fa-solid fa-lock";
      if (scopeTitle) scopeTitle.innerText = "CHẾ ĐỘ KHÁCH (CHƯA ĐĂNG NHẬP)";
      if (scopeDesc) scopeDesc.innerText = "Bản đồ chi tiết & tọa độ dịch tễ học được bảo mật. Đăng nhập để mở khóa bản đồ GIS.";
    }
  }

  // Cập nhật chế độ hiển thị View Mode (Guest Dashboard vs GIS Map) nếu app.js đã tải xong
  if (typeof window.updateViewMode === "function") {
    window.updateViewMode();
  }
};

// Tự động khởi tạo ngay khi tài liệu sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
  });
} else {
  updateAuthUI();
}
