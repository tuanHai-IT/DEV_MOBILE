import { createContext, requireThat } from "../src/core.js";
import { seedSocialDemo } from "./seed-social.js";

const ctx = createContext();
requireThat(
  ctx.emulator && (process.env.GCLOUD_PROJECT ?? "").startsWith("demo-"),
  400,
  "EMULATOR_ONLY",
  "Seed chỉ chạy trên project demo-* với đủ ba emulator.",
);
const password = "EcoShareDemo123!";
for (const [uid, role, name] of [
  ["demo-admin", "ADMIN", "Quản trị EcoShare"],
  ["demo-seller", "MEMBER", "Người bán mẫu"],
  ["demo-buyer", "MEMBER", "Người mua mẫu"],
  ["demo-moderator", "MODERATOR", "Kiểm duyệt viên"],
]) {
  const email = `${uid.replace("demo-", "")}@ecoshare.test`;
  const verificationId = `verification-${uid}`;
  try {
    await ctx.auth.createUser({
      uid,
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/uid-already-exists")
      throw error;
  }
  const ref = ctx.db.collection("users").doc(uid);
  if (!(await ref.get()).exists) {
    await ref.create({
      id: uid,
      display_name: name,
      email,
      role,
      status: "ACTIVE",
      bio: "Tài khoản kiểm thử cục bộ",
      city: "TP.HCM",
      created_at: ctx.now(),
      points_balance: 0,
      _verification_id: verificationId,
      _pending_verification_id: null,
      verification_status: "VERIFIED",
    });
    await ctx.db
      .collection("verifications")
      .doc(verificationId)
      .set({
        id: `verification-${uid}`,
        user_id: uid,
        status: "VERIFIED",
        submitted_at: ctx.now(),
        reviewer_id: "emulator-seed",
        reviewed_at: ctx.now(),
        expires_at: "2099-01-01T00:00:00.000Z",
        reason: "Chỉ dùng trong Firebase Emulator",
      });
  }
  // These fixed identities are local QA accounts. Keep their role and login labels
  // aligned when a previous seed or test left a stale role in the emulator.
  await ref.set({
    id: uid,
    display_name: name,
    email,
    role,
    status: "ACTIVE",
    _verification_id: verificationId,
    _pending_verification_id: null,
    verification_status: "VERIFIED",
  }, { merge: true });
  await ctx.db.collection("verifications").doc(verificationId).set({
    id: verificationId,
    user_id: uid,
    status: "VERIFIED",
    submitted_at: ctx.now(),
    reviewer_id: "emulator-seed",
    reviewed_at: ctx.now(),
    expires_at: "2099-01-01T00:00:00.000Z",
    reason: "Chỉ dùng trong Firebase Emulator",
  }, { merge: true });
}
const rows: Record<string, Record<string, unknown>> = {
  "categories/reuse": {
    id: "reuse",
    name: "Đồ dùng tái sử dụng",
    description: "Đồ gia dụng, đồ trang trí đã qua sử dụng",
    active: true,
  },
  "listings/demo-lamp": {
    id: "demo-lamp",
    seller_id: "demo-seller",
    kind: "SALE",
    title: "Đèn bàn tái sử dụng",
    description: "Đèn bàn còn tốt, sẵn sàng cho một ngôi nhà mới.",
    city: "TP.HCM",
    status: "APPROVED",
    tags_json: '["tái sử dụng"]',
    latitude: null,
    longitude: null,
    created_at: ctx.now(),
    moderator_id: "demo-admin",
    moderation_reason: "Dữ liệu emulator",
  },
  "listing_items/demo-lamp-item": {
    id: "demo-lamp-item",
    listing_id: "demo-lamp",
    category_id: "reuse",
    name: "Đèn bàn",
    material: "Kim loại",
    condition: "GOOD",
    price_vnd: 120000,
    stock: 10,
    unit: "cái",
    _reserved: 0,
  },
  "addresses/demo-buyer-home": {
    id: "demo-buyer-home",
    user_id: "demo-buyer",
    recipient: "Người mua mẫu",
    phone: "0900000000",
    line: "123 Đường Mẫu",
    city: "TP.HCM",
    is_default: true,
  },
  "collection_points/demo-point": {
    id: "demo-point",
    manager_id: "demo-admin",
    name: "Điểm thu gom mẫu",
    address: "TP.HCM",
    latitude: 10.7769,
    longitude: 106.7009,
    materials: "Giấy, nhựa, kim loại",
    opening_hours: "08:00–17:00",
    status: "ACTIVE",
  },
  "content_entries/demo-guide": {
    id: "demo-guide",
    author_id: "demo-admin",
    parent_id: null,
    kind: "ARTICLE",
    title: "Phân loại trước khi tái chế",
    body: "Làm sạch, phân loại giấy, nhựa và kim loại trước khi đưa đến điểm thu gom.",
    status: "PUBLISHED",
    starts_at: null,
    ends_at: null,
    points_cost: null,
    metadata_json: "{}",
  },
};
for (const [path, data] of Object.entries(rows)) {
  const ref = ctx.db.doc(path);
  if (!(await ref.get()).exists) await ref.create(data);
}
console.log(
  "Đã thêm dữ liệu còn thiếu vào emulator. Không ghi đè dữ liệu hiện có.",
);
console.log(
  "Local accounts: admin / seller / buyer / moderator @ecoshare.test; password: " +
    password,
);
await seedSocialDemo(ctx);
