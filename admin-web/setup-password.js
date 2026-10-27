import { loadFirebaseWebConfig, validateWebConfig } from "./firebase-config-loader.js";

export function capturePasswordCode(page, history) {
  const url = new URL(page.href ?? page);
  const params = new URLSearchParams(url.hash.slice(1));
  const code = params.get("oobCode") ?? "";
  const queryCode = url.searchParams.has("oobCode");
  url.hash = "";
  url.searchParams.delete("oobCode");
  history.replaceState(null, "", url.pathname + url.search);
  if (queryCode || code.length < 8 || code.length > 2048 || /[\u0000-\u0020]/.test(code))
    throw new Error("Liên kết thiếu mã hợp lệ. Hãy mở lại liên kết đặt mật khẩu được cung cấp.");
  return code;
}

function authFailure(data) {
  const code = String(data?.error?.message ?? "").split(" : ")[0];
  if (["EXPIRED_OOB_CODE", "INVALID_OOB_CODE"].includes(code))
    return new Error("Liên kết đã hết hạn hoặc đã dùng. Cần tạo liên kết đặt mật khẩu mới.");
  if (code === "OPERATION_NOT_ALLOWED")
    return new Error("Dự án chưa bật đăng nhập bằng mật khẩu.");
  if (code.startsWith("WEAK_PASSWORD") || code === "PASSWORD_DOES_NOT_MEET_REQUIREMENTS")
    return new Error("Mật khẩu chưa đáp ứng yêu cầu của Firebase. Hãy chọn mật khẩu khác.");
  return new Error("Không thể hoàn tất yêu cầu đặt mật khẩu. Vui lòng thử lại.");
}

export function createPasswordSetup(config, page, actionCode, fetcher = globalThis.fetch) {
  const url = new URL(page.href ?? page);
  validateWebConfig(config, url);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) || config.localCloudProxy !== true || config.emulator !== false)
    throw new Error("Trang đặt mật khẩu chỉ dùng trên localhost với cấu hình Firebase cloud qua máy tính.");
  if (typeof actionCode !== "string" || actionCode.length < 8 || actionCode.length > 2048)
    throw new Error("Liên kết đặt mật khẩu không hợp lệ.");
  let code = actionCode, verifiedEmail = "", busy = false;
  const endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=" + encodeURIComponent(config.apiKey);
  async function reset(body) {
    let response;
    try {
      response = await fetcher(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error("Không kết nối được Firebase. Vui lòng kiểm tra mạng rồi thử lại."); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error("Firebase trả về phản hồi không hợp lệ."); }
    if (!response.ok) throw authFailure(data);
    return data;
  }
  return {
    async verify() {
      if (!code) throw new Error("Liên kết này đã được dùng.");
      const data = await reset({ oobCode: code });
      if (data.requestType !== "PASSWORD_RESET" || typeof data.email !== "string" || !data.email.includes("@"))
        throw new Error("Liên kết không phải yêu cầu đặt mật khẩu hợp lệ.");
      verifiedEmail = data.email;
      return verifiedEmail;
    },
    async confirm(password, confirmation) {
      if (!verifiedEmail || !code) throw new Error("Cần xác nhận liên kết trước khi đặt mật khẩu.");
      if (typeof password !== "string" || password.length < 8 || password.length > 4096)
        throw new Error("Mật khẩu cần từ 8 đến 4096 ký tự.");
      if (password !== confirmation) throw new Error("Hai mật khẩu chưa trùng nhau.");
      if (busy) throw new Error("Đang lưu mật khẩu. Vui lòng chờ.");
      busy = true;
      try {
        const data = await reset({ oobCode: code, newPassword: password });
        if (data.email !== verifiedEmail) throw new Error("Không xác nhận được tài khoản sau khi đặt mật khẩu.");
        code = "";
        return verifiedEmail;
      } finally { busy = false; }
    },
  };
}

export async function initializePasswordPage(document, page, history) {
  const status = document.getElementById("setup-status"), form = document.getElementById("password-form");
  const password = document.getElementById("new-password"), confirmation = document.getElementById("confirm-password"), submit = document.getElementById("set-password");
  try {
    const code = capturePasswordCode(page, history);
    if (!["localhost", "127.0.0.1"].includes(new URL(page.href).hostname))
      throw new Error("Trang này chỉ sử dụng trên localhost.");
    const setup = createPasswordSetup(await loadFirebaseWebConfig(page), page, code);
    document.getElementById("setup-email").textContent = await setup.verify();
    status.textContent = "Chọn mật khẩu từ 8 ký tự và nhập lại để xác nhận.";
    form.onsubmit = async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await setup.confirm(password.value, confirmation.value);
        form.reset();
        form.hidden = true;
        password.disabled = confirmation.disabled = true;
        status.textContent = "Đã đặt mật khẩu. Bạn có thể đăng nhập Admin Panel.";
        document.getElementById("setup-success").hidden = false;
      } catch (error) { status.textContent = error.message; submit.disabled = false; }
    };
    form.hidden = false;
    password.disabled = confirmation.disabled = submit.disabled = false;
    password.focus();
  } catch (error) {
    form.hidden = true;
    status.textContent = error.message;
  }
}

if (typeof document !== "undefined") initializePasswordPage(document, location, history);
