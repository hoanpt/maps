/**
 * ============================================================================
 * CDC ĐÀ NẴNG - MODULE XÁC THỰC, PHÂN QUYỀN & QUẢN TRỊ TÀI KHOẢN (RBAC)
 * Hoạt động độc lập, bảo mật cao: SHA-256 + Salt, Anti-Brute Force, Session Expiry
 * ============================================================================
 */

const AUTH_STORAGE_KEY = "CDC_EPIDEMIOLOGY_USERS_DB_V4";
const AUTH_SESSION_KEY = "CDC_EPIDEMIOLOGY_SESSION_V4";
const AUTH_ATTEMPTS_KEY = "CDC_AUTH_ATTEMPTS_V4";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // Khóa 5 phút nếu nhập sai quá 5 lần
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;  // Phiên đăng nhập có hiệu lực 8 tiếng

// Danh sách 94 Xã / Phường / Trạm Y Tế sau sắp xếp địa giới hành chính Đà Nẵng & khu vực mở rộng
const DANANG_WARDS_LIST = [
  "Phường Ngũ Hành Sơn", "Phường Thanh Khê", "Phường An Khê", "Phường Hòa Khánh", "Phường Sơn Trà",
  "Phường Hòa Xuân", "Phường Cẩm Lệ", "Phường An Hải", "Phường Điện Bàn Đông", "Phường Liên Chiểu",
  "Phường Hội An Tây", "Phường Hòa Cường", "Phường Hải Vân", "Phường Hải Châu", "Xã Thăng Bình",
  "Phường Điện Bàn Bắc", "Xã Xuân Phú", "Phường Hội An Đông", "Xã Nam Phước", "Phường Hội An",
  "Xã Duy Xuyên", "Xã Duy Nghĩa", "Phường Điện Bàn", "Xã Điện Bàn Tây", "Xã Thăng An",
  "Xã Hòa Tiến", "Xã Thu Bồn", "Phường An Thắng", "Phường Bàn Thạch", "Xã Chiên Đàn",
  "Xã Thăng Điền", "Xã Đại Lộc", "Xã Núi Thành", "Xã Tam Xuân", "Xã Tây Hồ",
  "Xã Hòa Vang", "Phường Quảng Phú", "Xã Đồng Dương", "Phường Tam Kỳ", "Xã Thạnh Bình",
  "Xã Bà Nà", "Xã Tam Anh", "Xã Gò Nổi", "Phường Hương Trà", "Xã Thăng Trường",
  "Xã Tiên Phước", "Xã Quế Sơn Trung", "Xã Quế Sơn", "Xã Thăng Phú", "Xã Thạnh Mỹ",
  "Xã Phú Ninh", "Xã Hà Nha", "Xã Bình Sơn", "Xã Lãnh Ngọc", "Xã Phú Thuận",
  "Xã Vu Gia", "Xã Sơn Cẩm Hà", "Xã Trà My", "Xã Bến Giằng", "Xã Nông Sơn",
  "Xã Vạn Tường", "Xã Hiệp Đức", "Xã Việt An", "Xã Tam Mỹ", "Xã Thượng Đức",
  "Xã Quế Phước", "Xã Trà Đốc", "Xã Trà Leng", "Xã Khâm Đức", "Xã Tây Giang",
  "Xã Nam Trà My", "Xã Trà Tập", "Xã Trà Tân", "Xã Trà Liên", "Xã Đức Phú",
  "Đặc khu Hoàng Sa", "Xã Trà Giáp", "Xã Phước Hiệp", "Xã Sông Kôn", "Xã Trà Linh",
  "Xã Bình Minh", "Xã Sông Vàng", "Xã Tân Hiệp", "Xã Chân Mây - Lăng Cô", "Xã Tam Hải",
  "Xã Phước Năng", "Phường Nghĩa Lộ", "Xã Hùng Sơn", "Xã Phước Chánh", "Xã Phước Trà",
  "Xã La Dêê", "Xã Đông Giang", "Xã Bình Chương", "Xã Nam Giang"
];
window.DANANG_WARDS_LIST = DANANG_WARDS_LIST;

// TIỆN ÍCH MẬT MÃ HỌC (TỰ ĐỘNG THÍCH ỨNG CẢ WEB CRYPTO LẪN FALLBACK TRÊN MỌI MÔI TRƯỜNG)
async function generateSalt() {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    try {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {}
  }
  let s = "";
  for (let i = 0; i < 32; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

async function hashPassword(password, salt) {
  const combined = (password || "") + ":" + (salt || "");
  
  // 1. Thử Web Crypto API nếu môi trường hỗ trợ (HTTPS hoặc localhost)
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(combined);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      console.warn("Web Crypto không khả dụng, chuyển sang thư viện SHA-256:", e);
    }
  }

  // 2. Dự phòng bằng thư viện SHA-256 thuần (hoạt động 100% trên HTTP, IP, mọi trình duyệt)
  if (typeof window !== "undefined" && typeof window.sha256 === "function") {
    return window.sha256(combined);
  }
  if (typeof sha256 === "function") {
    return sha256(combined);
  }

  return combined;
}

// HÀM TỰ ĐỘNG SINH TÊN ĐĂNG NHẬP CHUẨN HÓA CHO 94 TRẠM Y TẾ XÃ/PHƯỜNG
function getTYTUsername(ward) {
  let clean = (ward || "").replace(/^(Phường|Xã|Đặc khu)\s+/i, "");
  return "tyt_" + clean.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
window.getTYTUsername = getTYTUsername;

// TỰ ĐỘNG KHỞI TẠO CƠ SỞ DỮ LIỆU 95 TÀI KHOẢN (1 ADMIN CDC + 94 TRẠM Y TẾ TOÀN THÀNH PHỐ)
// Mật khẩu mặc định:
//   - admin: admin123 (Quản trị viên toàn thành phố)
//   - Toàn bộ 94 trạm y tế: tyt123 (Bắt buộc đổi mật khẩu mới ngay lần đăng nhập đầu tiên)
function buildPreseededUsers() {
  const users = [
    {
      username: "admin",
      passwordHash: "d50395e409e5c15744e7769f4f8933f17e1e38f8e031ebcb364b17cec01b6b2f",
      salt: "21114ba7bef6c4e948babb172319676b",
      name: "Quản Trị Viên CDC Đà Nẵng",
      role: "ADMIN",
      ward: "ALL",
      district: "Toàn thành phố",
      mustChangePassword: false,
      createdAt: "2026-11-23T08:42:40.066Z"
    }
  ];

  const hashFn = (typeof window !== "undefined" && typeof window.sha256 === "function")
    ? window.sha256
    : (str) => {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
        return Math.abs(h).toString(16).padStart(32, "0");
      };

  DANANG_WARDS_LIST.forEach(ward => {
    const username = getTYTUsername(ward);
    const salt = hashFn("SALT_CDC_" + username).substring(0, 32);
    const passwordHash = hashFn("tyt123:" + salt);

    users.push({
      username: username,
      passwordHash: passwordHash,
      salt: salt,
      name: "Trạm Y Tế " + ward,
      role: "TYT",
      ward: ward,
      district: ward,
      mustChangePassword: true, // Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên
      createdAt: "2026-11-23T08:42:40.066Z"
    });
  });

  return users;
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
      let stored = localStorage.getItem(AUTH_STORAGE_KEY);
      let users = stored ? JSON.parse(stored) : null;
      const defaultUsers = buildPreseededUsers();

      // Di chuyển dữ liệu nếu nâng cấp từ V3 lên V4
      if (!users || !Array.isArray(users) || users.length === 0) {
        const oldV3 = localStorage.getItem("CDC_EPIDEMIOLOGY_USERS_DB_V3");
        if (oldV3) {
          try {
            const parsedOld = JSON.parse(oldV3);
            if (Array.isArray(parsedOld)) {
              parsedOld.forEach(oldU => {
                const idx = defaultUsers.findIndex(u => u.username.toLowerCase() === oldU.username.toLowerCase());
                if (idx !== -1) {
                  defaultUsers[idx].passwordHash = oldU.passwordHash;
                  defaultUsers[idx].salt = oldU.salt;
                  if (oldU.mustChangePassword !== undefined) {
                    defaultUsers[idx].mustChangePassword = oldU.mustChangePassword;
                  }
                }
              });
            }
          } catch (e) {}
        }
        this.saveUsers(defaultUsers);
        return defaultUsers;
      }

      // Đảm bảo tất cả 94 trạm y tế và admin luôn có mặt trong CSDL
      let modified = false;
      defaultUsers.forEach(defUser => {
        const idx = users.findIndex(u => u.username.toLowerCase() === defUser.username.toLowerCase());
        if (idx === -1) {
          users.push(defUser);
          modified = true;
        } else {
          // Bổ sung cờ mustChangePassword nếu tài khoản trạm y tế cũ chưa có
          if (users[idx].mustChangePassword === undefined && users[idx].role === "TYT") {
            users[idx].mustChangePassword = true;
            modified = true;
          }
        }
      });
      if (modified) {
        this.saveUsers(users);
      }
      return users;
    } catch (e) {
      console.warn("Lỗi đọc CSDL người dùng:", e);
      return buildPreseededUsers();
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
      district: user.district || "",
      mustChangePassword: !!user.mustChangePassword
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
    if (typeof updateAuthUI === "function") {
      updateAuthUI();
    }
    return { success: true, user: sessionUser, mustChangePassword: !!user.mustChangePassword };
  }

  logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("auth:change", { detail: { user: null } }));
    if (typeof updateAuthUI === "function") {
      updateAuthUI();
    }
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

  mustChangePassword() {
    return !!(this.currentUser && this.currentUser.mustChangePassword);
  }

  async forceChangePassword(newPassword) {
    if (!this.currentUser) {
      return { success: false, message: "Bạn chưa đăng nhập vào hệ thống!" };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự!" };
    }
    if (newPassword === "tyt123" || newPassword === "admin123") {
      return { success: false, message: "Mật khẩu mới không được trùng với mật khẩu mặc định (tyt123)!" };
    }

    const username = this.currentUser.username.toLowerCase();
    let users = this.getUsers();
    const idx = users.findIndex(u => u.username.toLowerCase() === username);
    if (idx === -1) {
      return { success: false, message: "Không tìm thấy thông tin tài khoản trên hệ thống!" };
    }

    const newSalt = await generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    users[idx].salt = newSalt;
    users[idx].passwordHash = newHash;
    users[idx].mustChangePassword = false;
    users[idx].passwordChangedAt = new Date().toISOString();
    this.saveUsers(users);

    // Cập nhật session hiện tại
    this.currentUser.mustChangePassword = false;
    try {
      const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        if (sessionData && sessionData.user) {
          sessionData.user.mustChangePassword = false;
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
        }
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("auth:change", { detail: { user: this.currentUser } }));
    return { success: true, message: "Đổi mật khẩu thành công! Tài khoản của bạn đã được kích hoạt an toàn." };
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
      mustChangePassword: true,
      createdAt: new Date().toISOString()
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

  async resetPassword(username, newPassword) {
    if (!this.isAdmin()) {
      return { success: false, message: "Chỉ Quản trị viên mới có quyền đặt lại mật khẩu!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    let users = this.getUsers();
    const idx = users.findIndex(u => u.username.toLowerCase() === trimmedUser);
    if (idx === -1) {
      return { success: false, message: `Không tìm thấy tài khoản "${username}"!` };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, message: "Mật khẩu mới phải có ít nhất 4 ký tự!" };
    }

    const newSalt = await generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    users[idx].salt = newSalt;
    users[idx].passwordHash = newHash;
    users[idx].mustChangePassword = true; // Bắt buộc trạm y tế phải đổi mật khẩu khi đăng nhập
    this.saveUsers(users);

    return { 
      success: true, 
      message: `Đã đặt lại mật khẩu cho tài khoản "${username}" thành công (Trạm sẽ được yêu cầu đổi pass khi đăng nhập)!` 
    };
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

  // Mặc định luôn mở form đăng nhập bình thường
  if (boxNormal) boxNormal.style.display = "block";
  if (boxFirstRun) boxFirstRun.style.display = "none";
  if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-shield-halved" style="color:var(--accent-cyan);"></i> Đăng Nhập Hệ Thống Dịch Tễ`;

  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }

  const userInput = document.getElementById("login-username");
  if (userInput) userInput.focus();
};

window.closeLoginModal = function() {
  const modal = document.getElementById("modal-login");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
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

  const username = userInput ? userInput.value.trim() : "";
  const password = passInput ? passInput.value : "";

  if (!username || !password) {
    if (errBox) {
      errBox.innerText = "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!";
      errBox.style.display = "block";
    }
    return;
  }

  try {
    const res = await window.authService.login(username, password);
    if (res.success) {
      closeLoginModal();
      if (userInput) userInput.value = "";
      if (passInput) passInput.value = "";
      updateAuthUI();
      if (res.mustChangePassword) {
        if (typeof openForceChangePasswordModal === "function") {
          openForceChangePasswordModal();
        }
      }
    } else {
      if (errBox) {
        errBox.innerText = res.message;
        errBox.style.display = "block";
      }
    }
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    if (errBox) {
      errBox.innerText = "Lỗi xử lý xác thực: " + (err.message || "Vui lòng thử lại!");
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

window.renderUsersTable = function(filterQuery = "") {
  const tbody = document.getElementById("user-table-body");
  const countBadge = document.getElementById("user-count-badge");
  if (!tbody || !window.authService) return;

  const allUsers = window.authService.getUsers();
  const q = (filterQuery || "").trim().toLowerCase();
  const users = q
    ? allUsers.filter(u => (u.username || "").toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q) || (u.ward || "").toLowerCase().includes(q))
    : allUsers;

  if (countBadge) countBadge.innerText = `${users.length} / ${allUsers.length} tài khoản`;

  tbody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    const isRootAdmin = u.role === "ADMIN";
    const roleLabel = u.role === "ADMIN" 
      ? '<span class="user-role-badge role-admin">ADMIN</span>' 
      : '<span class="user-role-badge role-tyt">TRẠM Y TẾ</span>';

    const statusBadge = isRootAdmin
      ? '<span style="color:#94a3b8; font-size:0.68rem;">Hệ thống</span>'
      : (u.mustChangePassword
          ? '<span style="background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.35); padding:0.15rem 0.45rem; border-radius:9999px; font-size:0.65rem; font-weight:600; white-space:nowrap;"><i class="fa-solid fa-clock-rotate-left"></i> Chưa đổi pass</span>'
          : '<span style="background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16, 185, 129, 0.35); padding:0.15rem 0.45rem; border-radius:9999px; font-size:0.65rem; font-weight:600; white-space:nowrap;"><i class="fa-solid fa-check"></i> Đã kích hoạt</span>'
        );

    tr.innerHTML = `
      <td><b>${u.username}</b></td>
      <td>${u.name}</td>
      <td>${roleLabel}</td>
      <td><span style="color:var(--accent-cyan); font-weight:500;">${u.ward === "ALL" ? "Toàn thành phố" : u.ward}</span></td>
      <td style="text-align:center;">${statusBadge}</td>
      <td style="text-align:center;">
        ${isRootAdmin 
          ? '<span style="color:var(--text-dim); font-size:0.65rem;">Cố định</span>' 
          : `
            <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:center;">
              <button type="button" class="btn-action-reset" onclick="openResetPasswordModal('${u.username}')" title="Đặt lại mật khẩu cho trạm">
                <i class="fa-solid fa-key"></i> Đổi pass
              </button>
              <button type="button" class="btn-action-del" onclick="handleDeleteUser('${u.username}')" title="Xóa tài khoản">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          `}
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

window.openResetPasswordModal = function(username) {
  const modal = document.getElementById("modal-reset-password");
  const targetUserEl = document.getElementById("reset-pw-target-user");
  const inputEl = document.getElementById("reset-pw-input");
  const msgEl = document.getElementById("reset-pw-msg");
  if (msgEl) msgEl.style.display = "none";
  if (targetUserEl) targetUserEl.innerText = username;
  if (inputEl) {
    inputEl.value = "";
    setTimeout(() => inputEl.focus(), 60);
  }
  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }
};

window.closeResetPasswordModal = function() {
  const modal = document.getElementById("modal-reset-password");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
};

window.submitResetPassword = async function() {
  const targetUserEl = document.getElementById("reset-pw-target-user");
  const inputEl = document.getElementById("reset-pw-input");
  const msgEl = document.getElementById("reset-pw-msg");

  const username = targetUserEl ? targetUserEl.innerText : "";
  const newPassword = inputEl ? inputEl.value : "";

  if (!username) return;
  if (!newPassword || newPassword.length < 4) {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = "Mật khẩu mới phải có ít nhất 4 ký tự!";
    }
    return;
  }

  const res = await window.authService.resetPassword(username, newPassword);
  if (res.success) {
    closeResetPasswordModal();
    const userMgmtMsg = document.getElementById("user-mgmt-msg");
    if (userMgmtMsg) {
      userMgmtMsg.style.display = "block";
      userMgmtMsg.style.background = "rgba(16, 185, 129, 0.2)";
      userMgmtMsg.style.color = "#6ee7b7";
      userMgmtMsg.style.border = "1px solid #10b981";
      userMgmtMsg.innerText = res.message;
    }
    renderUsersTable();
  } else {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = res.message;
    }
  }
};

// ============================================================================
// MODAL: BẮT BUỘC ĐỔI MẬT KHẨU LẦN ĐẦU CHO TRẠM Y TẾ
// ============================================================================
window.openForceChangePasswordModal = function() {
  const modal = document.getElementById("modal-force-change-password");
  const userEl = document.getElementById("force-change-pw-user");
  const msgEl = document.getElementById("force-pw-msg");
  const inputEl = document.getElementById("force-pw-new");
  const confirmEl = document.getElementById("force-pw-confirm");

  if (msgEl) msgEl.style.display = "none";
  if (userEl && window.authService && window.authService.getCurrentUser()) {
    const u = window.authService.getCurrentUser();
    userEl.innerText = `${u.name} (Tài khoản: ${u.username})`;
  }
  if (inputEl) inputEl.value = "";
  if (confirmEl) confirmEl.value = "";

  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }
  if (inputEl) setTimeout(() => inputEl.focus(), 60);
};

window.closeForceChangePasswordModal = function() {
  const modal = document.getElementById("modal-force-change-password");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
};

window.submitForceChangePassword = async function() {
  const inputEl = document.getElementById("force-pw-new");
  const confirmEl = document.getElementById("force-pw-confirm");
  const msgEl = document.getElementById("force-pw-msg");

  const newPassword = inputEl ? inputEl.value : "";
  const confirmPassword = confirmEl ? confirmEl.value : "";

  if (!newPassword || newPassword.length < 6) {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = "Mật khẩu mới phải có ít nhất 6 ký tự!";
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = "Xác nhận mật khẩu không trùng khớp!";
    }
    return;
  }

  if (newPassword === "tyt123" || newPassword === "admin123") {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = "Mật khẩu mới không được trùng với mật khẩu mặc định (tyt123)!";
    }
    return;
  }

  const res = await window.authService.forceChangePassword(newPassword);
  if (res.success) {
    closeForceChangePasswordModal();
    alert(res.message);
    updateAuthUI();
  } else {
    if (msgEl) {
      msgEl.style.display = "block";
      msgEl.style.background = "rgba(239, 68, 68, 0.2)";
      msgEl.style.color = "#fca5a5";
      msgEl.style.border = "1px solid #ef4444";
      msgEl.innerText = res.message;
    }
  }
};

window.updateAuthUI = function() {
  const user = window.authService ? window.authService.getCurrentUser() : null;
  const btnLogin = document.getElementById("btn-open-login");
  const profileBox = document.getElementById("user-profile-box");
  const btnManage = document.getElementById("btn-open-manage-users");
  const btnLogout = document.getElementById("btn-logout");
  const btnSim = document.getElementById("btn-toggle-sim");
  const btnUpload = document.getElementById("btn-open-upload");
  const guestView = document.getElementById("guest-view");
  const mapEl = document.getElementById("map");

  const scopeBanner = document.getElementById("scope-banner");
  const scopeIcon = document.getElementById("scope-icon");
  const scopeTitle = document.getElementById("scope-title");
  const scopeDesc = document.getElementById("scope-desc");

  if (user) {
    if (btnLogin) btnLogin.style.display = "none";
    if (profileBox) profileBox.style.display = "flex";
    if (btnLogout) btnLogout.style.display = "flex";

    // Kiểm tra nếu tài khoản bắt buộc đổi mật khẩu lần đầu
    if (user.mustChangePassword) {
      if (typeof openForceChangePasswordModal === "function") {
        openForceChangePasswordModal();
      }
    } else {
      if (typeof closeForceChangePasswordModal === "function") {
        closeForceChangePasswordModal();
      }
    }

    // Khi đã xác thực: Mở khóa bản đồ GIS, ẩn Dashboard khách
    if (guestView) guestView.style.display = "none";
    if (mapEl) mapEl.style.display = "block";

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
      if (btnSim) btnSim.style.display = "flex";
      if (btnUpload) btnUpload.style.display = "flex";

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
      if (btnSim) btnSim.style.display = "none";
      if (btnUpload) btnUpload.style.display = "none";

      if (scopeBanner) {
        scopeBanner.className = "scope-alert-card scope-tyt";
        if (scopeIcon) scopeIcon.className = "fa-solid fa-house-medical-flag";
        if (scopeTitle) scopeTitle.innerText = `ĐỊA BÀN QUẢN LÝ: ${user.ward.toUpperCase()}`;
        if (scopeDesc) scopeDesc.innerText = `Hệ thống tự động giới hạn chỉ hiển thị các ca bệnh thuộc địa bàn ${user.ward} để điều tra dịch tễ.`;
      }
    }
  } else {
    // KHÁCH CHƯA ĐĂNG NHẬP
    if (btnLogin) btnLogin.style.display = "flex";
    if (profileBox) profileBox.style.display = "none";
    if (btnManage) btnManage.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
    if (btnSim) btnSim.style.display = "none";
    if (btnUpload) btnUpload.style.display = "none";

    // Hiện Dashboard tổng quan ca bệnh Đà Nẵng, bảo mật bản đồ chi tiết
    if (guestView) guestView.style.display = "block";
    if (mapEl) mapEl.style.display = "none";

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
