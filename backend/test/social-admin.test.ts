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
import { ApiError, type Context } from "../src/core.js";
import { registerSocialAdminRoutes } from "../src/social-admin.js";
import { registerAdminRoutes } from "../src/admin.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `social_admin_${randomUUID().replaceAll("-", "")}`;
const id = (value: string) => `${prefix}_${value}`;
describe("Community admin, private scans, and comment moderation", { skip: !enabled, concurrency: false }, () => {
  let app: App, ctx: Context, server: Server, base: string;
  const request = async (who: string | null, method: string, path: string, body?: unknown, key?: string) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(who ? { "X-Test-User": who } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  };
  before(async () => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(host.hostname));
    const projectId = "demo-recycling-share";
    app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, prefix);
    ctx = { db: getFirestore(app), auth: getAuth(app), bucket: getStorage(app).bucket(), now: () => "2026-10-18T10:00:00.000Z", emulator: true };
    for (const [name, role] of [["admin", "ADMIN"], ["moderator", "MODERATOR"], ["member", "MEMBER"], ["revoked", "MEMBER"]]) {
      await ctx.db.collection("users").doc(id(name)).set({ id: id(name), display_name: name, role, status: "ACTIVE" });
    }
    for (const [name, kind, status] of [["post", "POST", "PUBLISHED"], ["tip", "TIP", "PUBLISHED"], ["scan", "SCAN", "PRIVATE"]]) {
      await ctx.db.collection("content_entries").doc(id(name)).set({
        id: id(name), kind, status, author_id: id("member"), title: `Mẫu ${name}`, body: "Nội dung kiểm thử ban đầu.",
        materials: ["Nhựa"], weight_kg: 1.5, tags: ["DIY"], comment_count: name === "post" ? 1 : 0,
        like_count: 0, saved_count: 0, created_at: ctx.now(), updated_at: ctx.now(), _social: true,
      });
    }
    await ctx.db.collection("interactions").doc(id("comment")).set({
      id: id("comment"), type: "COMMENT", content_id: id("post"), user_id: id("member"),
      status: "PUBLISHED", body: "Bình luận thử.", created_at: ctx.now(), _social: true,
    });
    const http = express();
    http.use(express.json());
    http.use((req, res, next) => {
      const user = req.get("X-Test-User");
      if (!user) return next();
      const role = user === id("moderator") ? "MODERATOR" : user === id("member") ? "MEMBER" : "ADMIN";
      res.locals.actor = { uid: user, role, status: "ACTIVE" };
      next();
    });
    registerSocialAdminRoutes(http, ctx);
    registerAdminRoutes(http, ctx);
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      if (error instanceof ApiError) res.status(error.status).json({ error: error.code });
      else if (error instanceof ZodError) res.status(400).json({ error: "VALIDATION_ERROR" });
      else res.status(500).json({ error: String(error) });
    };
    http.use(errors);
    server = await new Promise(resolve => { const instance = http.listen(0, "127.0.0.1", () => resolve(instance)); });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (app) await deleteApp(app);
  });
  it("requires staff and prevents moderators from reading private scan records", async () => {
    assert.equal((await request(null, "GET", "/admin/community")).status, 401);
    assert.equal((await request(id("member"), "GET", "/admin/community")).status, 403);
    const listed = await request(id("moderator"), "GET", `/admin/community?author_id=${id("member")}&limit=100`);
    assert.equal(listed.status, 200);
    assert.ok(listed.data.items.some((entry: any) => entry.id === id("post")));
    assert.ok(listed.data.items.every((entry: any) => entry.kind !== "SCAN" && entry._social === undefined));
    assert.equal((await request(id("moderator"), "GET", "/admin/community?kind=SCAN")).status, 403);
    assert.equal((await request(id("moderator"), "GET", `/admin/community/${id("scan")}`)).status, 403);
    assert.ok([403, 404].includes((await request(id("moderator"), "GET", `/admin/content/${id("scan")}`)).status), "Legacy admin routes must not expose private scans");
    const viewed = await request(id("admin"), "GET", `/admin/community/${id("scan")}`);
    assert.equal(viewed.status, 200);
    const logs = await ctx.db.collection("audit_logs").where("entity_id", "==", id("scan")).get();
    assert.ok(logs.docs.some(doc => doc.data().action === "PRIVATE_SCAN_VIEWED"));
  });
  it("creates community content once through admin forms without author impersonation", async () => {
    const body = { kind: "TIP", title: "Mẹo hay do quản trị viên viết", body: "Làm sạch chai trước khi tái chế.", reason: "Tạo mẹo hay từ Admin Panel." };
    assert.equal((await request(id("moderator"), "POST", "/admin/community", body, "admin-create-tip")).status, 403);
    assert.equal((await request(id("admin"), "POST", "/admin/community", { ...body, author_id: id("member") }, "admin-create-tip")).status, 400);
    const created = await request(id("admin"), "POST", "/admin/community", body, "admin-create-tip");
    assert.equal(created.status, 201);
    assert.equal(created.data.author_id, id("admin"));
    assert.equal(created.data.status, "PUBLISHED");
    assert.equal(created.data.comment_count, 0);
    const replay = await request(id("admin"), "POST", "/admin/community", body, "admin-create-tip");
    assert.equal(replay.status, 200);
    assert.equal(replay.data.id, created.data.id);
    assert.equal((await request(id("admin"), "POST", "/admin/community", { ...body, body: "Nội dung khác." }, "admin-create-tip")).status, 409);
    const logs = await ctx.db.collection("audit_logs").where("entity_id", "==", created.data.id).get();
    assert.equal(logs.docs.filter(doc => doc.data().action === "COMMUNITY_CREATED").length, 1);
  });
  it("edits real content while preserving identity and recording the reason", async () => {
    const reason = "Chỉnh sửa câu chữ bài đăng.";
    const result = await request(id("moderator"), "PATCH", `/admin/community/${id("post")}`, {
      title: "Chậu cây từ chai nhựa", body: "Nội dung đã sửa trên Firebase.", materials: ["Nhựa"], weight_kg: 1.75, tags: ["DIY", "ZeroWaste"], reason,
    });
    assert.equal(result.status, 200);
    const stored = (await ctx.db.collection("content_entries").doc(id("post")).get()).data()!;
    assert.equal(stored.body, "Nội dung đã sửa trên Firebase.");
    assert.equal(stored.author_id, id("member"));
    assert.equal(stored.kind, "POST");
    const logs = await ctx.db.collection("audit_logs").where("entity_id", "==", id("post")).get();
    assert.ok(logs.docs.some(doc => doc.data().action === "COMMUNITY_UPDATED" && doc.data().reason === reason));
  });
  it("rejects missing reasons, identity injection, invalid text, and stale privileges", async () => {
    for (const body of [ { body: "Thiếu lý do" }, { author_id: id("admin"), reason: "Thử đổi tác giả." }, { body: "a".repeat(501), reason: "Nội dung quá dài." }, { status: "PRIVATE", reason: "Không được biến bài viết thành SCAN." }, { weight_kg: -1, reason: "Trọng lượng không hợp lệ." } ]) {
      assert.equal((await request(id("admin"), "PATCH", `/admin/community/${id("post")}`, body)).status, 400);
    }
    assert.equal((await request(id("revoked"), "PATCH", `/admin/community/${id("post")}`, { body: "Không có quyền.", reason: "Quyền vừa bị thu hồi." })).status, 403);
  });
  it("keeps scans private during edits and archive operations", async () => {
    assert.equal((await request(id("admin"), "PATCH", `/admin/community/${id("scan")}`, { status: "PUBLISHED", reason: "Không được công khai SCAN." })).status, 400);
    assert.equal((await request(id("moderator"), "DELETE", `/admin/community/${id("scan")}`, { reason: "Moderator không được xử lý ảnh riêng." })).status, 403);
    assert.equal((await request(id("admin"), "PATCH", `/admin/community/${id("scan")}`, { title: "Ảnh kiểm tra", body: "Ghi chú đã sửa.", reason: "Sửa ghi chú cho ảnh SCAN." })).status, 200);
    assert.equal((await request(id("admin"), "DELETE", `/admin/community/${id("scan")}`, { reason: "Lưu trữ ảnh SCAN riêng tư." })).status, 204);
    const row = (await ctx.db.collection("content_entries").doc(id("scan")).get()).data()!;
    assert.equal(row.status, "ARCHIVED");
    assert.equal(row.kind, "SCAN");
  });
  it("moderates comments with an exact visible count and repeat-safe hiding", async () => {
    const list = await request(id("moderator"), "GET", `/admin/community/${id("post")}/comments`);
    assert.equal(list.status, 200);
    assert.equal(list.data.items[0].id, id("comment"));
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.equal((await request(id("moderator"), "DELETE", `/admin/comments/${id("comment")}`, { reason: "Ẩn bình luận không phù hợp." })).status, 204);
      assert.equal((await ctx.db.collection("content_entries").doc(id("post")).get()).data()!.comment_count, 0);
    }
    assert.equal((await request(id("moderator"), "PATCH", `/admin/comments/${id("comment")}`, { status: "PUBLISHED", body: "Bình luận đã sửa.", reason: "Khôi phục bình luận sau kiểm tra." })).status, 200);
    assert.equal((await ctx.db.collection("content_entries").doc(id("post")).get()).data()!.comment_count, 1);
    assert.equal((await ctx.db.collection("interactions").doc(id("comment")).get()).data()!.body, "Bình luận đã sửa.");
  });
  it("archives posts and tips without deleting comments or changing authors", async () => {
    assert.equal((await request(id("member"), "DELETE", `/admin/community/${id("tip")}`, { reason: "Lưu trữ mẹo hay đã cũ." })).status, 403);
    assert.equal((await request(id("admin"), "DELETE", `/admin/community/${id("tip")}`, { reason: "ngắn" })).status, 400);
    for (const name of ["tip", "post"]) {
      const reason = name === "tip" ? "Lưu trữ mẹo hay đã cũ." : "Lưu trữ bài chia sẻ đã cũ.";
      for (let repeat = 0; repeat < 2; repeat++) {
        assert.equal((await request(id("admin"), "DELETE", `/admin/community/${id(name)}`, { reason })).status, 204);
      }
      const row = (await ctx.db.collection("content_entries").doc(id(name)).get()).data()!;
      assert.equal(row.status, "ARCHIVED");
      assert.equal(row.author_id, id("member"));
      const logs = await ctx.db.collection("audit_logs").where("entity_id", "==", id(name)).get();
      assert.equal(logs.docs.filter(doc => doc.data().action === "COMMUNITY_ARCHIVED").length, 1);
    }
    assert.ok((await ctx.db.collection("interactions").doc(id("comment")).get()).exists);
  });
});
