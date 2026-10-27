const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const pageUrl = (page) => new URL(typeof page === "string" ? page : page.href);

export function configModuleForPage(page) {
  const url = pageUrl(page);
  if (loopback.has(url.hostname) && ["http:", "https:"].includes(url.protocol))
    return "./firebase-config.local.js";
  if (url.protocol !== "https:")
    throw new Error("Trang quản trị cloud phải được phục vụ qua HTTPS.");
  return "./firebase-config.production.js";
}

export function validateWebConfig(config, page) {
  const url = pageUrl(page);
  const local = configModuleForPage(url) === "./firebase-config.local.js";
  if (!config || typeof config !== "object" ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId ?? "") ||
      !/^[A-Za-z0-9_-]{1,512}$/.test(config.apiKey ?? ""))
    throw new Error("Cấu hình public Firebase chưa hợp lệ.");
  const api = new URL(config.apiBase, url.origin);
  if (!local && (config.emulator !== false || config.projectId.startsWith("demo-") ||
      config.authEmulatorHost || config.localCloudProxy || config.apiBase !== "/api/v1" ||
      api.origin !== url.origin || api.protocol !== "https:"))
    throw new Error("Cấu hình cloud phải dùng Firebase thật và API cùng origin /api/v1.");
  if (local && config.emulator &&
      (!config.projectId.startsWith("demo-") || api.protocol !== "http:" || !loopback.has(api.hostname)))
    throw new Error("Cấu hình Emulator phải dùng project demo-* và API localhost.");
  if (config.localCloudProxy && (config.localCloudProxy !== true || !local ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !["localhost", "127.0.0.1"].includes(api.hostname) || api.protocol !== "http:" ||
      config.emulator !== false || config.authEmulatorHost || config.projectId.startsWith("demo-")))
    throw new Error("API cloud qua máy tính cần trang/API localhost và Firebase Auth thật.");
  return { ...config };
}

/** A hosted page never imports the developer's local Emulator configuration. */
export async function loadFirebaseWebConfig(page = globalThis.location, importer = (path) => import(path)) {
  const module = await importer(configModuleForPage(page));
  return validateWebConfig(module.default, page);
}
