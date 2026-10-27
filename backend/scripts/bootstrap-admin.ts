import { createContext, requireThat } from "../src/core.js";

const ctx = createContext(),
  uid = process.env.BOOTSTRAP_ADMIN_UID;
requireThat(
  uid,
  400,
  "UID_REQUIRED",
  "Đặt BOOTSTRAP_ADMIN_UID là UID tài khoản Firebase Auth đã tạo.",
);
const authUser = await ctx.auth.getUser(uid);
requireThat(
  !authUser.disabled,
  400,
  "ACCOUNT_DISABLED",
  "Tài khoản Auth bị tắt.",
);
const ref = ctx.db.collection("users").doc(uid);
await ctx.db.runTransaction(async (tx) => {
  const existing = await tx.get(ref);
  const admins = await tx.get(
    ctx.db
      .collection("users")
      .where("role", "==", "ADMIN")
      .where("status", "==", "ACTIVE")
      .limit(1),
  );
  requireThat(
    admins.empty || admins.docs[0].id === uid,
    409,
    "ADMIN_ALREADY_EXISTS",
    "Đã có admin hoạt động. Hãy phân quyền qua API Admin.",
  );
  tx.set(
    ref,
    {
      ...(existing.exists
        ? {}
        : {
            id: uid,
            display_name: authUser.displayName ?? "Quản trị viên",
            email: authUser.email ?? null,
            created_at: ctx.now(),
            points_balance: 0,
            _verification_id: null,
            _pending_verification_id: null,
          }),
      role: "ADMIN",
      status: "ACTIVE",
      updated_at: ctx.now(),
    },
    { merge: true },
  );
  const audit = ctx.db.collection("audit_logs").doc();
  tx.create(audit, {
    id: audit.id,
    actor_id: "bootstrap-admin-cli",
    action: "BOOTSTRAP_ADMIN",
    entity_type: "User",
    entity_id: uid,
    reason: "Khởi tạo quản trị viên đầu tiên qua môi trường có ADC",
    created_at: ctx.now(),
  });
});
console.log(
  "Đã khởi tạo admin UID " + uid + ". Không tự xác minh hồ sơ mua bán.",
);
