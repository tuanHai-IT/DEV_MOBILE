import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { createContext, sha, type Context } from "../src/core.js";
import { expireOrders } from "../src/marketplace.js";

const enabled = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
  process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);
let ctx: Context, server: Server, base: string;
const prefix = "api_" + randomUUID().replaceAll("-", "");
const users: Record<string, { uid: string; token: string }> = {};
before(async () => {
  if (!enabled) return;
  for (const host of [
    process.env.FIRESTORE_EMULATOR_HOST,
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  ])
    assert.match(host!, /^(127\.0\.0\.1|localhost):\d+$/);
  assert.equal(process.env.GCLOUD_PROJECT, "demo-recycling-share");
  ctx = createContext();
  server = createApp(ctx).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  for (const role of ["buyer", "buyer2", "seller", "admin", "moderator", "stranger"]) {
    const result = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${prefix}_${role}@example.test`,
          password: "LocalTest123!",
          returnSecureToken: true,
        }),
      },
    );
    const data = (await result.json()) as any;
    assert.equal(result.status, 200);
    users[role] = { uid: data.localId, token: data.idToken };
    await ctx.db
      .collection("users")
      .doc(data.localId)
      .set({
        id: data.localId,
        email: `${role}@test.local`,
        display_name: role,
        role: role === "admin" ? "ADMIN" : role === "moderator" ? "MODERATOR" : "MEMBER",
        status: "ACTIVE",
        points_balance: 0,
        _verification_id: `${prefix}_${role}`,
        _pending_verification_id: null,
        // Deliberately fake declaration for unrelated marketplace behavior tests.
        _payout_account: { method: "BANK", bank_name: "Test bank", account_number: "0000000000", account_holder: "Test account", updated_at: ctx.now() },
      });
    await ctx.db
      .collection("verifications")
      .doc(`${prefix}_${role}`)
      .set({
        id: `${prefix}_${role}`,
        user_id: data.localId,
        status: "VERIFIED",
        expires_at: "2099-01-01T00:00:00.000Z",
      });
    await ctx.db
      .collection("addresses")
      .doc(`${prefix}_${role}`)
      .set({
        id: `${prefix}_${role}`,
        user_id: data.localId,
        recipient: role,
        phone: "0900000000",
        line: "Test",
        city: "HCM",
        is_default: true,
      });
  }
});
after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});
async function api(
  path: string,
  role?: string,
  body?: unknown,
  key?: string,
  method?: string,
) {
  const result = await fetch(base + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(role ? { Authorization: `Bearer ${users[role].token}` } : {}),
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await result.text();
  return { status: result.status, body: text ? JSON.parse(text) as any : null };
}
async function fixture(stock = 1) {
  const id = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  await ctx.db
    .collection("listings")
    .doc(id)
    .set({
      id,
      seller_id: users.seller.uid,
      status: "APPROVED",
      kind: "SALE",
      title: "Test item",
      city: "HCM",
    });
  await ctx.db
    .collection("listing_items")
    .doc(id)
    .set({
      id,
      listing_id: id,
      stock,
      _reserved: 0,
      price_vnd: 120000,
      name: "Test item",
    });
  return id;
}
const checkout = (item: string, role = "buyer") => ({
  address_id: `${prefix}_${role}`,
  items: [{ listing_item_id: item, quantity: 1 }],
});
test("market cards receive the real item price, ready photo and public seller", {skip: !enabled}, async () => {
  const id = `${prefix}_market_preview`, mediaId = `${id}_photo`;
  await ctx.db.collection("listings").doc(id).set({id, seller_id: users.seller.uid,
    status: "APPROVED", kind: "SALE", title: "Đèn lọ thủy tinh thử nghiệm",
    description: "Đèn làm từ lọ thủy tinh cũ.", city: "HCM", created_at: ctx.now()});
  await ctx.db.collection("listing_items").doc(`${id}_item`).set({id: `${id}_item`, listing_id: id,
    price_vnd: 120000, stock: 1, name: "Đèn lọ thủy tinh"});
  await ctx.db.collection("media_assets").doc(mediaId).set({id: mediaId,
    _parent_type: "LISTING", _parent_id: id, _status: "READY", mime_type: "image/jpeg", visibility: "PUBLIC"});
  const feed = await api("/listings?limit=100");
  assert.equal(feed.status, 200);
  const card = feed.body.items.find((row: any) => row.id === id);
  assert.equal(card?.min_price_vnd, 120000);
  assert.equal(card?.preview_media_id, mediaId);
  assert.equal(card?.seller?.display_name, "seller");
  const search = await api("/explore/search?q=l%E1%BB%8D%20th%E1%BB%A7y%20tinh&limit=20");
  assert.equal(search.status, 200);
  assert.equal(search.body.items.find((row: any) => row.id === id)?.min_price_vnd, 120000);
});
test("message lists show the real partner and keep pending requests separate", {skip: !enabled}, async () => {
  const acceptedId = `${prefix}_accepted_chat`, pendingId = `${prefix}_pending_chat`;
  await ctx.db.collection("conversations").doc(acceptedId).set({id: acceptedId,
    member_a_id: users.buyer2.uid, member_b_id: users.seller.uid,
    _member_ids: [users.buyer2.uid, users.seller.uid].sort(), status: "ACCEPTED",
    last_message: "Chào bạn", updated_at: ctx.now(), created_at: ctx.now()});
  await ctx.db.collection("conversations").doc(pendingId).set({id: pendingId,
    member_a_id: users.buyer.uid, member_b_id: users.seller.uid,
    _member_ids: [users.buyer.uid, users.seller.uid].sort(), status: "PENDING",
    request_sender_id: users.buyer.uid, request_recipient_id: users.seller.uid,
    last_message: "Xin chào", created_at: ctx.now()});
  const conversations = await api("/conversations?limit=100", "seller");
  assert.equal(conversations.status, 200);
  assert.equal(conversations.body.items.find((row: any) => row.id === acceptedId)?.partner?.display_name, "buyer2");
  assert.equal(conversations.body.items.some((row: any) => row.id === pendingId), false);
  const requests = await api("/message-requests?limit=100", "seller");
  assert.equal(requests.status, 200);
  assert.equal(requests.body.items.find((row: any) => row.id === pendingId)?.sender?.display_name, "buyer");
});
test(
  "real Firebase token required; live role prevents escalation; invalid JSON rejected",
  { skip: !enabled },
  async () => {
    assert.equal((await api("/me")).status, 401);
    assert.equal((await api("/admin/users", "buyer")).status, 403);
    const forged = await fetch(base + "/me", {
      headers: { Authorization: "Bearer forged" },
    });
    assert.equal(forged.status, 401);
    assert.equal(
      (
        await api(
          "/orders",
          "buyer",
          { ...checkout("unknown"), total_vnd: 1 },
          prefix + "_bad",
        )
      ).status,
      400,
    );
  },
);
test(
  "atomic checkout: exactly one buyer gets final unit; idempotent retry keeps same snapshot",
  { skip: !enabled },
  async () => {
    const item = await fixture(),
      key = prefix + "_race";
    const results = await Promise.all([
      api("/orders", "buyer", checkout(item), key),
      api("/orders", "buyer2", checkout(item, "buyer2"), key),
    ]);
    assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
    const winner = results[0].status === 201 ? "buyer" : "buyer2";
    const response = await api("/orders", winner, checkout(item, winner), key);
    assert.equal(response.status, 201);
    assert.equal(response.body.total_vnd, 120000);
    assert.equal(
      (await ctx.db.collection("listing_items").doc(item).get()).data()!.stock,
      0,
    );
    assert.equal(
      (await api("/orders/" + response.body.id, "stranger")).status,
      403,
    );
    assert.equal(
      (
        await api("/orders/" + response.body.id + "/cancel", winner, {
          reason: "Thay đổi nhu cầu mua hàng",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api("/orders/" + response.body.id + "/cancel", winner, {
          reason: "Lặp lại yêu cầu hủy đơn",
        })
      ).status,
      200,
    );
    assert.equal(
      (await ctx.db.collection("listing_items").doc(item).get()).data()!.stock,
      1,
    );
  },
);
test(
  "both parties verification checked; self buying and foreign address blocked",
  { skip: !enabled },
  async () => {
    const item = await fixture(5);
    await ctx.db
      .collection("verifications")
      .doc(`${prefix}_seller`)
      .update({ status: "REJECTED" });
    assert.equal(
      (await api("/orders", "buyer", checkout(item), prefix + "_kyc")).status,
      403,
    );
    await ctx.db
      .collection("verifications")
      .doc(`${prefix}_seller`)
      .update({ status: "VERIFIED" });
    assert.equal(
      (
        await api(
          "/orders",
          "seller",
          checkout(item, "seller"),
          prefix + "_self",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api(
          "/orders",
          "buyer",
          checkout(item, "buyer2"),
          prefix + "_address",
        )
      ).status,
      403,
    );
  },
);
test(
  "purchase -> confirmed charge -> shipment -> completion -> refund keeps financial ledger exact",
  { skip: !enabled },
  async () => {
    const item = await fixture(3),
      order = (await api("/orders", "buyer", checkout(item), prefix + "_flow"))
        .body;
    assert.equal(
      (
        await api(`/orders/${order.id}/ship`, "seller", {
          carrier: "Test",
          tracking_code: "123",
        })
      ).status,
      409,
    );
    const session = await api(
      `/orders/${order.id}/payment-sessions`,
      "buyer",
      { provider: "EMULATOR" },
      prefix + "_payment",
    );
    assert.equal(session.status, 201, JSON.stringify(session.body));
    const payment = session.body.data;
    assert.equal(
      (
        await api(`/orders/${order.id}/cancel`, "buyer", {
          reason: "Không được hủy khi đang thanh toán",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(`/emulator/payments/${payment.id}/result`, "buyer", {
          status: "SUCCEEDED",
        })
      ).status,
      403,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await api(`/emulator/payments/${payment.id}/result`, "admin", {
            status: "SUCCEEDED",
          })
        ).status,
        200,
      );
    assert.equal(
      (
        await api(`/orders/${order.id}/ship`, "seller", {
          carrier: "Test",
          tracking_code: "123",
        })
      ).status,
      200,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await api(`/orders/${order.id}/complete`, "buyer", {})).status,
        200,
      );
    const ledger = await ctx.db
      .collection("green_ledger")
      .doc(sha(`completed:${order.id}:${users.buyer.uid}`))
      .get();
    assert.equal(ledger.data()!.points, 10);
    const refund = await api(`/admin/payments/${payment.id}/refund`, "admin", {
      reason: "Hoàn tiền theo khiếu nại hợp lệ",
    });
    assert.equal(refund.status, 202, JSON.stringify(refund.body));
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await api(
            `/emulator/payments/${refund.body.data.id}/result`,
            "admin",
            { status: "SUCCEEDED" },
          )
        ).status,
        200,
      );
    assert.equal(
      (await ctx.db.collection("orders").doc(order.id).get()).data()!.status,
      "REFUNDED",
    );
    assert.equal(
      (await ctx.db.collection("users").doc(users.buyer.uid).get()).data()!
        .points_balance,
      0,
    );
    assert.equal(
      (await ctx.db.collection("listing_items").doc(item).get()).data()!.stock,
      2,
    );
  },
);
test(
  "admins may resolve a dispute on their own order after payment checks pass",
  { skip: !enabled },
  async () => {
    const item = await fixture(2);
    const order = await api(
      "/orders",
      "admin",
      checkout(item, "admin"),
      prefix + "_admin_self_order",
    );
    assert.equal(order.status, 201);
    const session = await api(
      `/orders/${order.body.id}/payment-sessions`,
      "admin",
      { provider: "EMULATOR" },
      prefix + "_admin_self_payment",
    );
    assert.equal(session.status, 201);
    assert.equal(
      (
        await api(
          `/emulator/payments/${session.body.data.id}/result`,
          "admin",
          { status: "SUCCEEDED" },
        )
      ).status,
      200,
    );
    const report = await api("/reports", "admin", {
      order_id: order.body.id,
      reason: "Check this transaction and its delivery status",
    });
    assert.equal(report.status, 201);
    assert.equal(
      (
        await api(`/admin/reports/${report.body.id}/resolve`, "admin", {
          status: "DISMISSED",
          reason: "Reviewed the transaction and confirmed it can continue",
        })
      ).status,
      200,
    );
    const resumed = await api(`/admin/orders/${order.body.id}/resume`, "admin", {
      reason: "Payment and delivery checks pass for this transaction",
    });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.status, "PAID");
  },
);
test(
  "expired unpaid order releases its reservation exactly once",
  { skip: !enabled },
  async () => {
    const item = await fixture(),
      order = (
        await api("/orders", "buyer", checkout(item), prefix + "_expiry")
      ).body;
    await ctx.db
      .collection("orders")
      .doc(order.id)
      .update({ expires_at: "2000-01-01T00:00:00.000Z" });
    await expireOrders(ctx);
    await expireOrders(ctx);
    assert.equal(
      (await ctx.db.collection("listing_items").doc(item).get()).data()!.stock,
      1,
    );
    assert.equal(
      (await ctx.db.collection("orders").doc(order.id).get()).data()!.status,
      "CANCELLED",
    );
  },
);
test(
  "admins may review their own listings while moderators remain blocked",
  { skip: !enabled },
  async () => {
    const adminListing = `${prefix}_admin_listing_${randomUUID().replaceAll("-", "")}`;
    await ctx.db.collection("listings").doc(adminListing).set({
      id: adminListing,
      seller_id: users.admin.uid,
      status: "PENDING",
      kind: "SALE",
      title: "Admin-owned listing",
      city: "HCM",
    });
    const approved = await api(`/admin/listings/${adminListing}/review`, "admin", {
      status: "APPROVED",
      reason: "Admin reviewed the listing and its details",
    });
    assert.equal(approved.status, 200);
    assert.equal(
      (await ctx.db.collection("listings").doc(adminListing).get()).data()!.status,
      "APPROVED",
    );

    const moderatorListing = `${prefix}_moderator_listing_${randomUUID().replaceAll("-", "")}`;
    await ctx.db.collection("listings").doc(moderatorListing).set({
      id: moderatorListing,
      seller_id: users.moderator.uid,
      status: "PENDING",
      kind: "SALE",
      title: "Moderator-owned listing",
      city: "HCM",
    });
    const blocked = await api(`/admin/listings/${moderatorListing}/review`, "moderator", {
      status: "APPROVED",
      reason: "Attempt to approve my own listing",
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, "SELF_REVIEW");
  },
);
test(
  "admin listing deletion hides the sale without losing items or existing orders",
  { skip: !enabled },
  async () => {
    const listingId = await fixture(2);
    const order = await api("/orders", "buyer", checkout(listingId), `${prefix}_delete_listing_order`);
    assert.equal(order.status, 201);
    const route = `/admin/listings/${listingId}`;
    const reason = "Bài đăng bán không còn phù hợp.";
    assert.equal((await api(route, undefined, { reason }, undefined, "DELETE")).status, 401);
    assert.equal((await api(route, "buyer", { reason }, undefined, "DELETE")).status, 403);
    assert.equal((await api(route, "admin", {}, undefined, "DELETE")).status, 400);
    assert.equal((await api(route, "admin", { reason: "ngắn" }, undefined, "DELETE")).status, 400);
    assert.equal((await api(route, "admin", { reason, status: "APPROVED" }, undefined, "DELETE")).status, 400);
    assert.equal((await ctx.db.collection("listings").doc(listingId).get()).data()!.status, "APPROVED");

    assert.equal((await api(route, "admin", { reason }, undefined, "DELETE")).status, 204);
    assert.equal((await api(route, "admin", { reason }, undefined, "DELETE")).status, 204);
    const stored = (await ctx.db.collection("listings").doc(listingId).get()).data()!;
    assert.equal(stored.status, "HIDDEN");
    assert.equal(stored.moderator_id, users.admin.uid);
    assert.equal(stored.moderation_reason, reason);
    assert.ok((await ctx.db.collection("listing_items").doc(listingId).get()).exists);
    assert.ok((await ctx.db.collection("orders").doc(order.body.id).get()).exists);
    assert.equal((await api(`/orders/${order.body.id}`, "buyer")).status, 200);
    assert.equal((await api("/listings?limit=100")).body.items.some((row: any) => row.id === listingId), false);
    assert.equal((await api(`/listings/${listingId}`)).status, 404);
    assert.equal((await api("/admin/listings?status=HIDDEN", "admin")).body.items.some((row: any) => row.id === listingId), true);
    const audits = await ctx.db.collection("audit_logs").where("entity_id", "==", listingId).get();
    assert.equal(audits.docs.filter((row) => row.data().action === "LISTING_HIDDEN").length, 1);
  },
);
test(
  "moderators cannot delete their own sale listing",
  { skip: !enabled },
  async () => {
    const listingId = `${prefix}_moderator_delete_${randomUUID().replaceAll("-", "")}`;
    await ctx.db.collection("listings").doc(listingId).set({
      id: listingId, seller_id: users.moderator.uid, status: "APPROVED", kind: "SALE", title: "Own listing", city: "HCM",
    });
    const denied = await api(`/admin/listings/${listingId}`, "moderator", { reason: "Yêu cầu xóa bài đăng bán." }, undefined, "DELETE");
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, "SELF_REVIEW");
    assert.equal((await ctx.db.collection("listings").doc(listingId).get()).data()!.status, "APPROVED");
  },
);
test(
  "financial dispute resumes only after all reports close and a valid charge remains",
  { skip: !enabled },
  async () => {
    const item = await fixture(2),
      order = (
        await api("/orders", "buyer", checkout(item), prefix + "_dispute")
      ).body;
    const payment = (
      await api(
        `/orders/${order.id}/payment-sessions`,
        "buyer",
        { provider: "EMULATOR" },
        prefix + "_dispute_pay",
      )
    ).body.data;
    await api(`/emulator/payments/${payment.id}/result`, "admin", {
      status: "SUCCEEDED",
    });
    const report = await api("/reports", "buyer", {
      order_id: order.id,
      reason: "Kiểm tra khiếu nại vận hành đơn hàng",
    });
    assert.equal(report.status, 201);
    assert.equal(
      (
        await api(`/admin/orders/${order.id}/resume`, "admin", {
          reason: "Đã xác nhận với người mua và người bán",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(`/admin/reports/${report.body.id}/resolve`, "admin", {
          status: "DISMISSED",
          reason: "Hai bên đã thống nhất tiếp tục giao hàng",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api(`/admin/orders/${order.id}/resume`, "buyer", {
          reason: "Tự khôi phục không được phép",
        })
      ).status,
      403,
    );
    const result = await api(`/admin/orders/${order.id}/resume`, "admin", {
      reason: "Đã kiểm tra đủ điều kiện tiếp tục giao hàng",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "PAID");
  },
);
