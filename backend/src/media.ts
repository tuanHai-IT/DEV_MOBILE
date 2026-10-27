import { raw, type Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { Transaction } from "firebase-admin/firestore";
import {
  actor,
  assertTransactionRole,
  asyncRoute,
  audit,
  docData,
  page,
  pathId,
  requireThat,
  type Actor,
  type Context,
} from "./core.js";

const parents = {
  LISTING: "listings",
  MESSAGE: "messages",
  CONTENT: "content_entries",
  SCAN: "content_entries",
  REPORT: "reports",
  VERIFICATION: "verifications",
  AVATAR: "users",
} as const;
type Kind = keyof typeof parents;
export const INLINE_MEDIA_MAX_BYTES = 384 * 1024;
function firestoreMediaMode(): boolean {
  const mode = (process.env.ECOSHARE_MEDIA_BACKEND ?? "storage").trim().toLowerCase();
  requireThat(["storage", "firestore"].includes(mode), 500, "INVALID_MEDIA_BACKEND", "Cấu hình nơi lưu ảnh không hợp lệ.");
  return mode === "firestore";
}
function mimeSignature(bytes: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "video/mp4") return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp";
  return mime === "application/pdf" && bytes.toString("ascii", 0, 5) === "%PDF-";
}
function binaryDigest(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function inlineBytes(row: Record<string, any>): Buffer {
  const stored = row._inline_bytes;
  requireThat(Buffer.isBuffer(stored) || stored instanceof Uint8Array, 409, "FILE_NOT_UPLOADED", "Ảnh chưa được tải lên database.");
  const bytes = Buffer.from(stored);
  requireThat(bytes.length > 0 && bytes.length <= INLINE_MEDIA_MAX_BYTES && bytes.length <= row._max_bytes,
    409, "INVALID_FILE", "Ảnh phải nhỏ hơn hoặc bằng 384 KiB.");
  requireThat(mimeSignature(bytes, row.mime_type), 409, "INVALID_FILE_SIGNATURE", "Nội dung tệp không đúng định dạng khai báo.");
  requireThat(row._inline_sha256 === binaryDigest(bytes), 409, "INVALID_FILE", "Ảnh đã thay đổi trong quá trình tải lên.");
  return bytes;
}
function updateParentAfterCompletion(tx: Transaction, ctx: Context, current: Record<string, any>, parent: Record<string, any>): void {
  if (current._parent_type === "MESSAGE") tx.update(ctx.db.collection("messages").doc(current._parent_id), {
    media_id: current.id,
    media_mime: current.mime_type,
  });
  if (current._parent_type === "LISTING") tx.update(ctx.db.collection("listings").doc(current._parent_id), {status: "PENDING", updated_at: ctx.now()});
  if (current._parent_type === "CONTENT") tx.update(ctx.db.collection("content_entries").doc(current._parent_id), {
    ...(["POST", "TIP", "STORY"].includes(parent.kind) ? {} : {status: "DRAFT"}), updated_at: ctx.now(),
  });
}
async function revokeEmulatorDownloadTokens(
  ctx: Context,
  storageKey: string,
  previousTokens: unknown,
): Promise<void> {
  if (!ctx.emulator) return;
  // The emulator keeps tokens separately from GCS custom metadata, so deleting
  // the reserved metadata field alone does not revoke an existing download URL.
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  requireThat(
    host,
    500,
    "STORAGE_EMULATOR_NOT_CONFIGURED",
    "Chưa cấu hình Storage emulator.",
  );
  const base = new URL(`http://${host}`);
  requireThat(
    ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) &&
      Number(base.port) > 0 &&
      !base.username &&
      !base.password &&
      base.pathname === "/" &&
      !base.search &&
      !base.hash,
    500,
    "INVALID_EMULATOR_HOST",
    "Storage emulator phải chạy trên máy cục bộ.",
  );
  const tokens =
    typeof previousTokens === "string"
      ? [...new Set(previousTokens.split(",").filter(Boolean))]
      : [];
  const signal = AbortSignal.timeout(5000);
  for (const token of tokens) {
    const endpoint = new URL(
      `/v0/b/${encodeURIComponent(ctx.bucket.name)}/o/${encodeURIComponent(storageKey)}`,
      base,
    );
    endpoint.searchParams.set("delete_token", token);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer owner" },
      signal,
    });
    requireThat(
      response.ok,
      502,
      "TOKEN_REVOCATION_FAILED",
      "Chưa thể thu hồi liên kết tải lên. Vui lòng thử lại.",
    );
    await response.arrayBuffer();
  }
}
async function permission(
  ctx: Context,
  kind: Kind,
  id: string,
  who: Actor | undefined,
  write: boolean,
  tx?: Transaction,
): Promise<Record<string, any>> {
  requireThat(
    Object.hasOwn(parents, kind),
    409,
    "INVALID_MEDIA_PARENT",
    "Tệp không có liên kết hợp lệ.",
  );
  const ref = ctx.db.collection(parents[kind]).doc(id);
  const row = docData(await (tx ? tx.get(ref) : ref.get()));
  let owner = false,
    visible = false;
  switch (kind) {
    case "AVATAR":
      owner = who?.uid === id;
      visible = row.status === "ACTIVE";
      break;
    case "LISTING":
      owner = who?.uid === row.seller_id;
      visible = row.status === "APPROVED";
      requireThat(
        !write || row.status !== "HIDDEN",
        409,
        "LISTING_HIDDEN",
        "Liên hệ quản trị viên để mở lại bài đăng trước khi thêm ảnh.",
      );
      break;
    case "CONTENT":
      owner = who?.uid === row.author_id;
      if (row.kind === "STORY")
        requireThat(typeof row.expires_at === "string" && row.expires_at > ctx.now(), 404, "STORY_EXPIRED", "Story đã hết hạn.");
      visible = row.status === "PUBLISHED" && row.kind !== "SCAN";
      requireThat(
        row.kind !== "SCAN" && (!write || !["ARCHIVED", "HIDDEN"].includes(row.status)),
        409,
        "CONTENT_ARCHIVED",
        "Mở lại nội dung trước khi thêm ảnh.",
      );
      break;
    case "SCAN":
      requireThat(row.kind === "SCAN", 404, "NOT_FOUND", "Không tìm thấy ảnh SCAN.");
      owner = who?.uid === row.author_id;
      requireThat(!write || row.status === "PRIVATE", 409, "SCAN_ARCHIVED", "Ảnh SCAN đã được lưu trữ.");
      break;
    case "REPORT":
      owner = who?.uid === row.reporter_id;
      break;
    case "VERIFICATION":
      owner = who?.uid === row.user_id;
      requireThat(
        !write || row.status === "PENDING",
        409,
        "VERIFICATION_CLOSED",
        "Hồ sơ đã được xét duyệt.",
      );
      break;
    case "MESSAGE": {
      const conversationRef = ctx.db
        .collection("conversations")
        .doc(row.conversation_id);
      const conversation = docData(
        await (tx ? tx.get(conversationRef) : conversationRef.get()),
      );
      owner = write
        ? who?.uid === row.sender_id
        : [conversation.member_a_id, conversation.member_b_id].includes(
            who?.uid,
          );
      break;
    }
  }
  const admin = who?.role === "ADMIN";
  const moderator =
    who?.role === "MODERATOR" &&
    (["LISTING", "CONTENT"].includes(kind) ||
      (kind === "REPORT" && !row.order_id));
  requireThat(
    write
      ? owner || (kind === "CONTENT" && admin)
      : visible || owner || admin || moderator,
    403,
    "MEDIA_FORBIDDEN",
    "Bạn không có quyền truy cập tệp này.",
  );
  return row;
}
export function registerMediaRoutes(router: Router, ctx: Context): void {
  router.get(
    "/media",
    asyncRoute(async (req, res) => {
      const kind = z
          .enum([
            "LISTING",
            "MESSAGE",
            "CONTENT",
            "SCAN",
            "REPORT",
            "VERIFICATION",
            "AVATAR",
          ])
          .parse(req.query.parent_kind),
        parentId = pathId(req.query.parent_id);
      await permission(ctx, kind, parentId, res.locals.actor, false);
      const result = await page(
        ctx.db
          .collection("media_assets")
          .where("_parent_type", "==", kind)
          .where("_parent_id", "==", parentId)
          .where("_status", "==", "READY")
          .select("mime_type", "visibility", "size_bytes", "created_at"),
        req,
      );
      res.json({
        ...result,
        items: result.items.map((row) => ({
          id: row.id,
          mime_type: row.mime_type,
          visibility: row.visibility,
          size_bytes: row.size_bytes,
          created_at: row.created_at,
        })),
      });
    }),
  );
  router.post(
    "/media",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        body = z
          .object({
            parent_kind: z.enum([
              "LISTING",
              "MESSAGE",
              "CONTENT",
              "SCAN",
              "REPORT",
              "VERIFICATION",
              "AVATAR",
            ]),
            parent_id: z.string(),
            content_type: z.enum([
              "image/jpeg",
              "image/png",
              "image/webp",
              "video/mp4",
              "application/pdf",
            ]),
          })
          .strict()
          .parse(req.body);
      const parentId = pathId(body.parent_id);
      await permission(ctx, body.parent_kind, parentId, who, true);
      requireThat(
        body.content_type !== "application/pdf" ||
          ["VERIFICATION", "REPORT"].includes(body.parent_kind),
        400,
        "MIME_NOT_ALLOWED",
        "PDF chỉ dành cho xác minh và báo cáo.",
      );
      const inline = firestoreMediaMode();
      const privateFile = ["MESSAGE", "REPORT", "VERIFICATION", "SCAN"].includes(
          body.parent_kind,
        ),
        id = randomUUID().replaceAll("-", "");
      const row = {
        id,
        uploader_id: who.uid,
        storage_key: inline ? `firestore/media_assets/${id}` : `uploads/${who.uid}/${id}/original`,
        mime_type: body.content_type,
        visibility: privateFile ? "PRIVATE" : "PUBLIC",
        listing_id: body.parent_kind === "LISTING" ? parentId : null,
        message_id: body.parent_kind === "MESSAGE" ? parentId : null,
        content_id: ["CONTENT", "SCAN"].includes(body.parent_kind) ? parentId : null,
        report_id: body.parent_kind === "REPORT" ? parentId : null,
        verification_id: body.parent_kind === "VERIFICATION" ? parentId : null,
        _parent_type: body.parent_kind,
        _parent_id: parentId,
        _status: "UPLOADING",
        _max_bytes: inline ? INLINE_MEDIA_MAX_BYTES : 10 * 1024 * 1024,
        ...(inline ? {_storage_backend: "FIRESTORE"} : {}),
        created_at: ctx.now(),
      };
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        await permission(ctx, body.parent_kind, parentId, who, true, tx);
        tx.create(ctx.db.collection("media_assets").doc(id), row);
      });
      res
        .status(201)
        .json({
          id,
          storage_key: row.storage_key,
          ...(inline ? {upload_mode: "FIRESTORE", upload_path: `/media/${id}/upload`} : {bucket: ctx.bucket.name, upload_mode: "STORAGE"}),
          content_type: row.mime_type,
          max_bytes: row._max_bytes,
          upload_method: inline ? "API_BINARY" : "FIREBASE_STORAGE_SDK",
          complete_path: `/v1/media/${id}/complete`,
        });
    }),
  );
  router.put(
    "/media/:id/upload",
    raw({type: () => true, limit: INLINE_MEDIA_MAX_BYTES}),
    asyncRoute(async (req, res) => {
      const who = actor(res), ref = ctx.db.collection("media_assets").doc(pathId(req.params.id));
      requireThat(Buffer.isBuffer(req.body) && req.body.length > 0, 400, "BINARY_REQUIRED", "Gửi bytes ảnh trong request body.");
      const bytes = Buffer.from(req.body), mime = (req.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
      const digest = binaryDigest(bytes);
      const status = await ctx.db.runTransaction(async tx => {
        await assertTransactionRole(tx, ctx, who, ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"]);
        const current = docData(await tx.get(ref));
        requireThat(current.uploader_id === who.uid, 403, "FORBIDDEN", "Chỉ người tạo phiên được tải ảnh lên.");
        requireThat(current._storage_backend === "FIRESTORE", 409, "UPLOAD_MODE_MISMATCH", "Phiên này cần tải lên Firebase Storage.");
        await permission(ctx, current._parent_type, current._parent_id, who, true, tx);
        requireThat(["UPLOADING", "READY"].includes(current._status), 409, "UPLOAD_CLOSED", "Phiên tải ảnh đã đóng.");
        requireThat(mime === current.mime_type, 409, "MIME_MISMATCH", "Định dạng ảnh không khớp phiên tải lên.");
        requireThat(bytes.length <= Math.min(INLINE_MEDIA_MAX_BYTES, current._max_bytes), 413, "FILE_TOO_LARGE", "Ảnh phải nhỏ hơn hoặc bằng 384 KiB.");
        requireThat(mimeSignature(bytes, mime), 409, "INVALID_FILE_SIGNATURE", "Nội dung tệp không đúng định dạng khai báo.");
        if (current._inline_bytes !== undefined) {
          requireThat(current._inline_sha256 === digest && inlineBytes(current).equals(bytes), 409, "UPLOAD_ALREADY_WRITTEN", "Ảnh đã tải lên; tạo phiên mới để đổi ảnh.");
          return current._status;
        }
        requireThat(current._status === "UPLOADING", 409, "UPLOAD_CLOSED", "Phiên tải ảnh đã đóng.");
        tx.update(ref, {_inline_bytes: bytes, _inline_sha256: digest, _inline_uploaded_at: ctx.now()});
        return "UPLOADING";
      });
      res.json({id: ref.id, status, size_bytes: bytes.length});
    }),
  );
  router.post(
    "/media/:id/complete",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        ref = ctx.db.collection("media_assets").doc(pathId(req.params.id)),
        row = docData(await ref.get());
      requireThat(
        row.uploader_id === who.uid,
        403,
        "FORBIDDEN",
        "Chỉ người tải lên được hoàn tất tệp.",
      );
      await permission(ctx, row._parent_type, row._parent_id, who, true);
      if (row._storage_backend === "FIRESTORE") {
        inlineBytes(row);
        await ctx.db.runTransaction(async tx => {
          await assertTransactionRole(tx, ctx, who, ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"]);
          const current = docData(await tx.get(ref));
          requireThat(current.uploader_id === who.uid && current._storage_backend === "FIRESTORE", 403, "FORBIDDEN", "Phiên tải ảnh không hợp lệ.");
          const parent = await permission(ctx, current._parent_type, current._parent_id, who, true, tx);
          requireThat(["UPLOADING", "READY"].includes(current._status), 409, "UPLOAD_CLOSED", "Phiên tải ảnh đã đóng.");
          const bytes = inlineBytes(current);
          if (current._status === "READY") return;
          tx.update(ref, {_status: "READY", size_bytes: bytes.length, completed_at: ctx.now()});
          updateParentAfterCompletion(tx, ctx, current, parent);
        });
        res.json({id: row.id, status: "READY"});
        return;
      }
      if (row._status === "READY") {
        res.json({ id: row.id, status: "READY" });
        return;
      }
      requireThat(
        row._status === "UPLOADING",
        409,
        "UPLOAD_CLOSED",
        "Phiên tải lên đã đóng.",
      );
      const file = ctx.bucket.file(row.storage_key);
      let metadata;
      try {
        [metadata] = await file.getMetadata();
      } catch (error) {
        requireThat(
          (error as { code?: number }).code !== 404,
          409,
          "FILE_NOT_UPLOADED",
          "Tệp chưa được tải lên Storage.",
        );
        throw error;
      }
      const size = Number(metadata.size);
      requireThat(
        size > 0 &&
          size <= row._max_bytes &&
          metadata.contentType === row.mime_type,
        409,
        "INVALID_FILE",
        "Dung lượng hoặc định dạng tệp không khớp.",
      );
      // Check the file header instead of trusting the MIME supplied by the uploader.
      const [header] = await file.download({ start: 0, end: 15 });
      const signature = mimeSignature(header, row.mime_type);
      requireThat(
        signature,
        409,
        "INVALID_FILE_SIGNATURE",
        "Nội dung tệp không đúng định dạng khai báo.",
      );
      await file.setMetadata({
        cacheControl: "private, no-store",
        metadata: { firebaseStorageDownloadTokens: null },
      });
      await revokeEmulatorDownloadTokens(
        ctx,
        row.storage_key,
        metadata.metadata?.firebaseStorageDownloadTokens,
      );
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const current = docData(await tx.get(ref));
        const parent = await permission(
          ctx,
          current._parent_type,
          current._parent_id,
          who,
          true,
          tx,
        );
        requireThat(
          current._status === "UPLOADING" || current._status === "READY",
          409,
          "UPLOAD_CLOSED",
          "Phiên tải lên đã đóng.",
        );
        if (current._status === "READY") return;
        tx.update(ref, {
          _status: "READY",
          size_bytes: size,
          completed_at: ctx.now(),
          _generation: String(metadata.generation ?? ""),
        });
        updateParentAfterCompletion(tx, ctx, current, parent);
      });
      res.json({ id: row.id, status: "READY" });
    }),
  );
  router.get(
    "/media/:id/download",
    asyncRoute(async (req, res) => {
      const row = docData(
          await ctx.db
            .collection("media_assets")
            .doc(pathId(req.params.id))
            .get(),
        ),
        who = res.locals.actor as Actor | undefined;
      requireThat(
        row._status === "READY",
        404,
        "MEDIA_NOT_READY",
        "Tệp chưa sẵn sàng.",
      );
      if (row.visibility === "PRIVATE") actor(res);
      await permission(ctx, row._parent_type, row._parent_id, who, false);
      if (who && (row._parent_type === "VERIFICATION" || (row._parent_type === "SCAN" && who.role === "ADMIN"))) {
        await ctx.db.runTransaction(async (tx) => {
          await assertTransactionRole(tx, ctx, who, [
            "MEMBER",
            "COLLECTOR",
            "MODERATOR",
            "ADMIN",
          ]);
          audit(
            tx,
            ctx,
            who,
            row._parent_type === "SCAN" ? "READ_SCAN" : "READ_EVIDENCE",
            "MediaAsset",
            row.id,
            "Đọc hồ sơ xác minh",
          );
        });
      }
      res.set({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (row._storage_backend === "FIRESTORE") {
        const bytes = inlineBytes(row);
        res.type(row.mime_type);
        res.set("Content-Disposition", 'attachment; filename="ecoshare-file"');
        res.send(bytes);
        return;
      }
      const file = ctx.bucket.file(row.storage_key);
      if (ctx.emulator) {
        res.type(row.mime_type);
        res.set("Content-Disposition", 'attachment; filename="ecoshare-file"');
        await pipeline(file.createReadStream(), res);
        return;
      }
      const expires = Date.now() + 5 * 60_000;
      const [url] = await file.getSignedUrl({
        action: "read",
        expires,
        responseDisposition: 'attachment; filename="ecoshare-file"',
      });
      res.json({ url, expires_at: new Date(expires).toISOString() });
    }),
  );
}
