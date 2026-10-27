import type { Request, Response, Router } from "express";
import type { Query } from "firebase-admin/firestore";
import { z } from "zod";
import {
  actor, assertTransactionRole, asyncRoute, audit, docData, idempotency, idSchema, page,
  pathId, reasonSchema, requireThat, sha, type Actor, type Context,
} from "./core.js";

const kinds = ["POST", "TIP", "SCAN"] as const;
const statuses = ["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED", "PRIVATE"] as const;
const changeSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().max(500).optional(),
  materials: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  weight_kg: z.number().min(0).max(100000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  status: z.enum(statuses).optional(),
  reason: reasonSchema,
}).strict();
const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000).optional(),
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  reason: reasonSchema,
}).strict();
const createSchema = z.object({
  kind: z.enum(["POST", "TIP"]),
  title: changeSchema.shape.title,
  body: z.string().trim().min(1).max(500),
  materials: changeSchema.shape.materials.default([]),
  weight_kg: changeSchema.shape.weight_kg.default(null),
  tags: changeSchema.shape.tags.default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  reason: reasonSchema,
}).strict();
const moderationRoles = ["ADMIN", "MODERATOR"];
function authorizeEntry(who: Actor, entry: Record<string, any>): void {
  requireThat(kinds.includes(entry.kind), 404, "NOT_FOUND", "Không tìm thấy nội dung cộng đồng.");
  requireThat(entry.kind !== "SCAN" || who.role === "ADMIN", 403, "FORBIDDEN", "Chỉ Admin được quản lý ảnh SCAN riêng tư.");
}
function entryStatus(kind: string, status: string): void {
  requireThat(
    kind === "SCAN" ? ["PRIVATE", "ARCHIVED"].includes(status) : ["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].includes(status),
    400, "INVALID_STATUS", "Trạng thái không phù hợp với loại nội dung.",
  );
}
function publicFields(row: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("_")));
}

/** Moderation shares the existing ContentEntry/Interaction classes; scans stay private. */
export function registerSocialAdminRoutes(router: Router, ctx: Context): void {
  router.post("/admin/community", asyncRoute(async (req, res) => {
    const who = actor(res, ["ADMIN"]), input = createSchema.parse(req.body), key = idempotency(req);
    const { reason, ...fields } = input, hash = sha(JSON.stringify(input));
    const ref = ctx.db.collection("content_entries").doc(sha(`social:admin:${who.uid}:${key}`));
    const result = await ctx.db.runTransaction(async tx => {
      await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
      const previous = await tx.get(ref);
      if (previous.exists) {
        requireThat(previous.data()!._request_hash === hash, 409, "IDEMPOTENCY_CONFLICT", "Khóa tạo bài đã dùng với nội dung khác.");
        return { row: docData(previous), created: false };
      }
      const row = { ...fields, id: ref.id, author_id: who.uid, title: fields.title ?? fields.body.slice(0, 80),
        parent_id: null, like_count: 0, saved_count: 0, comment_count: 0, created_at: ctx.now(), updated_at: ctx.now(),
        metadata_json: "{}", starts_at: null, ends_at: null, points_cost: 0, _social: true, _request_hash: hash };
      tx.create(ref, row);
      audit(tx, ctx, who, "COMMUNITY_CREATED", "ContentEntry", ref.id, reason);
      return { row, created: true };
    });
    res.status(result.created ? 201 : 200).json(publicFields(result.row));
  }));
  router.get("/admin/community", asyncRoute(async (req, res) => {
    const who = actor(res, moderationRoles);
    const kind = req.query.kind === undefined ? undefined : z.enum(kinds).parse(req.query.kind);
    requireThat(kind !== "SCAN" || who.role === "ADMIN", 403, "FORBIDDEN", "Chỉ Admin được quản lý SCAN.");
    let query: Query = ctx.db.collection("content_entries");
    query = kind ? query.where("kind", "==", kind) : query.where("kind", "in", who.role === "ADMIN" ? [...kinds] : ["POST", "TIP"]);
    if (req.query.status !== undefined) {
      const status = z.enum(statuses).parse(req.query.status);
      if (kind) entryStatus(kind, status);
      requireThat(status !== "PRIVATE" || who.role === "ADMIN", 403, "FORBIDDEN", "Nội dung riêng tư chỉ dành cho Admin.");
      query = query.where("status", "==", status);
    }
    if (req.query.author_id !== undefined) query = query.where("author_id", "==", idSchema.parse(req.query.author_id));
    const result = await page(query, req);
    res.json({ ...result, items: result.items.map(publicFields) });
  }));
  router.get("/admin/community/:id", asyncRoute(async (req, res) => {
    const who = actor(res, moderationRoles);
    const entry = docData(await ctx.db.collection("content_entries").doc(pathId(req.params.id)).get());
    authorizeEntry(who, entry);
    if (entry.kind === "SCAN") {
      await ctx.db.runTransaction(async tx => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        audit(tx, ctx, who, "PRIVATE_SCAN_VIEWED", "ContentEntry", entry.id, "Xem ảnh SCAN trong bảng quản trị.");
      });
    }
    res.json(publicFields(entry));
  }));
  router.patch("/admin/community/:id", asyncRoute(async (req, res) => {
    const who = actor(res, moderationRoles), id = pathId(req.params.id);
    const { reason, ...fields } = changeSchema.parse(req.body);
    requireThat(Object.keys(fields).length > 0, 400, "FIELDS_REQUIRED", "Chọn ít nhất một trường cần sửa.");
    const ref = ctx.db.collection("content_entries").doc(id);
    const result = await ctx.db.runTransaction(async tx => {
      const live = await assertTransactionRole(tx, ctx, who, moderationRoles);
      const entry = docData(await tx.get(ref));
      authorizeEntry({ ...who, role: live.role }, entry);
      if (fields.status) entryStatus(entry.kind, fields.status);
      requireThat(entry.kind === "SCAN" || fields.body === undefined || fields.body.length > 0,
        400, "BODY_REQUIRED", "Bài chia sẻ và mẹo hay cần có nội dung.");
      if (entry.kind === "SCAN") requireThat(
        Object.keys(fields).every(key => ["body", "title", "status"].includes(key)),
        400, "SCAN_FIELDS", "Ảnh SCAN chỉ cho phép sửa tên, ghi chú hoặc lưu trữ riêng tư.",
      );
      const update = { ...fields, updated_at: ctx.now() };
      tx.update(ref, update);
      audit(tx, ctx, who, "COMMUNITY_UPDATED", "ContentEntry", id, reason);
      return { ...entry, ...update };
    });
    res.json(publicFields(result));
  }));
  router.delete("/admin/community/:id", asyncRoute(async (req, res) => {
    const who = actor(res, moderationRoles), id = pathId(req.params.id);
    const { reason } = z.object({ reason: reasonSchema }).strict().parse(req.body);
    const ref = ctx.db.collection("content_entries").doc(id);
    await ctx.db.runTransaction(async tx => {
      const live = await assertTransactionRole(tx, ctx, who, moderationRoles);
      const entry = docData(await tx.get(ref));
      authorizeEntry({ ...who, role: live.role }, entry);
      if (entry.status === "ARCHIVED") return;
      tx.update(ref, { status: "ARCHIVED", updated_at: ctx.now() });
      audit(tx, ctx, who, "COMMUNITY_ARCHIVED", "ContentEntry", id, reason);
    });
    res.status(204).end();
  }));
  router.get("/admin/community/:id/comments", asyncRoute(async (req, res) => {
    const who = actor(res, moderationRoles);
    const entry = docData(await ctx.db.collection("content_entries").doc(pathId(req.params.id)).get());
    authorizeEntry(who, entry);
    requireThat(entry.kind !== "SCAN", 400, "SCAN_PRIVATE", "Ảnh SCAN không có bình luận công khai.");
    let query: Query = ctx.db.collection("interactions").where("type", "==", "COMMENT").where("content_id", "==", entry.id);
    if (req.query.status !== undefined) query = query.where("status", "==", z.enum(["PUBLISHED", "HIDDEN"]).parse(req.query.status));
    const result = await page(query, req);
    const users = [...new Set(result.items.map(row => pathId(row.user_id)))];
    const profiles = users.length ? await ctx.db.getAll(...users.map(id => ctx.db.collection("users").doc(id))) : [];
    const profileMap = new Map(profiles.map(doc => [doc.id, doc.data()]));
    res.json({ ...result, items: result.items.map(row => ({ ...publicFields(row), author: {
      id: row.user_id,
      display_name: profileMap.get(row.user_id)?.status === "ACTIVE" ? profileMap.get(row.user_id)?.display_name ?? "Thành viên EcoShare" : "Thành viên EcoShare",
    } })) });
  }));
  async function moderateComment(req: Request, res: Response, remove: boolean) {
    const who = actor(res, moderationRoles), id = pathId(req.params.id);
    const parsed = remove
      ? { ...z.object({ reason: reasonSchema }).strict().parse(req.body), status: "HIDDEN" as const }
      : commentSchema.parse(req.body);
    const { reason, ...fields } = parsed;
    requireThat(Object.keys(fields).length > 0, 400, "FIELDS_REQUIRED", "Chọn trường bình luận cần sửa.");
    const ref = ctx.db.collection("interactions").doc(id);
    const result = await ctx.db.runTransaction(async tx => {
      const live = await assertTransactionRole(tx, ctx, who, moderationRoles);
      const comment = docData(await tx.get(ref));
      requireThat(comment.type === "COMMENT" && comment.content_id, 404, "NOT_FOUND", "Không tìm thấy bình luận.");
      const entryRef = ctx.db.collection("content_entries").doc(pathId(comment.content_id));
      const entry = docData(await tx.get(entryRef));
      authorizeEntry({ ...who, role: live.role }, entry);
      requireThat(entry.kind !== "SCAN", 400, "SCAN_PRIVATE", "Ảnh SCAN không có bình luận.");
      const oldPublished = comment.status === "PUBLISHED";
      const newPublished = (fields.status ?? comment.status) === "PUBLISHED";
      if (oldPublished !== newPublished) tx.update(entryRef, {
        comment_count: Math.max(0, (Number.isSafeInteger(entry.comment_count) ? entry.comment_count : 0) + (newPublished ? 1 : -1)),
        updated_at: ctx.now(),
      });
      const update = { ...fields, updated_at: ctx.now() };
      tx.update(ref, update);
      audit(tx, ctx, who, remove ? "COMMENT_HIDDEN" : "COMMENT_UPDATED", "Interaction", id, reason);
      return { ...comment, ...update };
    });
    if (remove) res.status(204).end(); else res.json(publicFields(result));
  }
  router.patch("/admin/comments/:id", asyncRoute((req, res) => moderateComment(req, res, false)));
  router.delete("/admin/comments/:id", asyncRoute((req, res) => moderateComment(req, res, true)));
}
