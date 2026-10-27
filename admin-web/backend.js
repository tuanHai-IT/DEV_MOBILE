import { FirebaseBackendClient } from "./firebase-client.js";
import { loadFirebaseWebConfig } from "./firebase-config-loader.js";
const $ = (id) => document.getElementById(id);
let api,
  me,
  current = "dashboard",
  cursor = null,
  pageCursor = null,
  rows = [],
  editAction = null,
  editOnSaved = null,
  pendingKey = null,
  pendingDeleteUser = null,
  pendingDeleteEntry = null,
  requestVersion = 0,
  detailVersion = 0,
  editorVersion = 0;
let activeRefresh = null;
let dashboardSnapshot = null;
let displayedPath = null;
let searchFrame = 0;
const modules = {
  dashboard: ["Tổng quan", "/admin/dashboard"],
  users: ["Người dùng", "/admin/users"],
  verifications: ["Xác minh", "/admin/verifications"],
  posts: ["Bài chia sẻ", "/admin/community?kind=POST"],
  tips: ["Mẹo hay", "/admin/community?kind=TIP"],
  scans: ["Ảnh SCAN", "/admin/community?kind=SCAN"],
  listings: ["Chợ đồ cũ", "/admin/listings"],
  orders: ["Đơn hàng", "/admin/orders"],
  payments: ["Thanh toán", "/admin/payments"],
  reports: ["Báo cáo", "/admin/reports"],
  categories: ["Danh mục", "/admin/categories"],
  content: ["Nội dung", "/admin/content"],
  "green-ledger": ["Sổ điểm", "/admin/green-ledger"],
  stats: ["Thống kê", "/admin/stats"],
  settings: ["Cấu hình", "/admin/settings"],
  "audit-logs": ["Nhật ký", "/admin/audit-logs"],
};
const labels = {
  id: "Mã",
  display_name: "Tên",
  email: "Email",
  role: "Vai trò",
  status: "Trạng thái",
  title: "Tiêu đề",
  name: "Tên",
  kind: "Loại",
  provider: "Cổng thanh toán",
  amount_vnd: "Số tiền (đ)",
  total_vnd: "Tổng tiền (đ)",
  points: "Điểm",
  points_balance: "Điểm Eco hiện tại",
  reason: "Lý do",
  created_at: "Ngày tạo",
  user_id: "Người dùng",
  buyer_id: "Người mua",
  seller_id: "Người bán",
  order_id: "Đơn hàng",
  key: "Tên cấu hình",
  action: "Thao tác",
  entity_type: "Đối tượng",
  body: "Nội dung",
  description: "Mô tả",
  city: "Thành phố",
  recipient: "Người nhận",
  phone: "Điện thoại",
  address: "Địa chỉ",
  active: "Hoạt động",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  materials: "Vật liệu",
  opening_hours: "Giờ mở cửa",
  manager_id: "Mã người quản lý",
  author_id: "Tác giả",
  resolution: "Kết quả xử lý",
  reviewer_id: "Người xét duyệt",
  value: "Giá trị",
  carrier: "Đơn vị vận chuyển",
  tracking_code: "Mã vận đơn",
  verification_status: "Xác minh",
  weight_kg: "Trọng lượng tái chế (kg)",
  tags: "Tags",
  like_count: "Lượt thích",
  saved_count: "Lượt lưu",
  comment_count: "Bình luận",
  updated_at: "Cập nhật",
  content_id: "Bài viết",
};
const communityModules = ["posts", "tips", "scans"];
const display = (value) =>
  value === null || value === undefined
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
const node = (tag, value) => {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  return element;
};
const button = (text, action) => {
  const element = node("button", text);
  element.type = "button";
  element.onclick = () =>
    Promise.resolve()
      .then(action)
      .catch((error) => {
        $("status").textContent = error.message;
      });
  return element;
};
const descriptions = {
  dashboard: "Theo dõi hoạt động và những việc cần bạn xử lý.",
  users: "Quản lý thành viên, quyền truy cập và điểm xanh của cộng đồng.",
  verifications: "Xét duyệt danh tính để giao dịch mua bán an toàn.",
  posts: "Theo dõi những câu chuyện tái chế được chia sẻ trong cộng đồng.",
  tips: "Quản lý hướng dẫn và những ý tưởng sống xanh hữu ích.",
  scans: "Quản lý ảnh SCAN riêng tư; mọi truy cập quản trị đều được ghi nhận.",
  listings: "Kiểm duyệt tin bán và giúp đồ cũ tìm được vòng đời mới.",
  orders: "Theo dõi đơn mua bán và xử lý những giao dịch cần hỗ trợ.",
  payments: "Đối soát giao dịch và quản lý yêu cầu hoàn tiền.",
  reports: "Tiếp nhận báo cáo, bảo vệ trải nghiệm của cộng đồng.",
  categories: "Sắp xếp danh mục cho các sản phẩm và vật liệu tái sử dụng.",
  content: "Chăm sóc nội dung, hoạt động và chương trình của cộng đồng.",
  "green-ledger": "Theo dõi lịch sử tích lũy và điều chỉnh điểm xanh.",
  stats: "Các chỉ số hoạt động được tổng hợp từ dữ liệu thực tế.",
  settings: "Quản lý các thiết lập vận hành của EcoShare.",
  "audit-logs": "Tra cứu lịch sử thao tác để quản trị minh bạch.",
};
const navGroups = [
  ["VẬN HÀNH", ["dashboard", "users", "verifications"]],
  ["CỘNG ĐỒNG", ["posts", "tips", "scans", "listings"]],
  ["GIAO DỊCH", ["orders", "payments", "reports"]],
  ["QUẢN LÝ", ["categories", "content", "green-ledger", "stats", "settings", "audit-logs"]],
];
const icons = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M16 3a4 4 0 0 1 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  verifications: ["M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z", "m8 12 3 3 5-6"],
  posts: ["M4 3h16v18H4z", "M8 7h8", "M8 11h8", "M8 15h5"],
  tips: ["M9 18h6", "M10 21h4", "M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"],
  scans: ["M8 3H3v5", "M16 3h5v5", "M21 16v5h-5", "M3 16v5h5", "M7 12h10"],
  listings: ["M3 7h18l-2-4H5L3 7Z", "M3 7v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V7", "M5 13v8h14v-8", "M10 21v-6h4v6"],
  orders: ["m3 7 9-4 9 4v10l-9 4-9-4V7Z", "m3 7 9 4 9-4", "M12 11v10"],
  payments: ["M3 5h18v14H3z", "M3 10h18", "M7 15h3"],
  reports: ["M5 21V3", "M5 4h14l-3 5 3 5H5"],
  categories: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  content: ["M12 3v18", "M3 12h18", "m5.6 5.6 12.8 12.8", "m5.6 18.4 12.8-12.8"],
  "green-ledger": ["M20 4C10 2 3 6 5 14c6 7 14 2 15-10Z", "M4 21 15 10"],
  stats: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  settings: ["M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "m5 5 2 2", "m17 17 2 2", "m5 19 2-2", "m17 7 2-2"],
  "audit-logs": ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h1", "M3 12h1", "M3 18h1"],
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, value);
  svg.classList.add("nav-icon");
  for (const d of icons[name] ?? icons.dashboard) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
const enumLabels = {
  ADMIN: "Quản trị viên", MODERATOR: "Kiểm duyệt viên", MEMBER: "Thành viên", COLLECTOR: "Đơn vị thu gom",
  ACTIVE: "Hoạt động", INACTIVE: "Tạm ngừng", SUSPENDED: "Đã khóa", PENDING: "Chờ xử lý", APPROVED: "Đã duyệt", REJECTED: "Từ chối", HIDDEN: "Đã ẩn",
  VERIFIED: "Đã xác minh", EXPIRED: "Hết hạn", PUBLISHED: "Đã đăng", DRAFT: "Bản nháp", ARCHIVED: "Lưu trữ", PRIVATE: "Riêng tư",
  OPEN: "Mới tiếp nhận", IN_REVIEW: "Đang xem xét", RESOLVED: "Đã giải quyết", DISMISSED: "Đã đóng", DISPUTED: "Khiếu nại",
  AWAITING_PAYMENT: "Chờ thanh toán", PAID: "Đã thanh toán", PROCESSING: "Đang xử lý", SHIPPED: "Đang giao", DELIVERED: "Đã giao", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy",
  SUCCEEDED: "Thành công", FAILED: "Thất bại", REFUNDED: "Đã hoàn tiền", REFUND_PENDING: "Chờ hoàn tiền", CHARGE: "Thanh toán", REFUND: "Hoàn tiền",
  POST: "Bài chia sẻ", TIP: "Mẹo hay", SCAN: "Ảnh SCAN", SALE: "Tin bán", ARTICLE: "Bài viết", GROUP: "Nhóm", EVENT: "Sự kiện", CHALLENGE: "Thử thách", REWARD: "Phần thưởng", BADGE: "Huy hiệu",
};
const numberFormat = new Intl.NumberFormat("vi-VN");
const currencyFormat = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
function formatted(value, key = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (key.endsWith("_at")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dateFormat.format(date);
  }
  if (typeof value === "number") return key.endsWith("_vnd") ? currencyFormat.format(value) : numberFormat.format(value);
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return Object.hasOwn(enumLabels, value) ? enumLabels[value] : display(value);
}
function badge(value, key = "status") {
  const item = node("span", formatted(value, key));
  const tone = ["ACTIVE", "VERIFIED", "APPROVED", "PUBLISHED", "PAID", "SUCCEEDED", "COMPLETED", "RESOLVED"].includes(value) ? "success"
    : ["PENDING", "AWAITING_PAYMENT", "IN_REVIEW", "DISPUTED", "REFUND_PENDING", "OPEN"].includes(value) ? "warning"
      : ["SUSPENDED", "REJECTED", "FAILED", "HIDDEN"].includes(value) ? "danger" : "neutral";
  item.className = `status-badge tone-${tone}`;
  item.title = display(value);
  return item;
}
function text(id, value) { if ($(id)) $(id).textContent = value; }
function closeMenu(focusTarget = null) {
  const wasOpen = document.body.classList.contains("menu-open");
  document.body.classList.remove("menu-open");
  $("menu-toggle")?.setAttribute("aria-expanded", "false");
  if ($("sidebar-backdrop")) $("sidebar-backdrop").hidden = true;
  if (wasOpen && focusTarget) focusTarget.focus({ preventScroll: true });
}
$("menu-toggle")?.addEventListener("click", () => {
  if (document.body.classList.contains("menu-open")) {
    closeMenu($("menu-toggle"));
    return;
  }
  const open = document.body.classList.toggle("menu-open");
  $("menu-toggle").setAttribute("aria-expanded", String(open));
  if ($("sidebar-backdrop")) $("sidebar-backdrop").hidden = !open;
  requestAnimationFrame(() => {
    if (document.body.classList.contains("menu-open"))
      ($("sidebar")?.querySelector('[aria-current="page"]') ?? $("sidebar")?.querySelector("button, a[href]"))?.focus();
  });
});
$("sidebar-backdrop")?.addEventListener("click", () => closeMenu($("menu-toggle")));
window.matchMedia("(max-width: 760px)").addEventListener("change", (event) => {
  if (!event.matches) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("menu-open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu($("menu-toggle"));
  } else if (event.key === "Tab") {
    const items = [...($("sidebar")?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
      .filter((item) => !item.hidden && item.getClientRects().length > 0);
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (!items.includes(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  }
});
function showIdentity() {
  const name = me.display_name || me.email || "Quản trị viên";
  text("identity", `${name} · ${me.role}`);
  text("operator-name", name);
  text("operator-role", formatted(me.role));
  text("operator-avatar", name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase());
  document.body.classList.remove("is-signed-out");
  document.body.classList.add("authenticated");
  if ($("sidebar")) $("sidebar").hidden = false;
  if ($("menu-toggle")) $("menu-toggle").hidden = false;
}
document.body.classList.add("admin-app", "is-signed-out");
try {
  const config = await loadFirebaseWebConfig();
  api = new FirebaseBackendClient(config);
  $("configuration").textContent =
    `Project: ${config.projectId}${config.emulator ? " · Firebase Emulator" : config.localCloudProxy ? " · Firebase cloud qua máy tính" : ""}`;
  text("connection-label", config.emulator ? "Firebase Emulator" : "Firebase đã kết nối");
  if ($("connection-label")) $("connection-label").title = config.projectId;
} catch (error) {
  $("configuration").textContent =
    "Chưa cấu hình được kết nối Firebase. " + error.message;
  $("login").querySelector("button").disabled = true;
}
$("login").onsubmit = async (event) => {
  event.preventDefault();
  const submit = event.submitter ?? event.target.querySelector("[type=submit]");
  submit.disabled = true;
  $("status").textContent = "";
  try {
    const data = new FormData(event.target);
    await api.login(data.get("email"), data.get("password"));
    me = await api.request("/me");
    if (!["ADMIN", "MODERATOR"].includes(me.role))
      throw new Error("Tài khoản chưa được phân quyền quản trị.");
    event.target.reset();
    $("login-panel").hidden = true;
    $("panel").hidden = false;
    $("logout").hidden = false;
    showIdentity();
    renderNav();
    await load();
  } catch (error) {
    api.logout();
    $("status").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
$("logout").onclick = () => {
  requestVersion++;
  detailVersion++;
  editorVersion++;
  api.logout();
  me = null;
  current = "dashboard";
  filterModule = "";
  rows = [];
  cursor = null;
  pageCursor = null;
  dashboardSnapshot = null;
  displayedPath = null;
  cancelAnimationFrame(searchFrame);
  searchFrame = 0;
  $("content").replaceChildren();
  $("panel").hidden = true;
  $("logout").hidden = true;
  $("login-panel").hidden = false;
  $("identity").textContent = "";
  $("modules").replaceChildren();
  text("operator-name", "");
  text("operator-role", "");
  text("operator-avatar", "");
  text("breadcrumb", "Đăng nhập");
  if ($("search")) $("search").value = "";
  if ($("sidebar")) $("sidebar").hidden = true;
  if ($("menu-toggle")) $("menu-toggle").hidden = true;
  closeMenu();
  document.body.classList.remove("authenticated");
  document.body.classList.add("is-signed-out");
  $("editor").close();
  $("community-detail").close();
};
function renderNav() {
  $("modules").replaceChildren();
  for (const [label, ids] of navGroups) {
    const available = ids.filter((id) => me.role !== "MODERATOR" || ["dashboard", "listings", "reports", "content", "posts", "tips"].includes(id));
    if (!available.length) continue;
    const group = node("div");
    group.className = "nav-group";
    const heading = node("p", label);
    heading.className = "nav-label";
    group.append(heading);
    for (const id of available) {
      const item = button("", () => navigate(id));
      item.className = "nav-item";
      item.dataset.module = id;
      const name = node("span", modules[id][0]);
      name.className = "nav-text";
      item.append(icon(id), name);
      group.append(item);
    }
    $("modules").append(group);
  }
}
async function navigate(module) {
  const fromDrawer = document.body.classList.contains("menu-open");
  current = module;
  cursor = null;
  pageCursor = null;
  dashboardSnapshot = null;
  if ($("search")) $("search").value = "";
  closeMenu();
  await load();
  if (fromDrawer && current === module && !document.body.classList.contains("menu-open")) {
    $("title").tabIndex = -1;
    $("title").focus({ preventScroll: true });
  }
}
function statePanel(title, message, type = "empty") {
  const box = node("div");
  box.className = `empty-state ${type}-state`;
  box.append(icon(type === "error" ? "reports" : current), node("h3", title), node("p", message));
  return box;
}
function pagePath(module, selectedStatus, selectedCursor) {
  let path = modules[module][1];
  if (selectedStatus)
    path += (path.includes("?") ? "&" : "?") + `status=${encodeURIComponent(selectedStatus)}`;
  if (selectedCursor)
    path += (path.includes("?") ? "&" : "?") + `cursor=${encodeURIComponent(selectedCursor)}`;
  return path;
}
async function load(next = false) {
  const hadPendingSearch = Boolean(searchFrame);
  cancelAnimationFrame(searchFrame);
  searchFrame = 0;
  const version = ++requestVersion;
  const module = current;
  configureFilter(module);
  const selectedStatus = $("filter").value;
  const selectedCursor = next ? cursor : null;
  const path = pagePath(module, selectedStatus, selectedCursor);
  const keepVisible = !next && displayedPath === path && $("content").hasChildNodes()
    && $("content").getAttribute("aria-busy") !== "true";
  $("status").textContent = "";
  $("title").textContent = current === "dashboard" ? "Tổng quan hôm nay" : modules[current][0];
  text("breadcrumb", modules[current][0]);
  text("section-label", ["dashboard", "stats"].includes(current) ? "CÙNG VẬN HÀNH MỘT CỘNG ĐỒNG XANH" : "KHÔNG GIAN QUẢN TRỊ");
  text("page-description", descriptions[current]);
  if (!keepVisible) {
    text("results-count", "Đang tải…");
    rows = [];
  }
  if ($("tools")) $("tools").hidden = ["dashboard", "stats"].includes(current);
  $("content").setAttribute("aria-busy", "true");
  if (!keepVisible) {
    $("content").replaceChildren(statePanel("Đang tải dữ liệu", "Vui lòng đợi trong giây lát.", "loading"));
    $("csv").hidden = true;
    $("create").hidden = true;
    $("next").hidden = true;
  }
  $("reload").disabled = true;
  document
    .querySelectorAll("[data-module]")
    .forEach((item) => {
      const active = item.dataset.module === current;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  let result;
  try {
    result = await api.request(path);
  } catch (error) {
    if (version !== requestVersion || !me) return;
    if (!keepVisible) {
      rows = [];
      cursor = null;
      pageCursor = null;
      displayedPath = null;
      const errorState = statePanel("Chưa tải được dữ liệu", error.message, "error");
      errorState.append(button("Thử lại", () => load()));
      $("content").replaceChildren(errorState);
      text("results-count", "Không thể tải dữ liệu");
    }
    $("status").textContent = error.message;
    return;
  } finally {
    if (version === requestVersion) {
      $("content").setAttribute("aria-busy", "false");
      $("reload").disabled = false;
    }
  }
  if (version !== requestVersion || !me) return;
  const nextRows = Array.isArray(result.items)
    ? result.items
    : Array.isArray(result)
      ? result
      : [];
  const nextCursor = result.next_cursor ?? null;
  const sameRows = keepVisible && JSON.stringify(nextRows) === JSON.stringify(rows)
    && nextCursor === cursor;
  rows = nextRows;
  pageCursor = selectedCursor;
  cursor = nextCursor;
  displayedPath = path;
  $("next").hidden = !cursor;
  $("csv").hidden = !rows.length;
  $("create").hidden =
    !["categories", "content", "settings", "posts", "tips"].includes(
      current,
    ) || me.role !== "ADMIN";
  if (["dashboard", "stats"].includes(current)) {
    text("results-count", "");
    const snapshot = JSON.stringify(result);
    if (keepVisible && snapshot === dashboardSnapshot) return;
    $("content").replaceChildren();
    await dashboard(result, $("content"), version);
    if (version === requestVersion) dashboardSnapshot = snapshot;
    return;
  }
  if (module === current && (!sameRows || hadPendingSearch)) renderRows();
}
// Keep the visible page current without replacing it with a loading screen or
// resetting its filter, search text, pagination, or scroll position.
function refreshCurrentPage(force = false) {
  if (!api || !me || (!force && (document.visibilityState !== "visible" ||
      $("editor").open || $("community-detail").open ||
      $("content").getAttribute("aria-busy") === "true"))) return Promise.resolve();
  const version = requestVersion;
  if (activeRefresh?.version === version) return activeRefresh.promise;
  const module = current;
  const status = $("filter").value;
  const selectedCursor = pageCursor;
  const promise = (async () => {
    try {
      const result = await api.request(pagePath(module, status, selectedCursor));
      if (version !== requestVersion || !me || current !== module ||
          $("filter").value !== status || pageCursor !== selectedCursor) return;
      if (["dashboard", "stats"].includes(module)) {
        const snapshot = JSON.stringify(result);
        if (snapshot === dashboardSnapshot) return;
        const fragment = document.createDocumentFragment();
        await dashboard(result, fragment, version);
        if (version !== requestVersion || !me || current !== module) return;
        $("content").replaceChildren(fragment);
        dashboardSnapshot = snapshot;
        return;
      }
      const freshRows = Array.isArray(result.items) ? result.items : Array.isArray(result) ? result : [];
      const nextCursor = result.next_cursor ?? null;
      if (JSON.stringify(freshRows) === JSON.stringify(rows) && nextCursor === cursor) return;
      rows = freshRows;
      cursor = nextCursor;
      $("next").hidden = !cursor;
      $("csv").hidden = !rows.length;
      const scrollY = window.scrollY;
      renderRows();
      window.scrollTo({ top: scrollY, behavior: "auto" });
    } catch {
      // A transient refresh failure must not erase data already visible to the admin.
    }
  })();
  activeRefresh = { version, promise };
  promise.finally(() => { if (activeRefresh?.promise === promise) activeRefresh = null; });
  return promise;
}
// Poll only the currently visible page; hidden tabs and open editors do no reads.
setInterval(() => { void refreshCurrentPage(); }, 20000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshCurrentPage();
});
window.addEventListener("focus", () => { void refreshCurrentPage(); });
function renderRows() {
  const query = ($("search")?.value ?? "").trim().toLocaleLowerCase("vi-VN");
  const visible = query ? rows.filter((row) => Object.entries(row).some(([key, value]) => !key.startsWith("_") && `${display(value)} ${formatted(value, key)}`.toLocaleLowerCase("vi-VN").includes(query))) : rows;
  text("results-count", query ? `${numberFormat.format(visible.length)} / ${numberFormat.format(rows.length)} mục trên trang` : `${numberFormat.format(rows.length)} mục trên trang`);
  $("content").replaceChildren();
  if (!visible.length) {
    $("content").append(statePanel(query ? "Không tìm thấy kết quả" : "Chưa có dữ liệu", query ? "Thử từ khóa khác hoặc xóa nội dung tìm kiếm." : "Dữ liệu sẽ xuất hiện tại đây khi có hoạt động mới."));
    return;
  }
  const wrap = node("div");
  wrap.className = "panel-card table-wrap";
  wrap.append(dataTable(visible));
  $("content").append(wrap);
}
function applySavedRow(saved, module, allowInsert = false) {
  if (current !== module || !saved?.id) return;
  const index = rows.findIndex((row) => row.id === saved.id);
  const selectedStatus = $("filter").value;
  const visibleInFilter = !selectedStatus || saved.status === selectedStatus;
  if (index >= 0) {
    if (visibleInFilter) rows[index] = { ...rows[index], ...saved };
    else rows.splice(index, 1);
  } else if (allowInsert && !pageCursor && visibleInFilter) {
    rows.unshift(saved);
  } else return;
  $("csv").hidden = !rows.length;
  renderRows();
}
$("search")?.addEventListener("input", () => {
  if (["dashboard", "stats"].includes(current)) return;
  cancelAnimationFrame(searchFrame);
  searchFrame = requestAnimationFrame(() => {
    searchFrame = 0;
    renderRows();
  });
});
function dataTable(items) {
  const table = node("table"),
    thead = node("thead"),
    tbody = node("tbody"),
    head = node("tr");
  table.className = "data-table";
  const columns = [
    "display_name",
    "email",
    "role",
    "title",
    "name",
    "kind",
    "provider",
    "amount_vnd",
    "total_vnd",
    "points",
    "points_balance",
    "status",
    "key",
    "action",
    "entity_type",
    "created_at",
  ]
    .filter((key) => items.some((row) => row[key] !== undefined))
    .slice(0, 7);
  if (!columns.length) columns.push("id");
  for (const key of [...columns, "Thao tác"]) {
    const th = node("th", labels[key] ?? key);
    th.scope = "col";
    head.append(th);
  }
  thead.append(head);
  table.append(thead, tbody);
  for (const row of items) {
    const tr = node("tr");
    for (const key of columns) {
      const cell = node("td");
      if (["role", "status", "kind"].includes(key)) cell.append(badge(row[key], key));
      else if (key === "display_name") {
        const person = node("div");
        person.className = "person-cell";
        const avatar = node("span", (row.display_name || "?").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase());
        avatar.className = "table-avatar";
        person.append(avatar, node("strong", formatted(row[key], key)));
        cell.append(person);
      } else {
        cell.textContent = formatted(row[key], key);
        if (key.endsWith("_vnd") || key === "points" || key === "points_balance") cell.className = "numeric-cell";
        if (["title", "name", "email"].includes(key)) cell.classList.add("text-cell");
        cell.title = display(row[key]);
      }
      tr.append(cell);
    }
    const actions = node("td");
    const tools = node("div");
    tools.className = "row-actions";
    tools.append(button("Chi tiết", () => detail(row)));
    addActions(row, tools);
    actions.append(tools);
    tr.append(actions);
    tbody.append(tr);
  }
  return table;
}
function dashboardCard(label, value, description, symbol, accent = false) {
  const card = node("article");
  card.className = `stat-card${accent ? " stat-card-accent" : ""}`;
  const top = node("div");
  top.className = "stat-label";
  top.append(node("span", label), icon(symbol));
  card.append(top, node("strong", value), node("p", description));
  return card;
}
function panelHeading(title, description) {
  const head = node("div");
  head.className = "panel-heading";
  const copy = node("div");
  copy.append(node("h2", title), node("p", description));
  head.append(copy);
  return head;
}
async function dashboard(data, parent, version) {
  const moderation = data.moderation ?? {};
  const admin = me.role === "ADMIN";
  const count = (value) => Number.isFinite(value) ? value : 0;
  const queue = [
    ...(admin ? [["Hồ sơ xác minh", "Xác minh cả người mua và người bán", count(data.pending_verifications), "verifications"]] : []),
    ["Tin bán chờ duyệt", "Kiểm tra nội dung trước khi công khai", count(moderation.pending_listings), "listings"],
    ["Báo cáo cần xử lý", "Bảo vệ trải nghiệm của cộng đồng", count(admin ? data.open_reports : moderation.open_content_reports), "reports"],
    ...(admin ? [["Đơn hàng khiếu nại", "Hỗ trợ giải quyết các giao dịch", count(data.disputed_orders), "orders"]] : []),
  ];
  const workCount = queue.reduce((sum, item) => sum + item[2], 0);
  const cards = node("div");
  cards.className = "stat-grid";
  if (admin) cards.append(
    dashboardCard("Thành viên cộng đồng", formatted(data.users), "Người mua, người bán và đơn vị thu gom", "users"),
    dashboardCard("Đơn mua bán", formatted(data.orders), "Tất cả trạng thái trên hệ thống", "orders"),
    dashboardCard("Giá trị giao dịch ròng", formatted(data.net_paid_vnd, "net_paid_vnd"), "Thanh toán thành công trừ hoàn tiền", "green-ledger", true),
    dashboardCard("Việc cần xử lý", formatted(workCount), "Xác minh · Tin bán · Báo cáo · Khiếu nại", "stats"),
  );
  else cards.append(
    dashboardCard("Nội dung đã đăng", formatted(moderation.published_content), "Nội dung đang công khai trong cộng đồng", "posts"),
    dashboardCard("Tin bán chờ duyệt", formatted(moderation.pending_listings), "Kiểm tra trước khi hiển thị trên chợ", "listings"),
    dashboardCard("Báo cáo nội dung", formatted(moderation.open_content_reports), "Báo cáo mới và đang xem xét", "reports", true),
    dashboardCard("Việc cần xử lý", formatted(workCount), "Hàng chờ kiểm duyệt của bạn", "stats"),
  );
  parent.append(cards);
  const columns = node("div");
  columns.className = "dashboard-columns";
  const chart = node("section");
  chart.className = "panel-card workload-panel";
  chart.append(panelHeading("Nhịp hoạt động của EcoShare", "Phân bố những việc đang chờ xử lý"));
  const chartBody = node("div");
  chartBody.className = "workload-chart";
  const max = Math.max(...queue.map((item) => item[2]), 1);
  for (const [name, , value] of queue) {
    const row = node("div");
    row.className = "chart-row";
    const label = node("div");
    label.className = "chart-label";
    label.append(node("span", name), node("strong", numberFormat.format(value)));
    const track = node("div");
    track.className = "chart-track";
    const bar = node("div");
    bar.className = "distribution-bar";
    bar.style.width = `${value / max * 100}%`;
    track.append(bar);
    row.append(label, track);
    chartBody.append(row);
  }
  chart.append(chartBody);
  const chartNote = node("p", workCount ? "Số liệu được tổng hợp từ hoạt động hiện tại của cộng đồng." : "Không có việc đang chờ xử lý. Cộng đồng đang được chăm sóc tốt.");
  chartNote.className = "chart-note";
  chart.append(chartNote);
  const queuePanel = node("section");
  queuePanel.className = "panel-card queue-panel";
  queuePanel.append(panelHeading("Hàng chờ của bạn", "Những việc cần được quan tâm"));
  const list = node("div");
  list.className = "queue-list";
  for (const [name, description, value, module] of queue) {
    const item = button("", () => navigate(module));
    item.className = "queue-item";
    const symbol = node("span");
    symbol.className = "queue-icon";
    symbol.append(icon(module));
    const copy = node("span");
    copy.className = "queue-copy";
    copy.append(node("strong", name), node("small", description));
    const total = node("span", numberFormat.format(value));
    total.className = "queue-count";
    item.append(symbol, copy, total);
    list.append(item);
  }
  queuePanel.append(list);
  const quote = node("p", "Cùng kéo dài vòng đời sản phẩm bằng những giao dịch an tâm và minh bạch.");
  quote.className = "queue-note";
  queuePanel.append(quote);
  columns.append(chart, queuePanel);
  parent.append(columns);
  if (current === "stats" && admin) {
    const financial = node("div");
    financial.className = "stat-grid financial-grid";
    financial.append(
      dashboardCard("Thanh toán thành công", formatted(data.successful_charge_vnd, "successful_charge_vnd"), "Tổng giá trị các khoản thu thành công", "payments"),
      dashboardCard("Đã hoàn tiền", formatted(data.successful_refund_vnd, "successful_refund_vnd"), "Tổng giá trị các khoản hoàn thành công", "payments"),
      dashboardCard("Tài khoản đã khóa", formatted(data.suspended_users), "Thành viên đang bị tạm dừng truy cập", "users"),
      dashboardCard("Nội dung đã đăng", formatted(moderation.published_content), "Nội dung công khai trên hệ thống", "posts"),
    );
    parent.append(financial);
  }
  if (!admin) return;
  const orders = node("section");
  orders.className = "panel-card dashboard-orders";
  const heading = panelHeading("Đơn hàng trên hệ thống", "Xem nhanh đơn hàng và trạng thái xử lý");
  const allOrders = button("Tất cả đơn hàng →", () => navigate("orders"));
  allOrders.className = "text-button";
  heading.append(allOrders);
  const body = node("div");
  body.className = "table-wrap";
  body.append(node("p", "Đang tải đơn hàng…"));
  orders.append(heading, body);
  parent.append(orders);
  try {
    const result = await api.request("/admin/orders?limit=5");
    if (version !== requestVersion || !me) return;
    body.replaceChildren();
    if (!result.items?.length) {
      body.append(statePanel("Chưa có đơn hàng", "Đơn mua bán sẽ xuất hiện khi người dùng bắt đầu giao dịch."));
      return;
    }
    const table = node("table");
    table.className = "data-table";
    const thead = node("thead"), tr = node("tr"), tbody = node("tbody");
    for (const title of ["Mã đơn", "Người mua / bán", "Giá trị", "Trạng thái"]) {
      const th = node("th", title);
      th.scope = "col";
      tr.append(th);
    }
    thead.append(tr);
    for (const order of result.items) {
      const row = node("tr");
      const id = node("td");
      const open = button(order.id, () => detail(order));
      open.className = "text-button order-link";
      id.append(open, node("small", formatted(order.created_at, "created_at")));
      const people = node("td");
      people.append(node("span", order.buyer_id ?? "—"), node("small", `→ ${order.seller_id ?? "—"}`));
      const amount = node("td", formatted(order.total_vnd, "total_vnd"));
      amount.className = "numeric-cell";
      const status = node("td");
      status.append(badge(order.status));
      row.append(id, people, amount, status);
      tbody.append(row);
    }
    table.append(thead, tbody);
    body.append(table);
  } catch (error) {
    if (version === requestVersion && me) body.replaceChildren(statePanel("Chưa tải được đơn hàng", error.message, "error"));
  }
}
async function detail(row) {
  if (communityModules.includes(current)) return communityDetail(row.id, current);
  const version = ++editorVersion;
  $("edit-title").textContent = "Chi tiết";
  $("fields").replaceChildren();
  $("edit-error").textContent = "";
  const dl = node("dl");
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("_")) continue;
    dl.append(node("dt", labels[key] ?? key), node("dd", formatted(value, key)));
  }
  $("fields").append(dl);
  $("edit").querySelector("[type=submit]").hidden = true;
  $("editor").showModal();
  const kind = {
    verifications: "VERIFICATION",
    reports: "REPORT",
    listings: "LISTING",
    content: "CONTENT",
  }[current];
  if (kind) {
    try {
      const result = await api.request(
        `/media?parent_kind=${kind}&parent_id=${encodeURIComponent(row.id)}`,
      );
      if (version !== editorVersion || !$("editor").open || !me) return;
      const box = node("section");
      box.append(node("h2", "Tệp đính kèm"));
      for (const asset of result.items)
        box.append(
          button(
            `Tải tệp ${asset.mime_type} · ${asset.id.slice(0, 8)}`,
            async () => {
              const data = await api.request(`/media/${asset.id}/download`),
                isBlob = data instanceof Blob,
                url = isBlob ? URL.createObjectURL(data) : data.url;
              const link = node("a");
              link.href = url;
              link.download = "ecoshare-" + asset.id;
              link.click();
              if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 1000);
            },
          ),
        );
      if (!result.items.length)
        box.append(node("p", "Chưa có tệp đã tải lên hoàn tất."));
      $("fields").append(box);
    } catch (error) {
      if (version === editorVersion && $("editor").open && me)
        $("edit-error").textContent = error.message;
    }
  }
}
function form(title, fields, action, onSaved = null) {
  editorVersion++;
  $("edit-title").textContent = title;
  $("fields").replaceChildren();
  $("edit-error").textContent = "";
  $("edit").querySelector("[type=submit]").hidden = false;
  for (const field of fields) {
    const label = node(
      "label",
      field.label ?? labels[field.name] ?? field.name,
    );
    if (field.visibleWhen) {
      label.dataset.showWhenName = field.visibleWhen.name;
      label.dataset.showWhenValue = field.visibleWhen.value;
    }
    let input;
    if (field.options) {
      input = node("select");
      for (const option of field.options) {
        const value = typeof option === "string" ? option : option.value;
        const labelText = typeof option === "string" ? formatted(option) : option.label;
        const item = node("option", labelText);
        item.value = value;
        input.append(item);
      }
    } else input = node(field.type === "textarea" ? "textarea" : "input");
    input.name = field.name;
    input.dataset.kind = field.type ?? "text";
    if (input.tagName === "INPUT")
      input.type = field.type === "textarea" ? "text" : (field.type ?? "text");
    if (field.maxLength) input.maxLength = field.maxLength;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
    if (field.type === "checkbox") input.checked = Boolean(field.value);
    else input.value = field.value ?? "";
    // These checkboxes store boolean settings; unchecked is a valid value.
    input.required = field.type !== "checkbox" && field.required !== false;
    label.append(input);
    $("fields").append(label);
  }
  const syncConditionalFields = () => {
    for (const label of $("fields").querySelectorAll("label[data-show-when-name]")) {
      const dependency = $("fields").querySelector(`[name="${CSS.escape(label.dataset.showWhenName)}"]`);
      label.hidden = !dependency || dependency.value !== label.dataset.showWhenValue;
    }
  };
  const kindField = $("fields").querySelector('[name="kind"]');
  if (kindField) kindField.addEventListener("change", syncConditionalFields);
  syncConditionalFields();
  editAction = action;
  editOnSaved = onSaved;
  pendingKey = crypto.randomUUID();
  $("editor").showModal();
}
$("edit").onsubmit = async (event) => {
  event.preventDefault();
  const submit = event.submitter ?? event.target.querySelector("[type=submit]");
  const version = editorVersion;
  const action = editAction;
  const onSaved = editOnSaved;
  const module = current;
  const key = pendingKey;
  submit.disabled = true;
  try {
    const data = {};
    for (const input of $("fields").querySelectorAll("[name]"))
      data[input.name] =
        input.dataset.kind === "checkbox"
          ? input.checked
          : input.dataset.kind === "number"
            ? (input.value === "" ? null : Number(input.value))
            : input.value;
    const result = await action(data, key);
    if (version !== editorVersion || !me) return;
    editorVersion++;
    $("editor").close();
    // Invalidate an older background read, then paint the confirmed API result
    // immediately. A quiet follow-up read reconciles fields returned indirectly.
    requestVersion++;
    if (onSaved) onSaved(result, data);
    else if (result?.id) applySavedRow(result, module);
    $("status").textContent = "Đã lưu thay đổi trên Firebase.";
    void refreshCurrentPage(true);
  } catch (error) {
    if (version === editorVersion) $("edit-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
$("close").onclick = () => { editorVersion++; $("editor").close(); };
$("editor").addEventListener("cancel", () => { editorVersion++; });
$("reload").onclick = () =>
  load().catch((error) => ($("status").textContent = error.message));
$("next").onclick = () =>
  load(true).catch((error) => ($("status").textContent = error.message));
const justification = {
  name: "reason",
  type: "textarea",
  label: "Lý do xử lý (tối thiểu 5 ký tự)",
};
const review = (row, status) =>
  form(
    `${status === "VERIFIED" ? "Xác minh" : status === "APPROVED" ? "Duyệt" : "Xử lý"} hồ sơ`,
    [justification],
    (body) =>
      api.request(`/admin/${current}/${row.id}/review`, {
        method: "POST",
        body: { status, ...body },
      }),
  );
function addActions(row, parent) {
  if (communityModules.includes(current)) {
    const module = current;
    parent.append(
      button("Sửa", () => editCommunity(row, module)),
      button(row.kind === "SCAN" ? "Lưu trữ" : "Ẩn", () => moderateCommunity(row, module)),
    );
    if (row.kind !== "SCAN" && row.status !== "ARCHIVED") {
      const remove = button("Xóa", () => openDeleteEntry(row, module));
      remove.classList.add("danger-button");
      parent.append(remove);
    }
  }
  if (current === "listings") {
    for (const status of ["APPROVED", "REJECTED", "HIDDEN"])
      parent.append(
        button(
          { APPROVED: "Duyệt", REJECTED: "Từ chối", HIDDEN: "Ẩn" }[status],
          () => review(row, status),
        ),
      );
    if (row.status !== "HIDDEN") {
      const remove = button("Xóa", () => openDeleteEntry(row, "listings"));
      remove.classList.add("danger-button");
      parent.append(remove);
    }
  }
  if (current === "verifications" && row.status === "PENDING")
    for (const status of ["VERIFIED", "REJECTED"])
      parent.append(
        button(status === "VERIFIED" ? "Xác minh" : "Từ chối", () =>
          review(row, status),
        ),
      );
  if (current === "users") {
    parent.append(
      button("Phân quyền / khóa", () =>
        form(
          "Quản lý người dùng",
          [
            {
              name: "role",
              value: row.role,
              options: ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"],
            },
            {
              name: "status",
              value: row.status,
              options: ["ACTIVE", "SUSPENDED"],
            },
            justification,
          ],
          (body) =>
            api.request(`/admin/users/${row.id}`, { method: "PATCH", body }),
        ),
      ),
    );
    parent.append(
      button("Đặt điểm Eco", () =>
        form(
          "Đặt số dư Điểm Eco",
          [{ name: "points", label: "Số điểm sau cập nhật (thay thế số hiện tại)", type: "number", min: 0, max: 1000000, step: 1, value: row.points_balance ?? 0 }, justification],
          (body, key) =>
            api.request(`/admin/users/${row.id}/points`, {
              method: "POST",
              body,
              key,
            }),
          (result) => applySavedRow({ ...row, points_balance: result.balance }, "users"),
        ),
      ),
    );
    if (row.id !== me?.id) {
      const remove = button("Xóa tài khoản", () => openDeleteUser(row));
      remove.classList.add("danger-button");
      parent.append(remove);
    }
  }
  if (current === "reports" && !["RESOLVED", "DISMISSED"].includes(row.status))
    parent.append(
      button("Giải quyết", () =>
        form(
          "Kết quả báo cáo",
          [
            { name: "status", options: ["RESOLVED", "DISMISSED"] },
            justification,
          ],
          (body) =>
            api.request(`/admin/reports/${row.id}/resolve`, {
              method: "POST",
              body,
            }),
        ),
      ),
    );
  if (current === "orders" && row.status === "DISPUTED")
    parent.append(
      button("Khôi phục sau khiếu nại", () =>
        form("Khôi phục đơn hàng", [justification], (body) =>
          api.request(`/admin/orders/${row.id}/resume`, {
            method: "POST",
            body,
          }),
        ),
      ),
    );
  if (current === "payments") {
    parent.append(
      button("Đối soát", async () => {
        await api.request(`/admin/payments/${row.id}/reconcile`, {
          method: "POST",
          body: {},
        });
        await load();
      }),
    );
    if (row.kind === "CHARGE" && row.status === "SUCCEEDED")
      parent.append(
        button("Hoàn toàn bộ", () =>
          form(
            "Yêu cầu hoàn toàn bộ khoản thanh toán",
            [justification],
            (body) =>
              api.request(`/admin/payments/${row.id}/refund`, {
                method: "POST",
                body,
              }),
          ),
        ),
      );
  }
  if (
    ["categories", "content"].includes(current) &&
    me.role === "ADMIN"
  ) {
    parent.append(
      button("Sửa", () => editResource(row)),
      button("Ngừng hiển thị", () =>
        form("Ngừng hiển thị", [justification], (body) =>
          api.request(`${modules[current][1]}/${row.id}`, {
            method: "DELETE",
            body,
          }),
        ),
      ),
    );
  }
  if (current === "settings")
    parent.append(button("Sửa", () => editSetting(row)));
}

function openDeleteUser(row) {
  if (!me || me.role !== "ADMIN" || row.id === me.id) return;
  pendingDeleteUser = row;
  const expected = typeof row.email === "string" && row.email.trim()
    ? row.email.trim()
    : row.id;
  $("delete-user-summary").textContent =
    `Tài khoản ${row.display_name || row.email || row.id} sẽ bị xóa khỏi Firebase Authentication và hồ sơ users/${row.id}. Địa chỉ, hồ sơ xác minh/tệp, nội dung và ảnh, tin nhắn, đơn hàng/thanh toán cùng nhật ký liên quan vẫn được giữ lại.`;
  $("delete-user-confirmation").value = "";
  $("delete-user-confirmation").placeholder = expected;
  $("delete-user-reason").value = "";
  $("delete-user-error").textContent = "";
  $("delete-user-submit").disabled = false;
  $("delete-user-cancel").disabled = false;
  $("delete-user-dialog").showModal();
  $("delete-user-confirmation").focus();
}

$("delete-user-cancel").onclick = () => $("delete-user-dialog").close();
$("delete-user-dialog").addEventListener("close", () => {
  pendingDeleteUser = null;
  $("delete-user-form").reset();
  $("delete-user-error").textContent = "";
  $("delete-user-submit").disabled = false;
  $("delete-user-cancel").disabled = false;
});
$("delete-user-form").onsubmit = async (event) => {
  event.preventDefault();
  const target = pendingDeleteUser;
  if (!target || !me || me.role !== "ADMIN") return;
  const confirmation = $("delete-user-confirmation").value.trim();
  const expected = typeof target.email === "string" && target.email.trim()
    ? target.email.trim()
    : target.id;
  const matches = target.email
    ? confirmation.toLocaleLowerCase("en-US") === expected.toLocaleLowerCase("en-US")
    : confirmation === expected;
  if (!matches) {
    $("delete-user-error").textContent = "Thông tin xác nhận chưa khớp với email hoặc UID của tài khoản.";
    $("delete-user-confirmation").focus();
    return;
  }
  const reason = $("delete-user-reason").value.trim();
  if (reason.length < 5) {
    $("delete-user-error").textContent = "Lý do xóa cần có ít nhất 5 ký tự.";
    $("delete-user-reason").focus();
    return;
  }
  $("delete-user-submit").disabled = true;
  $("delete-user-cancel").disabled = true;
  $("delete-user-error").textContent = "Đang xóa tài khoản…";
  try {
    await api.request(`/admin/users/${encodeURIComponent(target.id)}`, {
      method: "DELETE",
      body: { confirmation, reason },
    });
    if (!me || pendingDeleteUser?.id !== target.id) return;
    requestVersion++;
    rows = rows.filter((row) => row.id !== target.id);
    $("csv").hidden = !rows.length;
    renderRows();
    $("delete-user-dialog").close();
    $("status").textContent = `Đã xóa tài khoản đăng nhập và hồ sơ người dùng ${target.email || target.id}. Các dữ liệu liên quan được giữ lại.`;
  } catch (error) {
    if ($("delete-user-dialog").open && pendingDeleteUser?.id === target.id)
      $("delete-user-error").textContent = error.message;
  } finally {
    if ($("delete-user-dialog").open && pendingDeleteUser?.id === target.id) {
      $("delete-user-submit").disabled = false;
      $("delete-user-cancel").disabled = false;
    }
  }
};
function openDeleteEntry(row, module) {
  if (!me || !["posts", "tips", "listings"].includes(module)) return;
  pendingDeleteEntry = { row, module };
  const kind = module === "posts" ? "bài chia sẻ" : module === "tips" ? "mẹo hay" : "tin bán";
  const expected = (row.title || row.id).trim();
  $("delete-entry-title").textContent = `Xóa ${kind}`;
  $("delete-entry-summary").textContent = module === "listings"
    ? `Tin “${expected}” sẽ được gỡ khỏi Chợ đồ cũ và chuyển sang trạng thái Đã ẩn. Ảnh, đơn hàng và lịch sử giao dịch vẫn được giữ lại.`
    : `Bài “${expected}” sẽ được gỡ khỏi cộng đồng và chuyển vào Lưu trữ. Ảnh, bình luận và nhật ký xử lý vẫn được giữ lại.`;
  $("delete-entry-confirmation").value = "";
  $("delete-entry-confirmation").placeholder = expected;
  $("delete-entry-reason").value = "";
  $("delete-entry-error").textContent = "";
  $("delete-entry-submit").disabled = false;
  $("delete-entry-cancel").disabled = false;
  $("delete-entry-dialog").showModal();
  $("delete-entry-confirmation").focus();
}
$("delete-entry-cancel").onclick = () => $("delete-entry-dialog").close();
$("delete-entry-dialog").addEventListener("cancel", (event) => {
  if ($("delete-entry-submit").disabled) event.preventDefault();
});
$("delete-entry-dialog").addEventListener("close", () => {
  pendingDeleteEntry = null;
  $("delete-entry-form").reset();
  $("delete-entry-error").textContent = "";
  $("delete-entry-submit").disabled = false;
  $("delete-entry-cancel").disabled = false;
});
$("delete-entry-form").onsubmit = async (event) => {
  event.preventDefault();
  const target = pendingDeleteEntry;
  if (!target || !me) return;
  const { row, module } = target;
  const expected = (row.title || row.id).trim();
  if ($("delete-entry-confirmation").value.trim() !== expected) {
    $("delete-entry-error").textContent = "Tiêu đề xác nhận chưa khớp.";
    $("delete-entry-confirmation").focus();
    return;
  }
  const reason = $("delete-entry-reason").value.trim();
  if (reason.length < 5) {
    $("delete-entry-error").textContent = "Lý do xóa cần có ít nhất 5 ký tự.";
    $("delete-entry-reason").focus();
    return;
  }
  $("delete-entry-submit").disabled = true;
  $("delete-entry-cancel").disabled = true;
  $("delete-entry-error").textContent = "Đang gỡ khỏi ứng dụng…";
  try {
    const path = module === "listings" ? "/admin/listings" : "/admin/community";
    await api.request(`${path}/${encodeURIComponent(row.id)}`, { method: "DELETE", body: { reason } });
    if (!me || pendingDeleteEntry !== target) return;
    requestVersion++;
    applySavedRow({ ...row, status: module === "listings" ? "HIDDEN" : "ARCHIVED" }, module);
    $("delete-entry-dialog").close();
    if ($("community-detail").open && $("community-detail").dataset.entryId === row.id)
      $("community-detail").close();
    $("status").textContent = module === "listings"
      ? `Đã gỡ tin “${expected}” khỏi Chợ đồ cũ; đơn hàng và lịch sử vẫn được giữ lại.`
      : `Đã gỡ bài “${expected}” khỏi ứng dụng; bản ghi chuyển vào Lưu trữ.`;
    void refreshCurrentPage(true);
  } catch (error) {
    if ($("delete-entry-dialog").open && pendingDeleteEntry === target)
      $("delete-entry-error").textContent = error.message;
  } finally {
    if ($("delete-entry-dialog").open && pendingDeleteEntry === target) {
      $("delete-entry-submit").disabled = false;
      $("delete-entry-cancel").disabled = false;
    }
  }
};
const resourceFields = {
  categories: [["name"], ["description", "textarea"], ["active", "checkbox"]],
  content: [
    ["kind", ["ARTICLE", "GROUP", "EVENT", "CHALLENGE", "REWARD", "BADGE"]],
    ["title"],
    ["body", "textarea"],
    ["status", ["DRAFT", "PUBLISHED", "ARCHIVED"]],
  ],
};
function editResource(row = {}) {
  const fields = resourceFields[current].map(([name, type]) => ({
    name,
    value: row[name] ?? (type === "checkbox" ? true : undefined),
    ...(Array.isArray(type) ? { options: type } : { type: type ?? "text" }),
  }));
  let metadata = {};
  if (current === "content") {
    try { metadata = JSON.parse(row.metadata_json ?? "{}"); } catch { /* repair invalid legacy metadata while editing */ }
    fields.push({
      name: "reward_points",
      label: "Điểm Eco thưởng (0–5000)",
      type: "number",
      min: 0,
      max: 5000,
      step: 1,
      required: false,
      value: metadata.reward_points ?? 20,
      visibleWhen: {name: "kind", value: "CHALLENGE"},
    });
    fields.push({
      name: "requirement_type",
      label: "Điều kiện nhận điểm",
      options: [
        {value: "SELF_ATTESTED", label: "Tự xác nhận hoàn thành"},
        {value: "VERIFIED_ACCOUNT", label: "Xác thực tài khoản"},
        {value: "LIKE_AND_COMMENT", label: "Thả tim và bình luận cùng một bài"},
        {value: "POST_WITH_LIKE", label: "Đăng bài và thả tim bài của người khác"},
      ],
      required: false,
      value: metadata.requirement_type ?? "SELF_ATTESTED",
      visibleWhen: {name: "kind", value: "CHALLENGE"},
    });
  }
  form(
    row.id ? "Chỉnh sửa" : "Thêm mới",
    [...fields, justification],
    (body, key) => {
      if (current === "content") {
        const {reward_points, requirement_type, ...content} = body;
        if (content.kind === "CHALLENGE")
          content.metadata = {...metadata, reward_points: reward_points ?? 0, requirement_type: requirement_type ?? "SELF_ATTESTED"};
        body = content;
      }
      return api.request(modules[current][1] + (row.id ? "/" + row.id : ""), {
        method: row.id ? "PATCH" : "POST",
        body,
        key,
      });
    },
  );
}
const settingsFields = {
  app: [["name"], ["description"]],
  moderation: [["community_guidelines"], ["reporting_help"]],
  contact: [["support_email"]],
  maintenance: [["enabled", "checkbox"], ["message"]],
};
function editSetting(row) {
  const key = row.key;
  form(
    `Cấu hình hiển thị · ${key}`,
    [
      ...settingsFields[key].map(([name, type]) => ({
        name,
        type: type ?? "text",
        value: row.value?.[name],
        required: type === "checkbox" || name !== "description",
      })),
      justification,
    ],
    ({ reason, ...value }) =>
      api.request(`/admin/settings/${key}`, {
        method: "PATCH",
        body: { value, reason },
      }),
  );
}
$("create").onclick = () => {
  if (["posts", "tips"].includes(current)) return editCommunity({
    kind: current === "posts" ? "POST" : "TIP", status: "PUBLISHED", materials: [], tags: [], weight_kg: null,
  }, current);
  if (current === "settings") {
    form(
      "Chọn cấu hình",
      [
        {
          name: "key",
          label: "Nhóm cấu hình",
          options: Object.keys(settingsFields),
        },
      ],
      async ({ key }) => {
        setTimeout(() => editSetting({ key, value: {} }), 0);
      },
    );
  } else editResource();
};
$("csv").onclick = () => {
  const keys = [
    ...new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter((key) => !key.startsWith("_")),
      ),
    ),
  ];
  const cell = (value) =>
    '"' +
    display(value ?? "")
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const blob = new Blob(
    [
      "\ufeff" +
        [keys, ...rows.map((row) => keys.map((key) => row[key]))]
          .map((row) => row.map(cell).join(","))
          .join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    link = node("a");
  link.href = url;
  link.download = `ecoshare-${current}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const statusFilters = {
  posts: ["", "PUBLISHED", "DRAFT", "HIDDEN", "ARCHIVED"],
  tips: ["", "PUBLISHED", "DRAFT", "HIDDEN", "ARCHIVED"],
  scans: ["", "PRIVATE", "ARCHIVED"],
  listings: ["PENDING", "APPROVED", "REJECTED", "HIDDEN"],
  verifications: ["", "PENDING", "VERIFIED", "REJECTED", "EXPIRED"],
  reports: ["", "OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"],
  payments: ["", "PENDING", "SUCCEEDED", "FAILED", "CANCELLED"],
  content: ["", "DRAFT", "PUBLISHED", "ARCHIVED"],
};
let filterModule = "";
function configureFilter(module) {
  if (filterModule !== module) {
    filterModule = module;
    $("filter").replaceChildren();
    const choices = statusFilters[module] ?? [];
    $("filter-label").hidden = !choices.length;
    for (const value of choices) {
      const option = node("option", value ? formatted(value) : "Tất cả");
      option.value = value;
      $("filter").append(option);
    }
  }
}
$("filter").onchange = () => {
  cursor = null;
  load().catch((error) => ($("status").textContent = error.message));
};

const splitList = (value) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
function editCommunity(row, module) {
  const fields = [
    { name: "title", value: row.title, maxLength: 120 },
    { name: "body", type: "textarea", value: row.body, maxLength: 500, required: row.kind !== "SCAN" },
  ];
  if (row.kind !== "SCAN") fields.push(
    { name: "materials", value: (row.materials ?? []).join(", "), label: "Vật liệu (phân cách bằng dấu phẩy)", required: false },
    { name: "weight_kg", type: "number", value: row.weight_kg ?? "", required: false, step: "any", min: 0, max: 100000 },
    { name: "tags", value: (row.tags ?? []).join(", "), label: "Tags (phân cách bằng dấu phẩy)", required: false },
  );
  fields.push({ name: "status", value: row.status, options: row.kind === "SCAN" ? ["PRIVATE", "ARCHIVED"] : row.id ? ["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"] : ["DRAFT", "PUBLISHED"] }, justification);
  form(`${row.id ? "Chỉnh sửa" : "Tạo"} ${module === "scans" ? "ảnh SCAN riêng tư" : "nội dung"}`, fields, (body, key) => {
    if (row.kind !== "SCAN") {
      body.materials = splitList(body.materials);
      body.tags = splitList(body.tags);
    }
    return api.request(row.id ? `/admin/community/${row.id}` : "/admin/community", row.id
      ? { method: "PATCH", body }
      : { method: "POST", body: { ...body, kind: row.kind }, key });
  }, (saved) => {
    applySavedRow(saved, module, !row.id);
    if ($("community-detail").open && row.id) void communityDetail(row.id, module, saved);
  });
}
function moderateCommunity(row, module) {
  form(row.kind === "SCAN" ? "Lưu trữ ảnh SCAN" : "Ẩn nội dung khỏi cộng đồng", [justification], (body) =>
    api.request(`/admin/community/${row.id}`, row.kind === "SCAN"
      ? { method: "DELETE", body }
      : { method: "PATCH", body: { ...body, status: "HIDDEN" } }), (saved) => {
    const updated = saved ?? { ...row, status: "ARCHIVED" };
    applySavedRow(updated, module);
    if ($("community-detail").open) void communityDetail(row.id, module, updated);
  });
}
let detailUrls = [];
function clearDetailUrls() {
  for (const url of detailUrls) URL.revokeObjectURL(url);
  detailUrls = [];
}
$("community-close").onclick = () => $("community-detail").close();
$("community-detail").addEventListener("close", () => {
  detailVersion++;
  delete $("community-detail").dataset.entryId;
  clearDetailUrls();
  $("community-body").replaceChildren();
  void refreshCurrentPage();
});
async function mediaUrl(asset) {
  const result = await api.request(`/media/${asset.id}/download`);
  if (!(result instanceof Blob)) return result.url;
  const url = URL.createObjectURL(result);
  detailUrls.push(url);
  return url;
}
async function communityDetail(id, module, prefetchedRow = null) {
  const version = ++detailVersion;
  clearDetailUrls();
  const body = $("community-body");
  body.replaceChildren(node("p", "Đang tải nội dung từ Firebase…"));
  if (!$("community-detail").open) $("community-detail").showModal();
  try {
    const row = prefetchedRow ?? await api.request(`/admin/community/${id}`);
    if (version !== detailVersion || !me) return;
    body.replaceChildren();
    $("community-detail").dataset.entryId = row.id;
    $("community-title").textContent = row.title || (row.kind === "TIP" ? "Mẹo hay" : row.kind === "SCAN" ? "Ảnh SCAN riêng tư" : "Bài chia sẻ");
    const meta = node("p", `${row.author_id} · ${row.status} · ${row.created_at}`);
    meta.className = "community-meta";
    const article = node("p", row.body);
    article.className = "article-body";
    body.append(meta, article);
    if (row.kind === "SCAN") {
      const warning = node("p", "Ảnh SCAN là dữ liệu riêng tư. Lượt truy cập quản trị được ghi trong nhật ký.");
      warning.className = "privacy-note";
      body.append(warning);
    } else {
      const tags = node("div");
      tags.className = "chips";
      for (const material of row.materials ?? []) tags.append(node("span", material));
      for (const tag of row.tags ?? []) tags.append(node("span", `#${tag}`));
      if (row.weight_kg !== null && row.weight_kg !== undefined) tags.append(node("span", `${row.weight_kg} kg`));
      body.append(tags, node("p", `♥ ${row.like_count ?? 0} lượt thích · ${row.saved_count ?? 0} lượt lưu · ${row.comment_count ?? 0} bình luận`));
    }
    const actions = node("div");
    actions.className = "actions community-actions";
    actions.append(button("Chỉnh sửa", () => editCommunity(row, module)), button(row.kind === "SCAN" ? "Lưu trữ" : "Ẩn bài", () => moderateCommunity(row, module)));
    if (row.kind !== "SCAN" && row.status !== "ARCHIVED") {
      const remove = button("Xóa bài", () => openDeleteEntry(row, module));
      remove.classList.add("danger-button");
      actions.append(remove);
    }
    body.append(actions);
    const gallery = node("section");
    gallery.className = "media-gallery";
    body.append(gallery);
    const assets = await api.request(`/media?parent_kind=${row.kind === "SCAN" ? "SCAN" : "CONTENT"}&parent_id=${encodeURIComponent(row.id)}`);
    if (version !== detailVersion || !me) return;
    if (!assets.items.length) gallery.append(node("p", "Chưa có ảnh tải lên hoàn tất."));
    for (const asset of assets.items) {
      const box = node("figure");
      gallery.append(box);
      if (asset.mime_type?.startsWith("image/")) {
        try {
          const url = await mediaUrl(asset);
          if (version !== detailVersion) return;
          const image = node("img");
          image.src = url;
          image.alt = `Ảnh đính kèm ${row.kind === "SCAN" ? "SCAN" : "bài viết"}`;
          image.loading = "lazy";
          box.append(image);
        } catch (error) { box.append(node("p", error.message)); }
      }
      box.append(button("Mở tệp", async () => {
        const url = await mediaUrl(asset);
        if (version !== detailVersion) return;
        const link = node("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = `ecoshare-${asset.id}`;
        link.click();
      }));
    }
    if (row.kind === "SCAN") return;
    const comments = node("section");
    comments.className = "comment-list";
    comments.append(node("h3", "Bình luận và kiểm duyệt"));
    body.append(comments);
    async function commentPage(cursor) {
      const result = await api.request(`/admin/community/${row.id}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (version !== detailVersion || !me) return;
      if (!cursor && !result.items.length) comments.append(node("p", "Chưa có bình luận."));
      for (const comment of result.items) {
        const card = node("article");
        card.className = "comment-card";
        card.append(node("strong", comment.author?.display_name ?? comment.user_id), node("small", `${comment.status} · ${comment.created_at}`), node("p", comment.body));
        const tools = node("div");
        tools.append(button("Sửa / kiểm duyệt", () => form("Kiểm duyệt bình luận", [
          { name: "body", value: comment.body, type: "textarea", maxLength: 2000 },
          { name: "status", value: comment.status, options: ["PUBLISHED", "HIDDEN"] }, justification,
        ], async (data) => {
          await api.request(`/admin/comments/${comment.id}`, { method: "PATCH", body: data });
          await communityDetail(row.id, module);
        })));
        if (comment.status === "PUBLISHED") tools.append(button("Ẩn bình luận", () => form("Ẩn bình luận", [justification], async (data) => {
          await api.request(`/admin/comments/${comment.id}`, { method: "DELETE", body: data });
          await communityDetail(row.id, module);
        })));
        card.append(tools);
        comments.append(card);
      }
      if (result.next_cursor) {
        const next = button("Thêm bình luận", async () => { next.disabled = true; await commentPage(result.next_cursor); next.remove(); });
        comments.append(next);
      }
    }
    await commentPage();
  } catch (error) {
    if (version === detailVersion) body.replaceChildren(node("p", error.message));
  }
}
