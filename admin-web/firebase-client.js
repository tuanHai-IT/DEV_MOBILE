/** Firebase public web config only. Merchant secrets and service accounts never belong here. */
export class FirebaseBackendClient {
  constructor(config) {
    this.config = config;
    this.session = null;
    this.generation = 0;
    this.refreshing = null;
    const api = new URL(config.apiBase, location.origin);
    const page = new URL(location.href ?? location.origin);
    const localPage = ["localhost", "127.0.0.1"].includes(page.hostname) && ["http:", "https:"].includes(page.protocol);
    const localApi = ["localhost", "127.0.0.1"].includes(api.hostname);
    const localCloudProxy = config.localCloudProxy === true;
    if (config.localCloudProxy && !localCloudProxy)
      throw new Error("localCloudProxy phải là giá trị boolean rõ ràng.");
    if (localCloudProxy && (!localPage || !localApi || api.protocol !== "http:" ||
        config.emulator !== false || config.authEmulatorHost))
      throw new Error("API cloud qua máy tính chỉ dùng trên localhost, với Firebase Auth thật.");
    if (
      api.protocol !== "https:" &&
      !(
        localPage && localApi && (config.emulator === true || localCloudProxy) &&
        api.protocol === "http:"
      )
    )
      throw new Error(
        "API phải dùng HTTPS; HTTP chỉ dùng cho chế độ localhost được bật rõ ràng.",
      );
    this.apiBase = api.href.replace(/\/$/, "");
    if (
      config.emulator &&
      config.authEmulatorHost &&
      !/^(localhost|127\.0\.0\.1):\d+$/.test(config.authEmulatorHost)
    )
      throw new Error("Auth emulator phải chạy trên localhost.");
  }
  assertGeneration(version) {
    if (version !== this.generation) {
      const error = new Error("Phiên đăng nhập đã thay đổi. Vui lòng thực hiện lại thao tác.");
      error.code = "SESSION_CHANGED";
      throw error;
    }
  }
  async authCall(path, body, refresh = false, version = this.generation) {
    if (!refresh) {
      // An explicit sign-in starts a new identity and invalidates older requests.
      version = ++this.generation;
      this.session = null;
      this.refreshing = null;
    }
    this.assertGeneration(version);
    const host = this.config.emulator
      ? `http://${this.config.authEmulatorHost}`
      : "https://identitytoolkit.googleapis.com";
    const url = refresh
      ? this.config.emulator
        ? `${host}/securetoken.googleapis.com/v1/token`
        : "https://securetoken.googleapis.com/v1/token"
      : `${host}${this.config.emulator ? "/identitytoolkit.googleapis.com" : ""}/v1/accounts:${path}`;
    const response = await fetch(
      `${url}?key=${encodeURIComponent(this.config.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": refresh
            ? "application/x-www-form-urlencoded"
            : "application/json",
        },
        body: refresh ? new URLSearchParams(body) : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );
    this.assertGeneration(version);
    const data = await response.json();
    this.assertGeneration(version);
    if (!response.ok)
      throw new Error(data.error?.message ?? "Không xác thực được tài khoản.");
    this.session = {
      idToken: data.idToken ?? data.id_token,
      refreshToken: data.refreshToken ?? data.refresh_token,
      expires: Date.now() + Number(data.expiresIn ?? data.expires_in) * 1000,
    };
    return this.session;
  }
  async refreshSession(version) {
    this.assertGeneration(version);
    if (this.refreshing?.version === version) return this.refreshing.promise;
    if (!this.session) {
      const error = new Error("Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.");
      error.code = "SESSION_CHANGED";
      throw error;
    }
    const promise = this.authCall("", {
      grant_type: "refresh_token",
      refresh_token: this.session.refreshToken,
    }, true, version);
    this.refreshing = { version, promise };
    try {
      return await promise;
    } finally {
      if (this.refreshing?.promise === promise) this.refreshing = null;
    }
  }
  login(email, password) {
    return this.authCall("signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });
  }
  signup(email, password) {
    return this.authCall("signUp", {
      email,
      password,
      returnSecureToken: true,
    });
  }
  logout() {
    this.generation++;
    this.session = null;
    this.refreshing = null;
  }
  async request(path, { method = "GET", body, key } = {}, retry = true, version = this.generation) {
    this.assertGeneration(version);
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new Error("Đường dẫn API không hợp lệ.");
    if (this.session && this.session.expires < Date.now() + 60000)
      await this.refreshSession(version);
    this.assertGeneration(version);
    const currentSession = this.session;
    const response = await fetch(this.apiBase + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(currentSession
          ? { Authorization: `Bearer ${currentSession.idToken}` }
          : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(65000),
    });
    this.assertGeneration(version);
    if (response.status === 401 && retry && currentSession) {
      await this.refreshSession(version);
      this.assertGeneration(version);
      return this.request(path, { method, body, key }, false, version);
    }
    if (response.status === 204) return null;
    const data = response.headers
      .get("Content-Type")
      ?.includes("application/json")
      ? await response.json()
      : await response.blob();
    this.assertGeneration(version);
    if (!response.ok) {
      const error = new Error(data.error?.message ?? `Lỗi ${response.status}`);
      error.code = data.error?.code;
      throw error;
    }
    return data;
  }
}
