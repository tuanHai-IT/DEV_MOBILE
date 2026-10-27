import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import "firebase/compat/firestore";
import { ZodError } from "zod";
import { ApiError, type Context } from "../src/core.js";
import { INLINE_MEDIA_MAX_BYTES, registerMediaRoutes } from "../src/media.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `inline_${randomUUID().replaceAll("-", "")}`;
const uid = (name: string) => `${prefix}_${name}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNCsAAAAASUVORK5CYII=", "base64");

describe("Spark inline media using Firestore bytes, without Storage", {skip: !enabled, concurrency: false}, () => {
  let app: App, ctx: Context, server: Server, base: string, env: RulesTestEnvironment;
  const originalMode = process.env.ECOSHARE_MEDIA_BACKEND;
  async function request(who: string | null, method: string, path: string, body?: unknown, mime = "image/png") {
    const binary = Buffer.isBuffer(body);
    const response = await fetch(`${base}${path}`, {method, headers: {
      ...(who ? {"X-Test-User": who} : {}), ...(body === undefined ? {} : {"Content-Type": binary ? mime : "application/json"}),
    }, ...(body === undefined ? {} : {body: binary ? new Uint8Array(body as Buffer) : JSON.stringify(body)})});
    const bytes = Buffer.from(await response.arrayBuffer());
    return {status: response.status, bytes, headers: response.headers,
      data: response.headers.get("Content-Type")?.includes("application/json") && bytes.length ? JSON.parse(bytes.toString()) : null};
  }
  async function ticket(kind: string, parent: string, mime = "image/png") {
    const result = await request(uid("owner"), "POST", "/media", {parent_kind: kind, parent_id: parent, content_type: mime});
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.upload_mode, "FIRESTORE");
    assert.equal(result.data.upload_method, "API_BINARY");
    assert.equal(result.data.max_bytes, INLINE_MEDIA_MAX_BYTES);
    assert.equal(result.data.bucket, undefined);
    return result.data as {id: string; upload_path: string};
  }
  async function ready(kind: string, parent: string, bytes = png, mime = "image/png") {
    const slot = await ticket(kind, parent, mime);
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, bytes, mime)).status, 200);
    assert.equal((await request(uid("owner"), "POST", `/media/${slot.id}/complete`, {})).status, 200);
    return slot;
  }
  before(async () => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(host.hostname)); assert.ok(Number(host.port) > 0);
    process.env.ECOSHARE_MEDIA_BACKEND = "firestore";
    app = initializeApp({projectId: "demo-recycling-share"}, prefix);
    ctx = {db: getFirestore(app), auth: getAuth(app),
      bucket: new Proxy({}, {get() {throw new Error("Spark inline media must never access Storage");}}) as Context["bucket"],
      now: () => new Date().toISOString(), emulator: false};
    env = await initializeTestEnvironment({projectId: "demo-recycling-share", firestore: {host: host.hostname, port: Number(host.port)}});
    for (const [name, role] of [["owner", "MEMBER"], ["outsider", "MEMBER"], ["moderator", "MODERATOR"], ["admin", "ADMIN"]]) {
      await ctx.db.collection("users").doc(uid(name!)).set({id: uid(name!), display_name: name, role, status: "ACTIVE"});
    }
    for (const [name, kind, status] of [["scan", "SCAN", "PRIVATE"], ["post", "POST", "PUBLISHED"], ["tip", "TIP", "PUBLISHED"]]) {
      await ctx.db.collection("content_entries").doc(uid(name!)).set({id: uid(name!), author_id: uid("owner"), kind, status, title: name});
    }
    await ctx.db.collection("verifications").doc(uid("kyc")).set({id: uid("kyc"), user_id: uid("owner"), status: "PENDING"});
    const api = express(); api.use(express.json());
    api.use((req, res, next) => {
      const who = req.get("X-Test-User"); if (!who) return next();
      void ctx.db.collection("users").doc(who).get().then(row => {
        if (row.exists) res.locals.actor = {uid: who, role: row.data()!.role, status: row.data()!.status};
        next();
      }).catch(next);
    });
    registerMediaRoutes(api, ctx);
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      if (error instanceof ApiError) res.status(error.status).json({error: error.code});
      else if (error instanceof ZodError) res.status(400).json({error: "VALIDATION_ERROR"});
      else if (error?.type === "entity.too.large") res.status(413).json({error: "FILE_TOO_LARGE"});
      else res.status(500).json({error: String(error)});
    };
    api.use(errors);
    server = await new Promise<Server>(resolve => {const running = api.listen(0, "127.0.0.1", () => resolve(running));});
    const address = server.address(); assert.ok(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (ctx) {
      const ids = ["owner", "outsider", "moderator", "admin"].map(uid), batch = ctx.db.batch();
      const [media, entries, audits] = await Promise.all([
        ctx.db.collection("media_assets").where("uploader_id", "==", uid("owner")).get(),
        ctx.db.collection("content_entries").where("author_id", "==", uid("owner")).get(),
        ctx.db.collection("audit_logs").where("actor_id", "in", ids).get(),
      ]);
      for (const row of [...media.docs, ...entries.docs, ...audits.docs]) batch.delete(row.ref);
      for (const id of ids) batch.delete(ctx.db.collection("users").doc(id));
      batch.delete(ctx.db.collection("verifications").doc(uid("kyc")));
      batch.delete(ctx.db.collection("messages").doc(uid("photo-message")));
      batch.delete(ctx.db.collection("conversations").doc(uid("photo-chat")));
      await batch.commit();
    }
    if (env) await env.cleanup(); if (app) await deleteApp(app);
    if (originalMode === undefined) delete process.env.ECOSHARE_MEDIA_BACKEND; else process.env.ECOSHARE_MEDIA_BACKEND = originalMode;
  });
  it("persists genuine scan image bytes in Firestore and enforces private API/SDK access", async () => {
    const slot = await ready("SCAN", uid("scan"));
    const stored = (await ctx.db.collection("media_assets").doc(slot.id).get()).data()!;
    assert.equal(stored._storage_backend, "FIRESTORE"); assert.equal(stored.visibility, "PRIVATE");
    assert.deepEqual(stored._inline_bytes, png); assert.equal(stored.size_bytes, png.length);
    assert.equal((await request(null, "GET", `/media/${slot.id}/download`)).status, 401);
    assert.equal((await request(uid("outsider"), "GET", `/media/${slot.id}/download`)).status, 403);
    assert.equal((await request(uid("moderator"), "GET", `/media/${slot.id}/download`)).status, 403);
    const own = await request(uid("owner"), "GET", `/media/${slot.id}/download`);
    assert.equal(own.status, 200); assert.deepEqual(own.bytes, png); assert.match(own.headers.get("Content-Type") ?? "", /image\/png/);
    assert.equal((await request(uid("admin"), "GET", `/media/${slot.id}/download`)).status, 200);
    await assertSucceeds(env.authenticatedContext(uid("owner")).firestore().doc(`media_assets/${slot.id}`).get());
    await assertSucceeds(env.authenticatedContext(uid("admin")).firestore().doc(`media_assets/${slot.id}`).get());
    await assertFails(env.authenticatedContext(uid("outsider")).firestore().doc(`media_assets/${slot.id}`).get());
    await assertFails(env.unauthenticatedContext().firestore().doc(`media_assets/${slot.id}`).get());
    await ctx.db.collection("content_entries").doc(uid("scan")).update({status: "PUBLISHED"});
    assert.equal((await request(uid("outsider"), "GET", `/media/${slot.id}/download`)).status, 403);
    await assertFails(env.authenticatedContext(uid("moderator")).firestore().doc(`media_assets/${slot.id}`).get());
    await ctx.db.collection("content_entries").doc(uid("scan")).update({status: "PRIVATE"});
  });
  it("attaches a private photo to a message and exposes it to conversation members", async () => {
    const conversationId = uid("photo-chat"), messageId = uid("photo-message");
    await ctx.db.collection("conversations").doc(conversationId).set({
      id: conversationId, member_a_id: uid("owner"), member_b_id: uid("outsider"), status: "ACCEPTED",
    });
    await ctx.db.collection("messages").doc(messageId).set({
      id: messageId, conversation_id: conversationId, sender_id: uid("owner"), body: "📷 Ảnh",
      sent_at: ctx.now(), read_at: null,
    });
    const slot = await ready("MESSAGE", messageId);
    const message = (await ctx.db.collection("messages").doc(messageId).get()).data()!;
    assert.equal(message.media_id, slot.id);
    assert.equal(message.media_mime, "image/png");
    const memberPhoto = await request(uid("outsider"), "GET", `/media/${slot.id}/download`);
    assert.equal(memberPhoto.status, 200);
    assert.deepEqual(memberPhoto.bytes, png);
    assert.equal((await request(null, "GET", `/media/${slot.id}/download`)).status, 401);
    assert.equal((await request(uid("moderator"), "GET", `/media/${slot.id}/download`)).status, 403);
  });
  it("keeps published post/tip images public while excluding binary fields from JSON listings", async () => {
    for (const kind of ["post", "tip"]) {
      const slot = await ready("CONTENT", uid(kind));
      assert.equal((await ctx.db.collection("content_entries").doc(uid(kind)).get()).data()!.status, "PUBLISHED");
      assert.deepEqual((await request(null, "GET", `/media/${slot.id}/download`)).bytes, png);
      const list = await request(null, "GET", `/media?parent_kind=CONTENT&parent_id=${uid(kind)}`);
      assert.equal(list.status, 200); assert.ok(list.data.items.some((row: any) => row.id === slot.id));
      assert.ok(!JSON.stringify(list.data).includes("_inline")); assert.ok(!JSON.stringify(list.data).includes('"data":['));
      await ctx.db.collection("content_entries").doc(uid(kind)).update({status: "HIDDEN"});
      assert.equal((await request(null, "GET", `/media/${slot.id}/download`)).status, 403);
      await assertFails(env.unauthenticatedContext().firestore().doc(`media_assets/${slot.id}`).get());
      assert.equal((await request(uid("owner"), "GET", `/media/${slot.id}/download`)).status, 200);
    }
  });
  it("rejects nonowners, MIME spoofing, missing bytes and oversized payloads before storing data", async () => {
    const slot = await ticket("SCAN", uid("scan"));
    assert.equal((await request(uid("outsider"), "PUT", slot.upload_path, png)).status, 403);
    assert.equal((await request(null, "PUT", slot.upload_path, png)).status, 401);
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, png, "image/jpeg")).status, 409);
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, Buffer.from("HTML cannot be a PNG"))).status, 409);
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, Buffer.alloc(0))).status, 400);
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, Buffer.alloc(INLINE_MEDIA_MAX_BYTES + 1))).status, 413);
    assert.equal((await request(uid("owner"), "POST", `/media/${slot.id}/complete`, {})).status, 409);
    assert.equal((await ctx.db.collection("media_assets").doc(slot.id).get()).data()!._inline_bytes, undefined);
  });
  it("makes duplicate uploads/completion idempotent and forbids replacing an existing image", async () => {
    const slot = await ticket("SCAN", uid("scan"));
    const results = await Promise.all(Array.from({length: 4}, () => request(uid("owner"), "PUT", slot.upload_path, png)));
    assert.ok(results.every(row => row.status === 200), JSON.stringify(results.map(row => row.data)));
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, Buffer.concat([png, Buffer.from([0])]))).status, 409);
    const completed = await Promise.all(Array.from({length: 3}, () => request(uid("owner"), "POST", `/media/${slot.id}/complete`, {})));
    assert.ok(completed.every(row => row.status === 200));
    const retry = await request(uid("owner"), "PUT", slot.upload_path, png); assert.equal(retry.status, 200); assert.equal(retry.data.status, "READY");
    assert.equal((await request(uid("outsider"), "POST", `/media/${slot.id}/complete`, {})).status, 403);
    await ctx.db.collection("content_entries").doc(uid("scan")).update({status: "ARCHIVED"});
    assert.equal((await request(uid("owner"), "PUT", slot.upload_path, png)).status, 409);
    await ctx.db.collection("content_entries").doc(uid("scan")).update({status: "PRIVATE"});
  });
  it("supports bounded private PDF evidence without permitting PDF scan uploads", async () => {
    assert.equal((await request(uid("owner"), "POST", "/media", {parent_kind: "SCAN", parent_id: uid("scan"), content_type: "application/pdf"})).status, 400);
    const pdf = Buffer.from("%PDF-1.4\nlocal evidence fixture\n%%EOF");
    const slot = await ready("VERIFICATION", uid("kyc"), pdf, "application/pdf");
    assert.equal((await request(null, "GET", `/media/${slot.id}/download`)).status, 401);
    assert.equal((await request(uid("moderator"), "GET", `/media/${slot.id}/download`)).status, 403);
    assert.deepEqual((await request(uid("owner"), "GET", `/media/${slot.id}/download`)).bytes, pdf);
    await ctx.db.collection("verifications").doc(uid("kyc")).update({status: "VERIFIED"});
    assert.equal((await request(uid("owner"), "POST", `/media/${slot.id}/complete`, {})).status, 409);
  });
});
