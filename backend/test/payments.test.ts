import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { sha, ApiError } from "../src/core.js";
import type { Context } from "../src/core.js";
import express, { type ErrorRequestHandler } from "express";
import type { Server } from "node:http";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  applyPaymentResult,
  canonicalVnpay,
  chargedOrderPatch,
  nextFinancialStatus,
  parseVnd,
  registerPaymentRoutes,
  signMomo,
  signVnpay,
  verifyMomoNotification,
  verifyVnpay,
} from "../src/payments.js";
import type { PaymentResult } from "../src/payments.js";
import type { Router } from "express";

const NOW = "2026-10-18T10:00:00.000Z";
const LATER = "2026-10-18T10:20:00.000Z";
type Row = Record<string, any>;

// In-memory transaction double checks the key Firestore invariant: every read precedes writes.
// Real isolation/concurrency and Security Rules are tested against Firebase Emulator separately.
function fixture(overrides: { order?: Row; payment?: Row; buyer?: Row } = {}) {
  const rows = new Map<string, Row>();
  rows.set("users/buyer", {
    status: "ACTIVE",
    _verification_id: "vb",
    points_balance: 0,
    ...overrides.buyer,
  });
  rows.set("users/seller", { status: "ACTIVE", _verification_id: "vs" });
  rows.set("verifications/vb", {
    user_id: "buyer",
    status: "VERIFIED",
    expires_at: LATER,
  });
  rows.set("verifications/vs", {
    user_id: "seller",
    status: "VERIFIED",
    expires_at: LATER,
  });
  rows.set("orders/order1", {
    buyer_id: "buyer",
    seller_id: "seller",
    status: "PENDING_PAYMENT",
    _reservation_state: "HELD",
    _active_payment_id: "p1",
    expires_at: LATER,
    ...overrides.order,
  });
  rows.set("payments/p1", {
    order_id: "order1",
    user_id: "buyer",
    provider: "EMULATOR",
    merchant_id: "firebase-emulator",
    amount_vnd: 100_000,
    status: "PENDING",
    kind: "CHARGE",
    ...overrides.payment,
  });
  let autoId = 0;
  const snapshot = (path: string) => ({
    exists: rows.has(path),
    id: path.split("/").at(-1)!,
    data: () => (rows.has(path) ? structuredClone(rows.get(path)) : undefined),
  });
  const collection = (name: string) => ({
    doc: (id = `auto_${++autoId}`) => ({ path: `${name}/${id}`, id }),
    where: (key: string, op: string, value: unknown) => ({
      collection: name,
      key,
      op,
      value,
    }),
  });
  const ctx = {
    now: () => NOW,
    emulator: true,
    db: {
      collection,
      runTransaction: async (run: (tx: any) => Promise<any>) => {
        let writing = false;
        const operations: (() => void)[] = [];
        const tx = {
          get: async (ref: any) => {
            assert.equal(
              writing,
              false,
              "Firestore transaction attempted a read after write",
            );
            if (ref.path) return snapshot(ref.path);
            return {
              docs: [...rows.entries()]
                .filter(
                  ([path, value]) =>
                    path.startsWith(`${ref.collection}/`) &&
                    value[ref.key] === ref.value,
                )
                .map(([path]) => snapshot(path)),
            };
          },
          update: (ref: any, patch: Row) => {
            writing = true;
            operations.push(() => {
              assert.ok(rows.has(ref.path));
              rows.set(ref.path, {
                ...rows.get(ref.path),
                ...structuredClone(patch),
              });
            });
          },
          create: (ref: any, row: Row) => {
            writing = true;
            operations.push(() => {
              assert.equal(rows.has(ref.path), false);
              rows.set(ref.path, structuredClone(row));
            });
          },
        };
        const result = await run(tx);
        operations.forEach((operation) => operation());
        return result;
      },
    },
  } as unknown as Context;
  return { ctx, rows };
}

const success: PaymentResult = {
  provider: "EMULATOR",
  merchant_id: "firebase-emulator",
  amount_vnd: 100_000,
  status: "SUCCEEDED",
  provider_transaction_id: "txn_100",
  provider_code: "00",
};

test("VND validation rejects fractions, unsafe numbers, exponent notation and nonpositive money", () => {
  for (const bad of [
    null,
    undefined,
    true,
    0,
    -100,
    1.5,
    "1e5",
    "01",
    "100.00",
    "100,000",
    Number.MAX_SAFE_INTEGER,
  ])
    assert.throws(() => parseVnd(bad));
  assert.equal(parseVnd("100000"), 100_000);
  assert.equal(parseVnd(100_000), 100_000);
});

test("VNPay canonicalization sorts fields, encodes spaces as plus and excludes hash metadata", () => {
  const input = {
    vnp_TxnRef: "p1",
    vnp_OrderInfo: "Thanh toan + 1",
    vnp_Amount: "10000000",
    vnp_SecureHash: "ignored",
    vnp_SecureHashType: "HmacSHA512",
    other: "ignored",
  };
  assert.equal(
    canonicalVnpay(input),
    "vnp_Amount=10000000&vnp_OrderInfo=Thanh+toan+%2B+1&vnp_TxnRef=p1",
  );
  assert.throws(() => canonicalVnpay({ vnp_TxnRef: ["p1", "p2"] }));
});

test("VNPay signature authenticates all payment fields and rejects malformed hashes", () => {
  const payload = {
    vnp_Amount: "10000000",
    vnp_TmnCode: "MERCHANT",
    vnp_TxnRef: "p1",
  };
  const expected = createHmac("sha512", "test-secret")
    .update("vnp_Amount=10000000&vnp_TmnCode=MERCHANT&vnp_TxnRef=p1")
    .digest("hex");
  assert.equal(signVnpay(payload, "test-secret"), expected);
  assert.equal(
    verifyVnpay({ ...payload, vnp_SecureHash: expected }, "test-secret"),
    true,
  );
  assert.equal(
    verifyVnpay(
      { ...payload, vnp_Amount: "1", vnp_SecureHash: expected },
      "test-secret",
    ),
    false,
  );
  assert.equal(
    verifyVnpay({ ...payload, vnp_SecureHash: "x".repeat(128) }, "test-secret"),
    false,
  );
  assert.equal(
    verifyVnpay({ ...payload, vnp_SecureHash: expected }, "wrong-secret"),
    false,
  );
});

test("MoMo IPN signature uses the exact official field order and authenticates amount and merchant", () => {
  const payload = {
    amount: 100000,
    extraData: "",
    message: "Successful.",
    orderId: "p1",
    orderInfo: "EcoShare",
    orderType: "momo_wallet",
    partnerCode: "MERCHANT",
    payType: "qr",
    requestId: "p1",
    responseTime: 1700000000000,
    resultCode: 0,
    transId: 1234,
  };
  const raw =
    "accessKey=access&amount=100000&extraData=&message=Successful.&orderId=p1&orderInfo=EcoShare&orderType=momo_wallet&partnerCode=MERCHANT&payType=qr&requestId=p1&responseTime=1700000000000&resultCode=0&transId=1234";
  const signature = createHmac("sha256", "secret").update(raw).digest("hex");
  assert.equal(
    verifyMomoNotification({ ...payload, signature }, "access", "secret"),
    true,
  );
  assert.equal(
    verifyMomoNotification(
      { ...payload, amount: 100, signature },
      "access",
      "secret",
    ),
    false,
  );
  assert.equal(
    verifyMomoNotification(
      { ...payload, partnerCode: "OTHER", signature },
      "access",
      "secret",
    ),
    false,
  );
  assert.equal(
    verifyMomoNotification({ ...payload, signature }, "wrong-access", "secret"),
    false,
  );
  assert.throws(() => signMomo({}, ["missing"], "secret"));
});

test("financial transitions preserve successful charges across late pending/failure notifications", () => {
  assert.equal(nextFinancialStatus("SUCCEEDED", "FAILED"), "SUCCEEDED");
  assert.equal(nextFinancialStatus("SUCCEEDED", "PENDING"), "SUCCEEDED");
  assert.equal(nextFinancialStatus("FAILED", "SUCCEEDED"), "SUCCEEDED");
  assert.equal(nextFinancialStatus("CANCELLED", "SUCCEEDED"), "SUCCEEDED");
  assert.equal(nextFinancialStatus("FAILED", "PENDING"), "FAILED");
});

test("only eligible live reservations become paid; charged late/invalid orders require review", () => {
  const normal = {
    status: "PENDING_PAYMENT",
    _reservation_state: "HELD",
    _active_payment_id: "p1",
    expires_at: LATER,
  };
  assert.equal(chargedOrderPatch(normal, "p1", true, NOW).status, "PAID");
  for (const changed of [
    { expires_at: NOW },
    { _reservation_state: "RELEASED" },
    { status: "CANCELLED" },
    { _active_payment_id: "p2" },
  ])
    assert.equal(
      chargedOrderPatch({ ...normal, ...changed }, "p1", true, NOW).status,
      "DISPUTED",
    );
  assert.equal(chargedOrderPatch(normal, "p1", false, NOW).status, "DISPUTED");
});

test("confirmed success atomically records the payment and consumes the order reservation", async () => {
  const { ctx, rows } = fixture();
  await applyPaymentResult(ctx, "p1", success);
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "PAID");
  assert.equal(rows.get("orders/order1")!._reservation_state, "CONSUMED");
  assert.equal(
    [...rows.keys()].filter((path) =>
      path.startsWith("system_settings/receipt_"),
    ).length,
    1,
  );
});

test("payment success is never discarded when either identity verification has been revoked", async () => {
  const { ctx, rows } = fixture({ buyer: { status: "SUSPENDED" } });
  await applyPaymentResult(ctx, "p1", success);
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "DISPUTED");
});

test("late genuine success after reservation release remains financial truth and disputes the order", async () => {
  const { ctx, rows } = fixture({
    order: {
      status: "CANCELLED",
      _reservation_state: "RELEASED",
      expires_at: NOW,
    },
    payment: { status: "FAILED" },
  });
  await applyPaymentResult(ctx, "p1", success);
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "DISPUTED");
  assert.equal(rows.get("orders/order1")!._reservation_state, "RELEASED");
});

test("charged suspicious provider results preserve the charge and stop fulfillment", async () => {
  const { ctx, rows } = fixture();
  await applyPaymentResult(ctx, "p1", { ...success, requires_review: true });
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "DISPUTED");
});

test("duplicate success and a later failure do not downgrade payment or duplicate audits", async () => {
  const { ctx, rows } = fixture();
  await applyPaymentResult(ctx, "p1", success);
  const auditCount = [...rows.keys()].filter((path) =>
    path.startsWith("audit_logs/"),
  ).length;
  await applyPaymentResult(ctx, "p1", success);
  await applyPaymentResult(ctx, "p1", { ...success, status: "FAILED" });
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "PAID");
  assert.equal(
    [...rows.keys()].filter((path) => path.startsWith("audit_logs/")).length,
    auditCount,
  );
});

test("wrong amounts, merchants and providers cannot settle a payment", async () => {
  for (const change of [
    { amount_vnd: 1 },
    { merchant_id: "attacker" },
    { provider: "MOMO" as const },
  ]) {
    const { ctx, rows } = fixture();
    await assert.rejects(
      applyPaymentResult(ctx, "p1", { ...success, ...change }),
      { code: "PAYMENT_MISMATCH" },
    );
    assert.equal(rows.get("payments/p1")!.status, "PENDING");
    assert.equal(rows.get("orders/order1")!.status, "PENDING_PAYMENT");
  }
});

test("one provider transaction cannot be replayed across two payments", async () => {
  const { ctx, rows } = fixture();
  rows.set("payments/p2", { ...rows.get("payments/p1")! });
  await applyPaymentResult(ctx, "p1", success);
  await assert.rejects(applyPaymentResult(ctx, "p2", success), {
    code: "PROVIDER_TRANSACTION_REPLAY",
  });
  assert.equal(rows.get("payments/p2")!.status, "PENDING");
});

test("full refund uses a separate record and reverses completion points exactly once", async () => {
  const { ctx, rows } = fixture({
    order: { status: "COMPLETED" },
    payment: { status: "SUCCEEDED", provider_transaction_id: "charge_txn" },
  });
  rows.set("users/buyer", { ...rows.get("users/buyer")!, points_balance: 10 });
  rows.set(`green_ledger/${sha("completed:order1:buyer")}`, {
    user_id: "buyer",
    order_id: "order1",
    points: 10,
    dedupe_key: "completed:order1:buyer",
  });
  rows.set("payments/r1", {
    ...rows.get("payments/p1")!,
    kind: "REFUND",
    parent_payment_id: "p1",
    status: "PENDING",
    provider_transaction_id: null,
  });
  const result = { ...success, provider_transaction_id: "refund_txn" };
  await applyPaymentResult(ctx, "r1", result);
  await applyPaymentResult(ctx, "r1", result);
  assert.equal(rows.get("payments/p1")!.status, "SUCCEEDED");
  assert.equal(rows.get("payments/r1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "REFUNDED");
  assert.equal(rows.get("users/buyer")!.points_balance, 0);
  assert.equal(
    rows.get(`green_ledger/${sha("refund:order1:buyer")}`)!.points,
    -10,
  );
});

test("refunding one of multiple successful charges leaves the order disputed", async () => {
  const { ctx, rows } = fixture({
    payment: { status: "SUCCEEDED", provider_transaction_id: "first" },
  });
  rows.set("payments/p2", {
    ...rows.get("payments/p1")!,
    provider_transaction_id: "second",
  });
  rows.set("payments/r1", {
    ...rows.get("payments/p1")!,
    kind: "REFUND",
    parent_payment_id: "p1",
    status: "PENDING",
  });
  await applyPaymentResult(ctx, "r1", {
    ...success,
    provider_transaction_id: "refund_txn",
  });
  assert.equal(rows.get("orders/order1")!.status, "DISPUTED");
});

test("confirmed full refund before shipment releases held inventory once", async () => {
  const { ctx, rows } = fixture({
    order: { status: "REFUND_PENDING", _reservation_state: "CONSUMED" },
    payment: { status: "SUCCEEDED", provider_transaction_id: "charge" },
  });
  rows.set("order_items/line1", {
    order_id: "order1",
    listing_item_id: "item1",
    quantity: 2,
  });
  rows.set("listing_items/item1", { stock: 3, _reserved: 2 });
  rows.set("payments/r1", {
    ...rows.get("payments/p1")!,
    kind: "REFUND",
    parent_payment_id: "p1",
    status: "PENDING",
  });
  const result = { ...success, provider_transaction_id: "refund" };
  await applyPaymentResult(ctx, "r1", result);
  await applyPaymentResult(ctx, "r1", result);
  assert.equal(rows.get("orders/order1")!.status, "REFUNDED");
  assert.equal(rows.get("orders/order1")!._inventory_released, true);
  assert.equal(rows.get("orders/order1")!._reservation_state, "RELEASED");
  assert.equal(rows.get("listing_items/item1")!.stock, 5);
  assert.equal(rows.get("listing_items/item1")!._reserved, 0);
});

test("refund after shipping never returns physical inventory automatically", async () => {
  const { ctx, rows } = fixture({
    order: {
      status: "REFUND_PENDING",
      _reservation_state: "CONSUMED",
      shipped_at: NOW,
    },
    payment: { status: "SUCCEEDED", provider_transaction_id: "charge" },
  });
  rows.set("order_items/line1", {
    order_id: "order1",
    listing_item_id: "item1",
    quantity: 2,
  });
  rows.set("listing_items/item1", { stock: 3, _reserved: 0 });
  rows.set("payments/r1", {
    ...rows.get("payments/p1")!,
    kind: "REFUND",
    parent_payment_id: "p1",
    status: "PENDING",
  });
  await applyPaymentResult(ctx, "r1", {
    ...success,
    provider_transaction_id: "refund",
  });
  assert.equal(rows.get("listing_items/item1")!.stock, 3);
  assert.equal(rows.get("orders/order1")!.status, "REFUNDED");
});

test("corrupted inventory cannot erase a real provider refund", async () => {
  const { ctx, rows } = fixture({
    order: { status: "REFUND_PENDING" },
    payment: { status: "SUCCEEDED", provider_transaction_id: "charge" },
  });
  rows.set("order_items/line1", {
    order_id: "order1",
    listing_item_id: "missing",
    quantity: 2,
  });
  rows.set("payments/r1", {
    ...rows.get("payments/p1")!,
    kind: "REFUND",
    parent_payment_id: "p1",
    status: "PENDING",
  });
  await applyPaymentResult(ctx, "r1", {
    ...success,
    provider_transaction_id: "refund",
  });
  assert.equal(rows.get("payments/r1")!.status, "SUCCEEDED");
  assert.equal(rows.get("orders/order1")!.status, "REFUNDED");
  assert.equal(rows.get("orders/order1")!._inventory_review_required, true);
});

test("emulator result route does not exist outside Firebase Emulator", () => {
  const paths: string[] = [];
  const router = {
    post: (path: string) => {
      paths.push(path);
    },
    get: (path: string) => {
      paths.push(path);
    },
  } as unknown as Router;
  const { ctx } = fixture();
  registerPaymentRoutes(router, { ...ctx, emulator: false });
  assert.equal(paths.includes("/emulator/payments/:id/result"), false);
  registerPaymentRoutes(router, ctx);
  assert.equal(paths.includes("/emulator/payments/:id/result"), true);
});

test(
  "payment API and actual Firestore transactions",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 90_000 },
  async (t) => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(host.hostname),
      "Only a loopback Firestore Emulator is permitted",
    );
    const prefix = `payment_${randomUUID().replaceAll("-", "")}`;
    const id = (suffix: string) => `${prefix}_${suffix}`;
    const firebase = initializeApp(
      { projectId: "demo-recycling-share" },
      prefix,
    );
    const ctx: Context = {
      db: getFirestore(firebase),
      auth: getAuth(firebase),
      bucket: {} as Context["bucket"],
      emulator: true,
      now: () => NOW,
    };
    const seed = async (collection: string, key: string, row: Row) => {
      await ctx.db
        .collection(collection)
        .doc(key)
        .set({ id: key, ...row });
    };
    let server: Server | undefined;
    const savedEnvironment = {
      MOMO_PARTNER_CODE: process.env.MOMO_PARTNER_CODE,
      MOMO_SECRET_KEY: process.env.MOMO_SECRET_KEY,
      MOMO_ACCESS_KEY: process.env.MOMO_ACCESS_KEY,
      VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE,
      VNPAY_HASH_SECRET: process.env.VNPAY_HASH_SECRET,
      ENABLED_PAYMENT_PROVIDERS: process.env.ENABLED_PAYMENT_PROVIDERS,
    };
    try {
      for (const [suffix, role] of [
        ["buyer", "MEMBER"],
        ["seller", "MEMBER"],
        ["admin", "ADMIN"],
        ["outsider", "MEMBER"],
      ]) {
        await seed("users", id(suffix), {
          role,
          status: "ACTIVE",
          _verification_id: id(`v_${suffix}`),
          points_balance: 0,
        });
        await seed("verifications", id(`v_${suffix}`), {
          user_id: id(suffix),
          status: "VERIFIED",
          expires_at: LATER,
        });
      }
      async function seedOrder(suffix: string) {
        await seed("orders", id(suffix), {
          buyer_id: id("buyer"),
          seller_id: id("seller"),
          _member_ids: [id("buyer"), id("seller")],
          status: "PENDING_PAYMENT",
          _reservation_state: "HELD",
          _active_payment_id: null,
          total_vnd: 100000,
          expires_at: LATER,
        });
        await seed("order_items", id(`${suffix}_line`), {
          order_id: id(suffix),
          listing_item_id: id(`${suffix}_stock`),
          quantity: 2,
        });
        await seed("listing_items", id(`${suffix}_stock`), {
          stock: 3,
          _reserved: 2,
        });
      }
      await seedOrder("order");
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        const uid = req.get("X-Test-User");
        if (!uid) {
          next();
          return;
        }
        void ctx.db
          .collection("users")
          .doc(uid)
          .get()
          .then((snapshot) => {
            if (snapshot.exists)
              res.locals.actor = {
                uid,
                role: snapshot.data()!.role,
                status: snapshot.data()!.status,
              };
            next();
          })
          .catch(next);
      });
      registerPaymentRoutes(app, ctx);
      const errors: ErrorRequestHandler = (error, _req, res, _next) => {
        res
          .status(error instanceof ApiError ? error.status : 500)
          .json({
            error: error instanceof ApiError ? error.code : String(error),
          });
      };
      app.use(errors);
      server = await new Promise<Server>((resolve) => {
        const running = app.listen(0, "127.0.0.1", () => resolve(running));
      });
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}`;
      async function request(
        who: string | null,
        method: string,
        path: string,
        body?: unknown,
        key?: string,
      ) {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            ...(who ? { "X-Test-User": id(who) } : {}),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        return {
          status: response.status,
          body: text ? JSON.parse(text) : null,
        };
      }
      let paymentId = "";
      await t.test(
        "requires owner authentication, explicit emulator provider and idempotent checkout",
        async () => {
          const path = `/orders/${id("order")}/payment-sessions`;
          assert.equal(
            (
              await request(
                null,
                "POST",
                path,
                { provider: "EMULATOR" },
                "checkout_1",
              )
            ).status,
            401,
          );
          assert.equal(
            (
              await request(
                "seller",
                "POST",
                path,
                { provider: "EMULATOR" },
                "checkout_1",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "buyer",
                "POST",
                path,
                { provider: "EMULATOR", amount_vnd: 1 },
                "checkout_1",
              )
            ).status,
            400,
          );
          assert.equal(
            (await request("buyer", "POST", path, { provider: "EMULATOR" }))
              .status,
            400,
          );
          const created = await request(
            "buyer",
            "POST",
            path,
            { provider: "EMULATOR" },
            "checkout_1",
          );
          assert.equal(created.status, 201, JSON.stringify(created.body));
          paymentId = created.body.data.id;
          assert.equal(created.body.data.amount_vnd, 100000);
          assert.equal(created.body.data.provider, "EMULATOR");
          assert.equal(
            Object.keys(created.body.data).some((key) => key.startsWith("_")),
            false,
          );
          const retried = await request(
            "buyer",
            "POST",
            path,
            { provider: "EMULATOR" },
            "checkout_1",
          );
          assert.equal(retried.body.data.id, paymentId);
          assert.equal(
            (
              await request(
                "buyer",
                "POST",
                path,
                { provider: "EMULATOR" },
                "checkout_2",
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await request(
                "outsider",
                "GET",
                `/orders/${id("order")}/payments`,
              )
            ).status,
            403,
          );
        },
      );
      await t.test(
        "only admin settles emulator payments; duplicate outcomes are safe",
        async () => {
          const path = `/emulator/payments/${paymentId}/result`;
          assert.equal(
            (await request("buyer", "POST", path, { status: "SUCCEEDED" }))
              .status,
            403,
          );
          const responses = await Promise.all([
            request("admin", "POST", path, { status: "SUCCEEDED" }),
            request("admin", "POST", path, { status: "SUCCEEDED" }),
          ]);
          assert.ok(
            responses.every((response) => response.status === 200),
            JSON.stringify(responses),
          );
          const order = (
            await ctx.db.collection("orders").doc(id("order")).get()
          ).data()!;
          assert.equal(order.status, "PAID");
          assert.equal(order._reservation_state, "CONSUMED");
          const audit = await ctx.db
            .collection("audit_logs")
            .where("entity_id", "==", paymentId)
            .get();
          assert.equal(
            audit.docs.filter(
              (row) => row.data().action === "PAYMENT_SUCCEEDED",
            ).length,
            1,
          );
        },
      );
      await t.test(
        "full refund is a separate payment, settles only on confirmation, restores inventory once",
        async () => {
          const path = `/admin/payments/${paymentId}/refund`;
          assert.equal(
            (
              await request("buyer", "POST", path, {
                reason: "Customer refund requested",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("admin", "POST", path, {
                reason: "Customer refund requested",
                amount_vnd: 100000,
              })
            ).status,
            400,
          );
          const refund = await request("admin", "POST", path, {
            reason: "Customer refund requested",
          });
          assert.equal(refund.status, 202, JSON.stringify(refund.body));
          const refundId = refund.body.data.id;
          assert.equal(refund.body.data.parent_payment_id, paymentId);
          assert.equal(
            (await ctx.db.collection("orders").doc(id("order")).get()).data()!
              .status,
            "REFUND_PENDING",
          );
          const retry = await request("admin", "POST", path, {
            reason: "Customer refund requested",
          });
          assert.equal(retry.body.data.id, refundId);
          assert.equal(
            (
              await request(
                "admin",
                "POST",
                `/emulator/payments/${refundId}/result`,
                { status: "SUCCEEDED" },
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                "admin",
                "POST",
                `/emulator/payments/${refundId}/result`,
                { status: "SUCCEEDED" },
              )
            ).status,
            200,
          );
          assert.equal(
            (await ctx.db.collection("orders").doc(id("order")).get()).data()!
              .status,
            "REFUNDED",
          );
          assert.equal(
            (await ctx.db.collection("payments").doc(paymentId).get()).data()!
              .status,
            "SUCCEEDED",
          );
          const stock = (
            await ctx.db
              .collection("listing_items")
              .doc(id("order_stock"))
              .get()
          ).data()!;
          assert.equal(stock.stock, 5);
          assert.equal(stock._reserved, 0);
        },
      );
      await t.test(
        "disabled live providers fail before database writes",
        async () => {
          await seedOrder("disabled");
          process.env.ENABLED_PAYMENT_PROVIDERS = "";
          const result = await request(
            "buyer",
            "POST",
            `/orders/${id("disabled")}/payment-sessions`,
            { provider: "MOMO" },
            "checkout_disabled",
          );
          assert.equal(result.status, 503);
          assert.equal(result.body.error, "PAYMENT_PROVIDER_DISABLED");
          assert.equal(
            (
              await ctx.db
                .collection("payments")
                .where("order_id", "==", id("disabled"))
                .get()
            ).size,
            0,
          );
        },
      );
      await t.test(
        "MoMo IPN rejects tampering and records correctly signed provider success",
        async () => {
          process.env.MOMO_PARTNER_CODE = "PAYMENT_TEST";
          process.env.MOMO_SECRET_KEY = "test-secret";
          process.env.MOMO_ACCESS_KEY = "test-access";
          await seedOrder("momo");
          const momoId = id("momo_payment");
          await seed("payments", momoId, {
            order_id: id("momo"),
            user_id: id("buyer"),
            provider: "MOMO",
            merchant_id: "PAYMENT_TEST",
            amount_vnd: 100000,
            status: "PENDING",
            kind: "CHARGE",
          });
          await ctx.db
            .collection("orders")
            .doc(id("momo"))
            .update({ _active_payment_id: momoId });
          const body: Row = {
            amount: 100000,
            extraData: "",
            message: "Successful.",
            orderId: momoId,
            orderInfo: "EcoShare",
            orderType: "momo_wallet",
            partnerCode: "PAYMENT_TEST",
            payType: "qr",
            requestId: momoId,
            responseTime: 1700000000000,
            resultCode: 0,
            transId: `${prefix}_momo_txn`,
          };
          const keys = [
            "accessKey",
            "amount",
            "extraData",
            "message",
            "orderId",
            "orderInfo",
            "orderType",
            "partnerCode",
            "payType",
            "requestId",
            "responseTime",
            "resultCode",
            "transId",
          ];
          body.signature = signMomo(
            { ...body, accessKey: "test-access" },
            keys,
            "test-secret",
          );
          assert.equal(
            (
              await request(null, "POST", "/payments/momo/ipn", {
                ...body,
                amount: 1,
              })
            ).status,
            400,
          );
          assert.equal(
            (await ctx.db.collection("payments").doc(momoId).get()).data()!
              .status,
            "PENDING",
          );
          assert.equal(
            (await request(null, "POST", "/payments/momo/ipn", body)).status,
            204,
          );
          assert.equal(
            (await request(null, "POST", "/payments/momo/ipn", body)).status,
            204,
          );
          assert.equal(
            (await ctx.db.collection("orders").doc(id("momo")).get()).data()!
              .status,
            "PAID",
          );
        },
      );
      await t.test(
        "VNPay verifies signature and x100 amount; charged suspicious results are disputed",
        async () => {
          process.env.VNPAY_TMN_CODE = "PAYTEST";
          process.env.VNPAY_HASH_SECRET = "test-secret";
          await seedOrder("vnpay");
          const vnpId = id("vnp_payment");
          await seed("payments", vnpId, {
            order_id: id("vnpay"),
            user_id: id("buyer"),
            provider: "VNPAY",
            merchant_id: "PAYTEST",
            amount_vnd: 100000,
            status: "PENDING",
            kind: "CHARGE",
          });
          await ctx.db
            .collection("orders")
            .doc(id("vnpay"))
            .update({ _active_payment_id: vnpId });
          const body: Record<string, string> = {
            vnp_TxnRef: vnpId,
            vnp_TmnCode: "PAYTEST",
            vnp_Amount: "10000000",
            vnp_ResponseCode: "07",
            vnp_TransactionStatus: "07",
            vnp_TransactionNo: `${prefix}_vnp_txn`,
          };
          const signature = signVnpay(body, "test-secret");
          const wrong = new URLSearchParams({
            ...body,
            vnp_Amount: "10000",
            vnp_SecureHash: signature,
          });
          assert.equal(
            (await request(null, "GET", `/payments/vnpay/ipn?${wrong}`)).body
              .RspCode,
            "97",
          );
          const result = await request(
            null,
            "GET",
            `/payments/vnpay/ipn?${new URLSearchParams({ ...body, vnp_SecureHash: signature })}`,
          );
          assert.equal(result.body.RspCode, "00", JSON.stringify(result));
          assert.equal(
            (await ctx.db.collection("payments").doc(vnpId).get()).data()!
              .status,
            "SUCCEEDED",
          );
          assert.equal(
            (await ctx.db.collection("orders").doc(id("vnpay")).get()).data()!
              .status,
            "DISPUTED",
          );
        },
      );
    } finally {
      for (const [key, value] of Object.entries(savedEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (server)
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      await deleteApp(firebase);
    }
  },
);
