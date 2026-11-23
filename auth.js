/**
 * ============================================================================
 * CDC ĐÀ NẴNG - MODULE XÁC THỰC & PHÂN QUYỀN BẢO MẬT CAO (RBAC ENGINE)
 * Bảo mật: Hash SHA-256 + Salt ngẫu nhiên, Chống Brute-force, Session Timeout
 * Tuyệt đối không lưu trữ hay truyền tải mật khẩu dạng Plaintext
 * ============================================================================
 */

const AUTH_STORAGE_KEY = "CDC_EPIDEMIOLOGY_USERS_DB";
const AUTH_SESSION_KEY = "CDC_EPIDEMIOLOGY_SESSION";
const AUTH_ATTEMPTS_KEY = "CDC_AUTH_ATTEMPTS";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // Khóa 5 phút nếu nhập sai quá 5 lần
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;  // Phiên đăng nhập có hiệu lực 8 tiếng

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

  // Kiểm tra xem hệ thống có phải đang chạy lần đầu chưa có tài khoản Admin nào không
  isFirstRun() {
    const users = this.getUsers();
    return !users || users.length === 0 || !users.some(u => u.role === "ADMIN");
  }

  // Lấy danh sách tài khoản (chỉ chứa metadata & hash, không bao giờ có plaintext password)
  getUsers() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn("Lỗi đọc CSDL người dùng:", e);
      return [];
    }
  }

  // Lưu danh sách người dùng
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
      return { success: false, message: "Hệ thống đã có tài khoản Quản trị viên được thiết lập!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    if (!trimmedUser || trimmedUser.length < 3) {
      return { success: false, message: "Tên đăng nhập quản trị phải có ít nhất 3 ký tự!" };
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
    
    // Tự động đăng nhập cho phiên đầu tiên
    await this.login(trimmedUser, password);

    return { success: true, message: "Đã thiết lập tài khoản Quản trị viên thành công!", user: adminUser };
  }

  // Kiểm tra khóa Brute-force
  checkLockout() {
    try {
      const stored = localStorage.getItem(AUTH_ATTEMPTS_KEY);
      if (!stored) return { locked: false, remainingTime: 0 };
      const data = JSON.parse(stored);
      const now = Date.now();
      if (data.attempts >= MAX_FAILED_ATTEMPTS) {
        const elapsed = now - data.lastFailed;
        if (elapsed < LOCKOUT_DURATION_MS) {
          const remainingSec = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
          return { locked: true, remainingSec };
        } else {
          // Hết hạn khóa -> Reset
          localStorage.removeItem(AUTH_ATTEMPTS_KEY);
          return { locked: false, remainingTime: 0 };
        }
      }
    } catch (e) {}
    return { locked: false, remainingTime: 0 };
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

  // Tải phiên đăng nhập an toàn có kiểm tra hạn sử dụng
  loadValidSession() {
    try {
      const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);
      if (!sessionStr) return null;
      const session = JSON.parse(sessionStr);
      if (!session || !session.expiresAt || Date.now() > session.expiresAt) {
        // Phiên đã hết hạn
        this.logout();
        return null;
      }
      return session.user;
    } catch (e) {
      return null;
    }
  }

  // Đăng nhập an toàn
  async login(username, password) {
    // 1. Kiểm tra khóa brute-force
    const lockout = this.checkLockout();
    if (lockout.locked) {
      return { 
        success: false, 
        message: `Hệ thống tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${lockout.remainingSec} giây!` 
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
          ? `Tên đăng nhập hoặc mật khẩu không chính xác! (Còn ${remaining} lần thử)`
          : `Bạn đã nhập sai 5 lần. Hệ thống tạm khóa 5 phút để bảo mật!` 
      };
    }

    // 2. So khớp Hash
    const inputHash = await hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      const attempts = this.recordFailedAttempt();
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      return { 
        success: false, 
        message: remaining > 0 
          ? `Tên đăng nhập hoặc mật khẩu không chính xác! (Còn ${remaining} lần thử)`
          : `Bạn đã nhập sai 5 lần. Hệ thống tạm khóa 5 phút để bảo mật!` 
      };
    }

    // Đăng nhập thành công -> Reset số lần thử
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

  // Đăng xuất
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

  // Tạo tài khoản Trạm Y tế mới (Bảo mật: Hash SHA-256 + Salt)
  async createTYTAccount({ username, password, name, ward, district }) {
    if (!this.isAdmin()) {
      return { success: false, message: "Chỉ Quản trị viên mới có quyền tạo tài khoản!" };
    }

    const trimmedUser = (username || "").trim().toLowerCase();
    if (!trimmedUser || trimmedUser.length < 3) {
      return { success: false, message: "Tên đăng nhập phải có ít nhất 3 ký tự!" };
    }

    if (!password || password.length < 6) {
      return { success: false, message: "Mật khẩu cấp cho Trạm Y tế phải có ít nhất 6 ký tự!" };
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

    return { success: true, message: `Đã tạo thành công tài khoản cho "${name}"!`, user: newUser };
  }

  // Xóa tài khoản
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

  // Đổi mật khẩu
  async changePassword(username, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự!" };
    }

    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return { success: false, message: "Không tìm thấy tài khoản!" };
    }

    const salt = await generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);

    user.passwordHash = passwordHash;
    user.salt = salt;

    this.saveUsers(users);
    return { success: true, message: "Đổi mật khẩu bảo mật thành công!" };
  }
}

// Khởi tạo dịch vụ
window.authService = new SecureAuthService();
