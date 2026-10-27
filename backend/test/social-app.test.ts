import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createApp } from "../src/app.js";
import { sha, type Context } from "../src/core.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const prefix = `social_app_${randomUUID().replaceAll("-", "")}`;
const id = (suffix: string) => `${prefix}_${suffix}`;
const users: Record<string, { uid: string; token: string }> = {};

/** Uses the production Express router and real emulator-issued Firebase ID tokens. No DB clearing. */
describe("Production social router boundaries with Firebase Authentication", { skip: !enabled, concurrency: false }, () => {
  let firebase: App, ctx: Context, server: Server, base: string;
  async function request(path: string, who?: string, method = "GET", body?: unknown, key?: string) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(who ? { Authorization: `Bearer ${users[who].token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  }
  before(async () => {
    assert.equal(process.env.GCLOUD_PROJECT, "demo-recycling-share");
    for (const host of [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIREBASE_STORAGE_EMULATOR_HOST]) {
      assert.match(host!, /^(127\.0\.0\.1|localhost):\d+$/);
    }
    firebase = initializeApp({ projectId: "demo-recycling-share", storageBucket: "demo-recycling-share.appspot.com" }, prefix);
    ctx = { db: getFirestore(firebase), auth: getAuth(firebase), bucket: getStorage(firebase).bucket(), now: () => new Date().toISOString(), emulator: true };
    for (const [who, role] of [["author", "MEMBER"], ["reader", "MEMBER"], ["moderator", "MODERATOR"], ["admin", "ADMIN"]]) {
      const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${prefix}_${who}@example.test`, password: "EmulatorOnly123!", returnSecureToken: true }),
      });
      const data = await response.json() as { localId: string; idToken: string };
      assert.equal(response.status, 200);
      users[who] = { uid: data.localId, token: data.idToken };
      await ctx.db.collection("users").doc(data.localId).set({ id: data.localId, role, status: "ACTIVE", display_name: who, created_at: ctx.now(), points_balance: 0 });
    }
    for (const [suffix, kind, status] of [["post", "POST", "PUBLISHED"], ["tip", "TIP", "PUBLISHED"], ["scan", "SCAN", "PRIVATE"], ["bad_scan", "SCAN", "PUBLISHED"]]) {
      await ctx.db.collection("content_entries").doc(id(suffix)).set({
        id: id(suffix), kind, status, author_id: users.author.uid, title: `Router ${kind}`, body: "Nội dung kiểm tra quyền qua router thực tế.",
        created_at: ctx.now(), updated_at: ctx.now(), materials: [], tags: [], weight_kg: null,
        like_count: 0, saved_count: 0, comment_count: 0, _social: true,
      });
    }
    server = await new Promise(resolve => { const listening = createApp(ctx).listen(0, "127.0.0.1", () => resolve(listening)); });
    const address = server.address(); assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/v1`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (firebase) await deleteApp(firebase);
  });
  it("blocks private scans from both legacy public content routes, even with invalid published status", async () => {
    for (const suffix of ["scan", "bad_scan"]) {
      assert.equal((await request(`/content/${id(suffix)}`)).status, 404);
      assert.equal((await request(`/content/${id(suffix)}`, "reader")).status, 404);
    }
    const content = await request("/content?limit=100");
    assert.equal(content.status, 200);
    assert.ok(content.body.items.every((row: any) => !["POST", "TIP", "SCAN"].includes(row.kind)));
    assert.equal((await request(`/scans/${id("scan")}`, "reader")).status, 403);
    assert.equal((await request(`/scans/${id("scan")}`, "author")).status, 200);
  });
  it("blocks scans through legacy staff routes and enforces private scan admin permissions", async () => {
    for (const who of ["moderator", "admin"]) {
      const list = await request("/admin/content?limit=100", who);
      assert.equal(list.status, 200);
      assert.ok(list.body.items.every((row: any) => !["POST", "TIP", "SCAN"].includes(row.kind)));
      assert.equal((await request(`/admin/content/${id("scan")}`, who)).status, 404);
      assert.equal((await request(`/admin/content/${id("scan")}`, who, "DELETE", { reason: "Thử lưu trữ qua đường dẫn cũ." })).status, 404);
    }
    assert.equal((await request(`/admin/community/${id("scan")}`, "moderator")).status, 403);
    assert.equal((await request(`/admin/community/${id("scan")}`, "admin")).status, 200);
    assert.equal((await ctx.db.collection("content_entries").doc(id("scan")).get()).data()!.status, "PRIVATE");
  });
  it("rejects legacy creation of social interactions without changing counters", async () => {
    for (const suffix of ["post", "tip"]) {
      for (const type of ["LIKE", "SAVE", "COMMENT"]) {
        const result = await request("/interactions", "reader", "POST", { type, content_id: id(suffix), ...(type === "COMMENT" ? { body: "Không được bỏ qua bộ đếm mới." } : {}) }, `legacy_${suffix}_${type}`);
        assert.equal(result.status, 400);
        assert.equal(result.body.error.code, "USE_SOCIAL_API");
      }
      const row = (await ctx.db.collection("content_entries").doc(id(suffix)).get()).data()!;
      assert.deepEqual([row.like_count, row.saved_count, row.comment_count], [0, 0, 0]);
    }
  });
  it("rejects legacy deletion of new reactions and comments and preserves exact counts", async () => {
    const content = id("post");
    for (const type of ["LIKE", "SAVE"]) {
      const reacted = await request(`/posts/${content}/reactions/${type}`, "reader", "PUT", { active: true });
      assert.equal(reacted.status, 200);
      const reaction = sha(JSON.stringify([users.reader.uid, type, "content", content, ""]));
      const deleted = await request(`/interactions/${reaction}`, "reader", "DELETE");
      assert.equal(deleted.status, 400);
      assert.equal(deleted.body.error.code, "USE_SOCIAL_API");
      assert.ok((await ctx.db.collection("interactions").doc(reaction).get()).exists);
    }
    const comment = await request(`/posts/${content}/comments`, "reader", "POST", { body: "Bình luận phải cập nhật cùng bộ đếm." }, "router_comment_01");
    assert.equal(comment.status, 201);
    const deleted = await request(`/interactions/${comment.body.id}`, "reader", "DELETE");
    assert.equal(deleted.status, 400);
    const row = (await ctx.db.collection("content_entries").doc(content).get()).data()!;
    assert.deepEqual([row.like_count, row.saved_count, row.comment_count], [1, 1, 1]);
    const removed = await request(`/posts/${content}/reactions/LIKE`, "reader", "PUT", { active: false });
    assert.equal(removed.status, 200);
    assert.equal((await ctx.db.collection("content_entries").doc(content).get()).data()!.like_count, 0);
  });
  it("uses the current database role even while the old Firebase token is valid", async () => {
    await ctx.db.collection("users").doc(users.admin.uid).update({ role: "MEMBER" });
    const blocked = await request(`/admin/community/${id("scan")}`, "admin");
    assert.equal(blocked.status, 403);
    assert.equal((await request("/me", "admin")).status, 200);
  });
});
