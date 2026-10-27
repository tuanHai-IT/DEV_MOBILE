import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ZodError } from "zod";
import { ApiError, sha, type Context } from "../src/core.js";
import { registerCommunityRoutes } from "../src/community.js";
import { registerMarketplaceRoutes } from "../src/marketplace.js";
import { registerAdminRoutes } from "../src/admin.js";
import { payoutAccountReady, payoutAccountSchema, savedPayoutAccount } from "../src/payout-account.js";

const clock = "2026-10-27T10:00:00.000Z";
const bank = { method: "BANK", bank_name: "Example Test Bank", account_number: "001234567890", account_holder: "NGUYEN TEST" };
const momo = { method: "MOMO", phone: "0901234567", account_holder: "NGUYEN TEST" };

describe("Payout declaration validation", () => {
  it("normalizes Vietnamese MoMo numbers and preserves leading bank-account zeroes", () => {
    assert.deepEqual(payoutAccountSchema.parse(bank), bank);
    for (const phone of ["0901234567", "+84901234567", "84901234567"])
      assert.deepEqual(payoutAccountSchema.parse({ ...momo, phone }), momo);
  });

  it("requires a valid complete saved declaration rather than a truthy object", () => {
    const saved = { ...bank, updated_at: clock };
    assert.deepEqual(savedPayoutAccount(saved), saved);
    assert.equal(payoutAccountReady(saved), true);
    for (const value of [undefined, null, {}, bank, { ...saved, updated_at: "yesterday" },
      { ...saved, account_number: "123" }, { ...momo, phone: "abc", updated_at: clock }]) {
      assert.equal(savedPayoutAccount(value), null);
      assert.equal(payoutAccountReady(value), false);
    }
  });
});

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `payout_${randomUUID().replaceAll("-", "")}`;
const uid = (suffix: string) => `${prefix}_${suffix}`;

describe("Seller payout declarations, privacy, and listing gates", { skip: !enabled, concurrency: false }, () => {
  let firebase: App, ctx: Context, server: Server, base: string;
  type ApiResult = { status: number; data: any };

  async function request(who: string | null, method: string, path: string, body?: unknown, key?: string): Promise<ApiResult> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(who ? { "X-Test-User": who } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    return { status: response.status, data: raw ? JSON.parse(raw) : null };
  }

  async function seed(collection: string, id: string, data: Record<string, unknown>) {
    await ctx.db.collection(collection).doc(id).set({ id, ...data });
  }

  async function user(name: string, role = "MEMBER", status = "ACTIVE") {
    const id = uid(name);
    await seed("users", id, {
      display_name: name, email: `${name}@example.test`, phone: "0900000000", role, status,
      points_balance: 0, created_at: clock, _verification_id: id,
    });
    await seed("verifications", id, { user_id: id, status: "VERIFIED", expires_at: "2099-01-01T00:00:00.000Z" });
    return id;
  }

  const listingBody = () => ({
    title: "Reusable test bottle", description: "A reusable bottle for the local test suite.", city: "Test City", tags: [],
    items: [{ category_id: uid("category"), name: "Test bottle", material: "Glass", condition: "GOOD", price_vnd: 12000, stock: 2, unit: "item" }],
  });

  async function listingFixture(name: string, seller: string, status = "APPROVED") {
    const id = uid(name), itemId = `${id}_item`;
    await seed("listings", id, { seller_id: seller, status, kind: "SALE", title: "Test listing", description: "Reusable goods for a local test.", city: "Test City", created_at: clock });
    await seed("listing_items", itemId, { listing_id: id, category_id: uid("category"), name: "Test bottle", material: "Glass", condition: "GOOD", price_vnd: 12000, stock: 2, unit: "item", _reserved: 0 });
    return { id, itemId };
  }

  function assertNoPayoutDetails(value: unknown) {
    const serialized = JSON.stringify(value);
    for (const secret of ["_payout_account", '"payout_account":', "account_number", "bank_name", bank.account_number, momo.phone])
      assert.equal(serialized.includes(secret), false, `Private payout data leaked: ${secret}`);
  }

  before(async () => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(host.hostname), "Tests require a loopback Firestore emulator");
    const projectId = "demo-recycling-share";
    firebase = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, prefix);
    ctx = { db: getFirestore(firebase), auth: getAuth(firebase), bucket: getStorage(firebase).bucket(), now: () => clock, emulator: true };
    await user("admin", "ADMIN");
    await user("outsider");
    await user("suspended", "MEMBER", "SUSPENDED");
    await seed("categories", uid("category"), { name: "Test reusable goods", active: true });

    const app = express();
    app.use(express.json());
    // Isolate service authorization from token verification, covered by the main API suite.
    app.use((req, res, next) => {
      const testUid = req.get("X-Test-User");
      if (!testUid) return next();
      void ctx.db.collection("users").doc(testUid).get().then((doc) => {
        if (doc.exists) res.locals.actor = { uid: testUid, role: doc.data()!.role, status: doc.data()!.status };
        next();
      }).catch(next);
    });
    registerCommunityRoutes(app, ctx);
    registerMarketplaceRoutes(app, ctx);
    registerAdminRoutes(app, ctx);
    app.use((_req, res) => { res.status(404).json({ error: "NOT_FOUND" }); });
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      if (error instanceof ApiError) return void res.status(error.status).json({ error: error.code });
      if (error instanceof ZodError) return void res.status(400).json({ error: "VALIDATION_ERROR" });
      res.status(500).json({ error: String(error) });
    };
    app.use(errors);
    server = await new Promise<Server>((resolve) => {
      const running = app.listen(0, "127.0.0.1", () => resolve(running));
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (firebase) await deleteApp(firebase);
  });

  it("requires an active authenticated owner and isolates account reads and writes", async () => {
    for (const method of ["GET", "PUT"])
      assert.equal((await request(null, method, "/me/payout-account", method === "PUT" ? bank : undefined)).status, 401);
    const seller = await user("ownership");
    assert.deepEqual((await request(seller, "GET", "/me/payout-account")).data, { payout_account: null, payout_account_ready: false });
    assert.equal((await request(seller, "PUT", "/me/payout-account", bank)).status, 200);
    assert.deepEqual((await request(uid("outsider"), "GET", "/me/payout-account")).data, { payout_account: null, payout_account_ready: false });
    assert.equal((await request(uid("outsider"), "PUT", `/users/${seller}/payout-account`, momo)).status, 404);
    assert.equal((await request(uid("suspended"), "PUT", "/me/payout-account", bank)).status, 403);
    assert.equal((await request(uid("suspended"), "GET", "/me/payout-account")).status, 403);
    assert.equal((await request(seller, "GET", "/me/payout-account")).data.payout_account.account_number, bank.account_number);
  });

  it("round-trips a bank declaration with server time and exposes only readiness in the profile", async () => {
    const seller = await user("bank");
    const expected = { ...bank, updated_at: clock };
    const saved = await request(seller, "PUT", "/me/payout-account", { ...bank, bank_name: ` ${bank.bank_name} `, account_holder: ` ${bank.account_holder} ` });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data, { payout_account: expected, payout_account_ready: true });
    assert.deepEqual((await request(seller, "GET", "/me/payout-account")).data, saved.data);
    const profile = await request(seller, "GET", "/me");
    assert.equal(profile.status, 200);
    assert.equal(profile.data.payout_account_ready, true);
    assertNoPayoutDetails(profile.data);
    const updatedProfile = await request(seller, "PATCH", "/me", { bio: "Reuse test goods" });
    assert.equal(updatedProfile.status, 200);
    assert.equal(updatedProfile.data.payout_account_ready, true);
    assertNoPayoutDetails(updatedProfile.data);
    for (const injection of [{ _payout_account: expected }, { payout_account: expected }, { payout_account_ready: true }])
      assert.equal((await request(seller, "PATCH", "/me", injection)).status, 400);
    assert.deepEqual((await request(seller, "GET", "/me/payout-account")).data, saved.data);
  });

  it("normalizes MoMo round-trips and replaces the previous account without retaining bank details", async () => {
    const seller = await user("momo");
    await request(seller, "PUT", "/me/payout-account", bank);
    for (const phone of ["0901234567", "+84901234567", "84901234567"]) {
      const saved = await request(seller, "PUT", "/me/payout-account", { ...momo, phone });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.data, { payout_account: { ...momo, updated_at: clock }, payout_account_ready: true });
      assert.deepEqual((await request(seller, "GET", "/me/payout-account")).data, saved.data);
    }
    const stored = (await ctx.db.collection("users").doc(seller).get()).data()!._payout_account;
    assert.equal("bank_name" in stored, false);
    assert.equal("account_number" in stored, false);
  });

  it("rejects invalid and injected declarations without overwriting the saved account", async () => {
    const seller = await user("invalid");
    assert.equal((await request(seller, "PUT", "/me/payout-account", bank)).status, 200);
    const previous = (await ctx.db.collection("users").doc(seller).get()).data();
    const invalid = [
      {}, { ...bank, method: "CASH" }, { ...bank, bank_name: "A" }, { ...bank, bank_name: "A".repeat(101) },
      { ...bank, account_number: "12345" }, { ...bank, account_number: "1".repeat(31) }, { ...bank, account_number: "00123abc" },
      { ...bank, account_holder: "A" }, { ...bank, account_holder: "A".repeat(101) },
      { ...momo, phone: "1234567890" }, { ...momo, phone: "+840901234567" }, { ...momo, phone: "090 123 4567" },
      { ...bank, user_id: uid("outsider") }, { ...bank, id: uid("outsider") },
      { ...bank, updated_at: "2099-01-01T00:00:00.000Z" }, { ...momo, account_number: bank.account_number },
    ];
    for (const body of invalid) {
      const response = await request(seller, "PUT", "/me/payout-account", body);
      assert.equal(response.status, 400, `Accepted invalid declaration: ${JSON.stringify(body)}`);
      assert.deepEqual((await ctx.db.collection("users").doc(seller).get()).data(), previous);
    }
  });

  it("treats missing or malformed saved accounts as unready and blocks a new listing", async () => {
    const seller = await user("malformed");
    const invalid = [null, {}, bank, { ...bank, updated_at: "invalid" }, { ...bank, account_number: "abc", updated_at: clock }];
    for (const [index, account] of invalid.entries()) {
      await ctx.db.collection("users").doc(seller).update({ _payout_account: account });
      assert.deepEqual((await request(seller, "GET", "/me/payout-account")).data, { payout_account: null, payout_account_ready: false });
      assert.equal((await request(seller, "GET", "/me")).data.payout_account_ready, false);
      const key = `${prefix}_bad_${index}`;
      const blocked = await request(seller, "POST", "/listings", listingBody(), key);
      assert.deepEqual(blocked, { status: 403, data: { error: "PAYOUT_ACCOUNT_REQUIRED" } });
      assert.equal((await ctx.db.collection("listings").doc(sha(`listing:${seller}:${key}`)).get()).exists, false);
    }
  });

  it("keeps payout details out of public profiles, listing previews, and admin user responses", async () => {
    const seller = await user("privacy");
    await request(seller, "PUT", "/me/payout-account", bank);
    const listing = await listingFixture("privacy_listing", seller);
    for (const [who, path] of [[null, `/users/${seller}`], [null, `/listings/${listing.id}`],
      [uid("admin"), `/admin/users/${seller}`], [uid("admin"), `/admin/users?limit=100&cursor=${prefix}`]] as const) {
      const response = await request(who, "GET", path);
      assert.equal(response.status, 200);
      assertNoPayoutDetails(response.data);
      if (path.includes("/admin/users?")) assert.ok(response.data.items.some((row: any) => row.id === seller));
    }
    const accessUpdate = await request(uid("admin"), "PATCH", `/admin/users/${seller}`, { status: "ACTIVE", reason: "Local privacy regression test" });
    assert.equal(accessUpdate.status, 200);
    assertNoPayoutDetails(accessUpdate.data);
  });

  it("requires a declared account for publishing changes and approval while allowing stock updates", async () => {
    const seller = await user("gated");
    const key = `${prefix}_create`;
    const blocked = await request(seller, "POST", "/listings", listingBody(), key);
    assert.deepEqual(blocked, { status: 403, data: { error: "PAYOUT_ACCOUNT_REQUIRED" } });
    await request(seller, "PUT", "/me/payout-account", bank);
    const created = await request(seller, "POST", "/listings", listingBody(), key);
    assert.equal(created.status, 201);
    const listingId = created.data.id, itemId = sha(`item:${listingId}:0`);
    await ctx.db.collection("users").doc(seller).update({ _payout_account: null });
    const beforeListing = (await ctx.db.collection("listings").doc(listingId).get()).data();
    const beforeItem = (await ctx.db.collection("listing_items").doc(itemId).get()).data();
    for (const [method, path, body] of [
      ["PATCH", `/listings/${listingId}`, { title: "Changed title" }],
      ["PATCH", `/listing-items/${itemId}`, { price_vnd: 20000 }],
      ["PATCH", `/listing-items/${itemId}`, { stock: 5, name: "Changed item" }],
    ] as const) {
      assert.deepEqual(await request(seller, method, path, body), { status: 403, data: { error: "PAYOUT_ACCOUNT_REQUIRED" } });
      assert.deepEqual((await ctx.db.collection("listings").doc(listingId).get()).data(), beforeListing);
      assert.deepEqual((await ctx.db.collection("listing_items").doc(itemId).get()).data(), beforeItem);
    }
    assert.equal((await request(seller, "PATCH", `/listing-items/${itemId}/stock`, { stock: 4 })).status, 200);
    assert.equal((await request(seller, "PATCH", `/listing-items/${itemId}`, { stock: 3 })).status, 200);
    const review = `/admin/listings/${listingId}/review`;
    assert.deepEqual(await request(uid("admin"), "POST", review, { status: "APPROVED", reason: "Local test approval" }),
      { status: 403, data: { error: "PAYOUT_ACCOUNT_REQUIRED" } });
    assert.equal((await request(uid("admin"), "POST", review, { status: "REJECTED", reason: "Account declaration missing" })).status, 200);
    await request(seller, "PUT", "/me/payout-account", momo);
    assert.equal((await request(seller, "PATCH", `/listings/${listingId}`, { title: "Ready for review" })).status, 200);
    assert.equal((await request(seller, "PATCH", `/listing-items/${itemId}`, { price_vnd: 20000 })).status, 200);
    assert.equal((await request(uid("admin"), "POST", review, { status: "APPROVED", reason: "Local test approval" })).status, 200);
    assert.equal((await ctx.db.collection("listings").doc(listingId).get()).data()!.status, "APPROVED");
  });
});
