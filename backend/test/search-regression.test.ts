import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createApp } from "../src/app.js";
import type { Context } from "../src/core.js";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `search_${randomUUID().replaceAll("-", "")}`;
const id = (name: string) => `${prefix}_${name}`;
const keyword = `${prefix} đèn thủy tinh`;

async function listen(ctx: Context) {
  const server = await new Promise<Server>((resolve, reject) => {
    const running = createApp(ctx).listen(0, "127.0.0.1", () => resolve(running));
    running.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, base: `http://127.0.0.1:${address.port}/v1` };
}

async function close(server: Server | undefined) {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe("Explore search visibility, Unicode and result ordering", { skip: !emulatorEnabled, concurrency: false }, () => {
  let firebase: App | undefined, ctx: Context | undefined, server: Server | undefined, base: string;
  const refs: DocumentReference[] = [];
  const newest = "2099-08-30T12:00:00.000Z";
  const tied = "2099-08-29T12:00:00.000Z";
  const older = "2099-08-28T12:00:00.000Z";
  const hiddenNewest = "2099-09-01T12:00:00.000Z";
  const expected = [id("z_newest_tip"), id("a_challenge"), id("b_listing"), id("c_tied_tip"), id("d_old_tip")];

  async function search(q: string, limit = 50) {
    const response = await fetch(`${base}/explore/search?${new URLSearchParams({ q, limit: String(limit) })}`);
    return { status: response.status, data: await response.json() as any };
  }

  before(async () => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(host.hostname), "Search integration tests require a loopback Firestore Emulator");
    assert.equal(process.env.GCLOUD_PROJECT, "demo-recycling-share");
    firebase = initializeApp({ projectId: "demo-recycling-share", storageBucket: "demo-recycling-share.appspot.com" }, prefix);
    ctx = { db: getFirestore(firebase), auth: getAuth(firebase), bucket: getStorage(firebase).bucket(), emulator: true,
      now: () => "2026-10-30T00:00:00.000Z" };
    const batch = ctx.db.batch();
    const seed = (collection: string, name: string, data: Record<string, unknown>) => {
      const ref = ctx!.db.collection(collection).doc(id(name));
      refs.push(ref);
      batch.set(ref, { id: ref.id, ...data });
    };
    seed("users", "seller", { display_name: "Search test seller", role: "MEMBER", status: "ACTIVE",
      email: "private-search@example.test", phone: "0901234567", avatar_key: null });
    const content = (name: string, kind: string, status: string, created_at: string) => seed("content_entries", name, {
      author_id: id("seller"), kind, status, title: keyword.toLocaleUpperCase("vi"), body: "Nội dung thử tìm kiếm.", created_at,
      metadata_json: kind === "CHALLENGE" ? JSON.stringify({ reward_points: 25, target: 1, unit: "lần" }) : "{}",
    });
    content("z_newest_tip", "TIP", "PUBLISHED", newest);
    content("a_challenge", "CHALLENGE", "PUBLISHED", tied);
    content("c_tied_tip", "TIP", "PUBLISHED", tied);
    content("d_old_tip", "TIP", "PUBLISHED", older);
    // These match the keyword and are newer: visibility/type filtering must happen before the global limit.
    content("hidden_tip", "TIP", "HIDDEN", hiddenNewest);
    content("draft_challenge", "CHALLENGE", "DRAFT", hiddenNewest);
    content("private_scan", "SCAN", "PRIVATE", hiddenNewest);
    content("published_scan", "SCAN", "PUBLISHED", hiddenNewest);
    content("ordinary_post", "POST", "PUBLISHED", hiddenNewest);
    for (const [name, status, created_at] of [["b_listing", "APPROVED", tied], ["pending_listing", "PENDING", hiddenNewest],
      ["hidden_listing", "HIDDEN", hiddenNewest]] as const) {
      seed("listings", name, { seller_id: id("seller"), kind: "SALE", status, title: keyword,
        description: "Tin bán dùng kiểm thử, không phải dữ liệu cloud.", city: "Huế", created_at });
    }
    seed("listing_items", "item_one", { listing_id: id("b_listing"), title: "Đèn mẫu", price_vnd: 110000, stock: 2 });
    seed("listing_items", "item_two", { listing_id: id("b_listing"), title: "Đèn mẫu nhỏ", price_vnd: 75000, stock: 1 });
    seed("media_assets", "listing_photo", { _parent_type: "LISTING", _parent_id: id("b_listing"), _status: "READY",
      mime_type: "image/jpeg", visibility: "PUBLIC" });
    await batch.commit();
    ({ server, base } = await listen(ctx));
  });

  after(async () => {
    await close(server);
    if (ctx && refs.length) {
      const cleanup = ctx.db.batch();
      for (const ref of refs) cleanup.delete(ref);
      await cleanup.commit();
    }
    if (firebase) await deleteApp(firebase);
  });

  it("finds Unicode/case-insensitive published tips, challenges and approved listings without exposing hidden or private content", async () => {
    const response = await search(`  ${keyword.toLocaleUpperCase("vi")}  `);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.deepEqual(response.data.items.map((row: any) => row.id), expected);
    assert.deepEqual(response.data.items.map((row: any) => row.kind), ["TIP", "CHALLENGE", "LISTING", "TIP", "TIP"]);
    assert.equal(response.data.next_cursor, null);
    const challenge = response.data.items.find((row: any) => row.id === id("a_challenge"));
    assert.equal(challenge.reward_points, 25);
    assert.equal(challenge.completed, false);
    const listing = response.data.items.find((row: any) => row.id === id("b_listing"));
    assert.equal(listing.min_price_vnd, 75000);
    assert.equal(listing.preview_media_id, id("listing_photo"));
    assert.equal(listing.seller.display_name, "Search test seller");
    assert.equal(listing.seller.email, undefined);
    assert.equal(listing.seller.phone, undefined);
    assert.ok(!JSON.stringify(response.data).includes("private-search@example.test"));
  });

  it("applies one global limit after newest-first ordering with ascending IDs for timestamp ties", async () => {
    for (const limit of [1, 3, 5]) {
      const response = await search(keyword, limit);
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.deepEqual(response.data.items.map((row: any) => row.id), expected.slice(0, limit));
    }
    const empty = await search("   ");
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.data, { items: [], next_cursor: null });
  });
});

describe("Unexpected search failures through the actual app error handler", { concurrency: false }, () => {
  it("returns a safe read-retry message for GET even when an Idempotency-Key header is supplied", async t => {
    const privateDetail = "private-sdk-project/path oauth-secret-not-for-response";
    const logs: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
    const unavailable = Object.assign(new Error(privateDetail), { code: 9 });
    const query = {
      where() { return this; }, orderBy() { return this; }, limit() { return this; },
      async get(): Promise<never> { throw unavailable; },
    };
    // Only Firestore failure is injected; routing, response headers and error sanitization are production code.
    const ctx = { db: { collection: () => query }, auth: {}, bucket: {}, emulator: true,
      now: () => "2026-10-30T00:00:00.000Z" } as unknown as Context;
    const { server, base } = await listen(ctx);
    try {
      const requestHeaders: Array<Record<string, string>> = [{}, { "Idempotency-Key": "read-only-regression-key" }];
      for (const headers of requestHeaders) {
        const response = await fetch(`${base}/explore/search?q=T`, { headers });
        const body = await response.json() as any;
        assert.equal(response.status, 500);
        assert.equal(body.error.code, "INTERNAL");
        assert.equal(typeof body.error.message, "string");
        assert.match(body.error.message, /tải|thử lại|tạm thời/i);
        assert.doesNotMatch(body.error.message, /Idempotency-Key/i);
        assert.ok(!JSON.stringify(body).includes(privateDetail));
        assert.ok(!JSON.stringify(body).includes("oauth-secret"));
        assert.equal(body.error.request_id, response.headers.get("X-Request-ID"));
        assert.equal(typeof body.error.request_id, "string");
        assert.ok(body.error.request_id.length > 0);
      }
      assert.ok(logs.length >= 1);
      assert.ok(!JSON.stringify(logs).includes(privateDetail));
    } finally {
      await close(server);
    }
  });
});
