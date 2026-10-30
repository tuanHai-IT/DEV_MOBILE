import type { Router } from "express";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import {
  actor,
  assertActiveVerified,
  assertTransactionRole,
  asyncRoute,
  audit,
  docData,
  idempotency,
  page,
  pathId,
  reasonSchema,
  requireThat,
  sha,
  type Context,
  type Actor,
} from "./core.js";

const label = z.string().trim().min(1).max(200);
const itemBody = z
  .object({
    category_id: z.string(),
    name: label,
    material: label,
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "USED"]),
    price_vnd: z.number().int().min(1000).max(999_999_999),
    stock: z.number().int().min(1).max(10000),
    unit: label,
  })
  .strict();
const listingBody = z
  .object({
    title: label,
    description: z.string().trim().min(10).max(10000),
    city: label,
    tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    items: z.array(itemBody).min(1).max(20),
  })
  .strict();
const orderBody = z
  .object({
    address_id: z.string(),
    items: z
      .array(
        z
          .object({
            listing_item_id: z.string(),
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const publicRow = (row: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(row).filter(([key]) => !key.startsWith("_")),
  );

/** Feed-ready listing previews avoid a separate item, photo and seller request per Android card. */
export async function listingPreviews(ctx: Context, rows: Record<string, any>[]) {
  if (!rows.length) return [];
  const sellerIds = [...new Set(rows.map(row => String(row.seller_id ?? "")).filter(Boolean))];
  const [itemPages, mediaPages, sellerDocs] = await Promise.all([
    Promise.all(rows.map(row => ctx.db.collection("listing_items").where("listing_id", "==", row.id).limit(20).get())),
    Promise.all(rows.map(row => ctx.db.collection("media_assets")
      .where("_parent_type", "==", "LISTING").where("_parent_id", "==", row.id)
      .where("_status", "==", "READY").limit(1).get())),
    sellerIds.length ? ctx.db.getAll(...sellerIds.map(id => ctx.db.collection("users").doc(id))) : Promise.resolve([]),
  ]);
  const sellers = new Map(sellerIds.map((id, index) => [id, sellerDocs[index]?.data()]));
  return rows.map((row, index) => {
    const prices = itemPages[index].docs.map(doc => Number(doc.data().price_vnd))
      .filter(price => Number.isSafeInteger(price) && price >= 0);
    const seller = sellers.get(String(row.seller_id ?? ""));
    const active = seller?.status === "ACTIVE";
    return {...publicRow(row), id: row.id, min_price_vnd: prices.length ? Math.min(...prices) : null,
      preview_media_id: mediaPages[index].docs[0]?.id ?? null,
      seller: {display_name: active ? seller?.display_name || "Thành viên EcoShare" : "Thành viên EcoShare",
        avatar_key: active ? seller?.avatar_key ?? null : null}};
  });
}

/** Available stock is reserved at checkout. Release is atomic and may happen only once. */
async function releaseOrder(
  tx: Transaction,
  ctx: Context,
  who: Actor,
  order: Record<string, any>,
  reason: string,
): Promise<boolean> {
  if (order.status !== "PENDING_PAYMENT") return false;
  const payments = await tx.get(
    ctx.db.collection("payments").where("order_id", "==", order.id),
  );
  requireThat(
    !payments.docs.some((doc) =>
      ["PENDING", "SUCCEEDED"].includes(doc.data().status),
    ),
    409,
    "PAYMENT_UNCERTAIN",
    "Đối soát hoặc hoàn tiền trước khi hủy đơn có thanh toán đang xử lý.",
  );
  const rows = await tx.get(
    ctx.db.collection("order_items").where("order_id", "==", order.id),
  );
  const stocks = await Promise.all(
    rows.docs.map((row) =>
      tx.get(
        ctx.db.collection("listing_items").doc(row.data().listing_item_id),
      ),
    ),
  );
  if (order._reservation_state === "HELD")
    rows.docs.forEach((row, index) => {
      requireThat(
        stocks[index].exists,
        409,
        "INVENTORY_MISSING",
        "Cần quản trị viên kiểm tra tồn kho.",
      );
      tx.update(stocks[index].ref, {
        stock: FieldValue.increment(row.data().quantity),
        _reserved: FieldValue.increment(-row.data().quantity),
      });
    });
  tx.update(ctx.db.collection("orders").doc(order.id), {
    status: "CANCELLED",
    _reservation_state: "RELEASED",
    cancel_reason: reason,
    updated_at: ctx.now(),
  });
  audit(tx, ctx, who, "CANCEL", "Order", order.id, reason);
  return true;
}

export async function expireOrders(ctx: Context): Promise<number> {
  // Persist the scan position so unresolved gateway payments cannot starve later orders.
  const checkpoint = ctx.db
    .collection("system_settings")
    .doc("internal_expiry_scan");
  let cursor = (await checkpoint.get()).data();
  let count = 0;
  for (let batch = 0; batch < 5; batch++) {
    let query = ctx.db
      .collection("orders")
      .where("status", "==", "PENDING_PAYMENT")
      .where("expires_at", "<=", ctx.now())
      .orderBy("expires_at")
      .orderBy("__name__");
    if (cursor?.expires_at && cursor?.id)
      query = query.startAfter(cursor.expires_at, cursor.id);
    const candidates = await query.limit(100).get();
    for (const candidate of candidates.docs) {
      try {
        const changed = await ctx.db.runTransaction(async (tx) => {
          const order = docData(await tx.get(candidate.ref));
          if (order.expires_at > ctx.now()) return false;
          return releaseOrder(
            tx,
            ctx,
            { uid: "reservation-scheduler", role: "ADMIN", status: "ACTIVE" },
            order,
            "Hết thời gian giữ hàng",
          );
        });
        if (changed) count++;
      } catch (error) {
        if ((error as { code?: string }).code !== "PAYMENT_UNCERTAIN")
          throw error;
      }
    }
    if (candidates.size < 100) {
      await checkpoint.set({ kind: "EXPIRY_SCAN", id: null, expires_at: null });
      break;
    }
    const last = candidates.docs.at(-1)!;
    cursor = { id: last.id, expires_at: last.data().expires_at };
    await checkpoint.set({ ...cursor, kind: "EXPIRY_SCAN" });
  }
  return count;
}

export function registerMarketplaceRoutes(router: Router, ctx: Context): void {
  router.get(
    "/categories",
    asyncRoute(async (req, res) =>
      res.json(
        await page(
          ctx.db.collection("categories").where("active", "==", true),
          req,
        ),
      ),
    ),
  );
  router.get(
    "/collection-points",
    asyncRoute(async (req, res) =>
      res.json(
        await page(
          ctx.db
            .collection("collection_points")
            .where("status", "==", "ACTIVE"),
          req,
        ),
      ),
    ),
  );
  router.get(
    "/content",
    asyncRoute(async (req, res) =>
      res.json(
        await page(
          ctx.db
            .collection("content_entries")
            .where("status", "==", "PUBLISHED")
            .where("kind", "in", ["ARTICLE", "GROUP", "EVENT", "CHALLENGE", "REWARD", "BADGE"]),
          req,
        ),
      ),
    ),
  );
  router.get(
    "/content/:id",
    asyncRoute(async (req, res) => {
      const row = docData(
        await ctx.db
          .collection("content_entries")
          .doc(pathId(req.params.id))
          .get(),
      );
      requireThat(
        row.status === "PUBLISHED" && ["ARTICLE", "GROUP", "EVENT", "CHALLENGE", "REWARD", "BADGE"].includes(row.kind),
        404,
        "NOT_FOUND",
        "Nội dung chưa xuất bản.",
      );
      res.json(publicRow(row));
    }),
  );
  router.get(
    "/listings",
    asyncRoute(async (req, res) => {
      let query = ctx.db
        .collection("listings")
        .where("status", "==", "APPROVED");
      if (req.query.city)
        query = query.where("city", "==", label.parse(req.query.city));
      if (req.query.seller_id)
        query = query.where("seller_id", "==", pathId(req.query.seller_id));
      const result = await page(query, req);
      res.json({ ...result, items: await listingPreviews(ctx, result.items) });
    }),
  );
  router.get(
    "/me/listings",
    asyncRoute(async (req, res) =>
      res.json(
        await page(
          ctx.db
            .collection("listings")
            .where("seller_id", "==", actor(res).uid),
          req,
        ),
      ),
    ),
  );
  router.get(
    "/listings/:id",
    asyncRoute(async (req, res) => {
      const row = docData(
        await ctx.db.collection("listings").doc(pathId(req.params.id)).get(),
      );
      const who = res.locals.actor as Actor | undefined;
      requireThat(
        row.status === "APPROVED" ||
          who?.uid === row.seller_id ||
          ["ADMIN", "MODERATOR"].includes(who?.role ?? ""),
        404,
        "NOT_FOUND",
        "Không tìm thấy bài đăng.",
      );
      const [items, previews] = await Promise.all([
        ctx.db.collection("listing_items").where("listing_id", "==", row.id).get(),
        listingPreviews(ctx, [row]),
      ]);
      res.json({
        ...previews[0],
        items: items.docs.map((doc) => publicRow(docData(doc))),
      });
    }),
  );
  router.post(
    "/listings",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        body = listingBody.parse(req.body),
        key = idempotency(req),
        id = sha(`listing:${who.uid}:${key}`),
        hash = sha(JSON.stringify(body));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("listings").doc(id),
          existing = await tx.get(ref);
        if (existing.exists) {
          requireThat(
            existing.data()?._request_hash === hash,
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng cho nội dung khác.",
          );
          return docData(existing);
        }
        for (const item of body.items) {
          const category = docData(
            await tx.get(
              ctx.db.collection("categories").doc(pathId(item.category_id)),
            ),
          );
          requireThat(
            category.active,
            409,
            "CATEGORY_INACTIVE",
            "Danh mục đã bị tắt.",
          );
        }
        const { items, tags, ...fields } = body;
        const listing = {
          id,
          ...fields,
          seller_id: who.uid,
          kind: "SALE",
          status: "PENDING",
          tags_json: JSON.stringify(tags),
          created_at: ctx.now(),
          moderator_id: null,
          moderation_reason: null,
          _request_hash: hash,
        };
        tx.create(ref, listing);
        items.forEach((item, index) => {
          const itemId = sha(`item:${id}:${index}`);
          tx.create(ctx.db.collection("listing_items").doc(itemId), {
            ...item,
            id: itemId,
            listing_id: id,
            _reserved: 0,
          });
        });
        return listing;
      });
      res.status(201).json(publicRow(result));
    }),
  );
  router.patch(
    "/listings/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id);
      const body = z
        .object({
          title: label.optional(),
          description: z.string().trim().min(10).max(10000).optional(),
          city: label.optional(),
          tags: z.array(z.string().max(40)).max(15).optional(),
        })
        .strict()
        .refine((b) => Object.keys(b).length > 0)
        .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("listings").doc(id),
          row = docData(await tx.get(ref));
        requireThat(
          row.seller_id === who.uid,
          403,
          "FORBIDDEN",
          "Chỉ chủ bài đăng được chỉnh sửa.",
        );
        requireThat(
          row.status !== "HIDDEN",
          409,
          "LISTING_HIDDEN",
          "Liên hệ quản trị viên để mở lại bài đăng.",
        );
        const { tags, ...fields } = body;
        tx.update(ref, {
          ...fields,
          ...(tags ? { tags_json: JSON.stringify(tags) } : {}),
          status: "PENDING",
          updated_at: ctx.now(),
        });
      });
      res.json({ id, status: "PENDING" });
    }),
  );
  router.patch(
    "/listing-items/:id/stock",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id),
        body = z
          .object({ stock: z.number().int().min(0).max(10000) })
          .strict()
          .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("listing_items").doc(id),
          item = docData(await tx.get(ref));
        const listing = docData(
          await tx.get(ctx.db.collection("listings").doc(item.listing_id)),
        );
        requireThat(
          listing.seller_id === who.uid,
          403,
          "FORBIDDEN",
          "Chỉ người bán được cập nhật tồn kho.",
        );
        tx.update(ref, { stock: body.stock });
      });
      res.json({ id, ...body });
    }),
  );
  router.patch(
    "/listing-items/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id),
        body = itemBody
          .partial()
          .refine((value) => Object.keys(value).length > 0)
          .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("listing_items").doc(id),
          item = docData(await tx.get(ref));
        const parentRef = ctx.db.collection("listings").doc(item.listing_id),
          listing = docData(await tx.get(parentRef));
        requireThat(
          listing.seller_id === who.uid,
          403,
          "FORBIDDEN",
          "Chỉ người bán được chỉnh sửa sản phẩm.",
        );
        requireThat(
          listing.status !== "HIDDEN",
          409,
          "LISTING_HIDDEN",
          "Liên hệ quản trị viên để mở lại bài đăng.",
        );
        if (body.category_id) {
          const category = docData(
            await tx.get(
              ctx.db.collection("categories").doc(pathId(body.category_id)),
            ),
          );
          requireThat(
            category.active,
            409,
            "CATEGORY_INACTIVE",
            "Danh mục đã bị tắt.",
          );
        }
        tx.update(ref, body);
        if (Object.keys(body).some((key) => key !== "stock"))
          tx.update(parentRef, { status: "PENDING", updated_at: ctx.now() });
      });
      res.json({ id, ...body });
    }),
  );
  router.get(
    "/admin/listings",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN", "MODERATOR"]);
      let query = ctx.db
        .collection("listings")
        .where(
          "status",
          "==",
          z
            .enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"])
            .parse(req.query.status ?? "PENDING"),
        );
      res.json(await page(query, req));
    }),
  );
  router.post(
    "/admin/listings/:id/review",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]),
        id = pathId(req.params.id),
        body = z
          .object({
            status: z.enum(["APPROVED", "REJECTED", "HIDDEN"]),
            reason: z.string().trim().min(5).max(1000),
          })
          .strict()
          .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        const reviewer = await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        const ref = ctx.db.collection("listings").doc(id),
          listing = docData(await tx.get(ref));
        requireThat(
          reviewer.role === "ADMIN" || listing.seller_id !== who.uid,
          403,
          "SELF_REVIEW",
          "Không tự duyệt bài đăng của mình.",
        );
        if (body.status === "APPROVED")
          await assertActiveVerified(tx, ctx, listing.seller_id);
        tx.update(ref, {
          ...body,
          moderator_id: who.uid,
          moderation_reason: body.reason,
          updated_at: ctx.now(),
        });
        audit(tx, ctx, who, body.status, "Listing", id, body.reason);
      });
      res.json({ id, status: body.status });
    }),
  );
  router.delete(
    "/admin/listings/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]),
        id = pathId(req.params.id),
        { reason } = z.object({ reason: reasonSchema }).strict().parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        const reviewer = await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        const ref = ctx.db.collection("listings").doc(id),
          listing = docData(await tx.get(ref));
        requireThat(
          reviewer.role === "ADMIN" || listing.seller_id !== who.uid,
          403,
          "SELF_REVIEW",
          "Không tự quản lý bài đăng bán của mình.",
        );
        if (listing.status === "HIDDEN") return;
        tx.update(ref, {
          status: "HIDDEN",
          reason,
          moderator_id: who.uid,
          moderation_reason: reason,
          updated_at: ctx.now(),
        });
        audit(tx, ctx, who, "LISTING_HIDDEN", "Listing", id, reason);
      });
      res.status(204).end();
    }),
  );
  router.post(
    "/orders",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        body = orderBody.parse(req.body),
        key = idempotency(req),
        id = sha(`order:${who.uid}:${key}`),
        hash = sha(JSON.stringify(body));
      requireThat(
        new Set(body.items.map((item) => item.listing_item_id)).size ===
          body.items.length,
        400,
        "DUPLICATE_ITEMS",
        "Gộp số lượng của các sản phẩm trùng nhau.",
      );
      const result = await ctx.db.runTransaction(async (tx) => {
        const ref = ctx.db.collection("orders").doc(id),
          existing = await tx.get(ref);
        if (existing.exists) {
          requireThat(
            existing.data()?._request_hash === hash,
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng cho đơn khác.",
          );
          return docData(existing);
        }
        await assertActiveVerified(tx, ctx, who.uid);
        const address = docData(
          await tx.get(
            ctx.db.collection("addresses").doc(pathId(body.address_id)),
          ),
        );
        requireThat(
          address.user_id === who.uid,
          403,
          "ADDRESS_NOT_OWNED",
          "Địa chỉ phải thuộc người mua.",
        );
        const items = [] as Record<string, any>[];
        const listings = new Map<string, Record<string, any>>();
        for (const requested of body.items) {
          const item = docData(
            await tx.get(
              ctx.db
                .collection("listing_items")
                .doc(pathId(requested.listing_item_id)),
            ),
          );
          requireThat(
            Number.isSafeInteger(item.price_vnd) &&
              item.price_vnd >= 1000 &&
              item.stock >= requested.quantity,
            409,
            "OUT_OF_STOCK",
            "Sản phẩm đã hết hàng hoặc giá không hợp lệ.",
          );
          items.push({ ...item, quantity: requested.quantity });
          if (!listings.has(item.listing_id))
            listings.set(
              item.listing_id,
              docData(
                await tx.get(
                  ctx.db.collection("listings").doc(item.listing_id),
                ),
              ),
            );
        }
        const sellers = new Set(
          [...listings.values()].map((row) => row.seller_id),
        );
        requireThat(
          sellers.size === 1,
          400,
          "MULTIPLE_SELLERS",
          "Mỗi đơn hàng chỉ mua từ một người bán.",
        );
        const seller = [...sellers][0];
        requireThat(
          seller !== who.uid,
          400,
          "SELF_PURCHASE",
          "Không thể tự mua sản phẩm.",
        );
        await assertActiveVerified(tx, ctx, seller);
        requireThat(
          [...listings.values()].every(
            (row) => row.status === "APPROVED" && row.kind === "SALE",
          ),
          409,
          "LISTING_UNAVAILABLE",
          "Bài đăng chưa được duyệt hoặc ngừng bán.",
        );
        const subtotal = items.reduce(
          (sum, row) => sum + row.price_vnd * row.quantity,
          0,
        );
        requireThat(
          Number.isSafeInteger(subtotal) && subtotal <= 999_999_999,
          400,
          "TOTAL_TOO_LARGE",
          "Giá trị đơn vượt giới hạn.",
        );
        const now = ctx.now(),
          expires = new Date(Date.parse(now) + 20 * 60_000).toISOString();
        const order = {
          id,
          buyer_id: who.uid,
          seller_id: seller,
          address_id: address.id,
          delivery_snapshot: JSON.stringify({
            recipient: address.recipient,
            phone: address.phone,
            line: address.line,
            city: address.city,
          }),
          status: "PENDING_PAYMENT",
          subtotal_vnd: subtotal,
          shipping_vnd: 0,
          total_vnd: subtotal,
          created_at: now,
          completed_at: null,
          expires_at: expires,
          _request_hash: hash,
          _member_ids: [who.uid, seller],
          _reservation_state: "HELD",
          _active_payment_id: null,
        };
        tx.create(ref, order);
        items.forEach((item, index) => {
          tx.update(ctx.db.collection("listing_items").doc(item.id), {
            stock: FieldValue.increment(-item.quantity),
            _reserved: FieldValue.increment(item.quantity),
          });
          const itemId = sha(`order-item:${id}:${index}`);
          tx.create(ctx.db.collection("order_items").doc(itemId), {
            id: itemId,
            order_id: id,
            listing_item_id: item.id,
            title_snapshot: item.name,
            quantity: item.quantity,
            unit_price_vnd: item.price_vnd,
          });
        });
        return order;
      });
      res.status(201).json(publicRow(result));
    }),
  );
  router.get(
    "/me/orders",
    asyncRoute(async (req, res) =>
      res.json(
        await page(
          ctx.db
            .collection("orders")
            .where("_member_ids", "array-contains", actor(res).uid),
          req,
        ),
      ),
    ),
  );
  router.get(
    "/admin/orders",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      res.json(await page(ctx.db.collection("orders"), req));
    }),
  );
  router.post(
    "/admin/orders/:id/resume",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        id = pathId(req.params.id),
        body = z
          .object({ reason: z.string().trim().min(10).max(1000) })
          .strict()
          .parse(req.body);
      const status = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const ref = ctx.db.collection("orders").doc(id),
          order = docData(await tx.get(ref));
        requireThat(
          order.status === "DISPUTED" &&
            order._reservation_state === "CONSUMED" &&
            !order._inventory_released &&
            !order._payment_review_reason,
          409,
          "MANUAL_FINANCIAL_REVIEW",
          "Chỉ khôi phục đơn có khoản thanh toán hợp lệ và còn quyền giữ hàng. Trường hợp thanh toán bất thường cần đối soát hoặc hoàn tiền.",
        );
        await assertActiveVerified(tx, ctx, order.buyer_id);
        await assertActiveVerified(tx, ctx, order.seller_id);
        const reports = await tx.get(
          ctx.db.collection("reports").where("order_id", "==", id),
        );
        const finance = await tx.get(
          ctx.db.collection("payments").where("order_id", "==", id),
        );
        requireThat(
          reports.docs.every((doc) =>
            ["RESOLVED", "DISMISSED"].includes(doc.data().status),
          ),
          409,
          "OPEN_REPORTS",
          "Đóng tất cả báo cáo của đơn trước khi khôi phục.",
        );
        const payments = finance.docs.map(docData),
          charges = payments.filter(
            (row) => row.kind === "CHARGE" && row.status === "SUCCEEDED",
          );
        requireThat(
          charges.length === 1 &&
            charges[0].amount_vnd === order.total_vnd &&
            !payments.some(
              (row) =>
                row.status === "PENDING" ||
                (row.kind === "REFUND" && row.status === "SUCCEEDED"),
            ),
          409,
          "PAYMENT_UNCERTAIN",
          "Cần đối soát thanh toán trước khi khôi phục.",
        );
        const restored = order.completed_at
          ? "COMPLETED"
          : order.shipped_at
            ? "SHIPPED"
            : "PAID";
        tx.update(ref, { status: restored, updated_at: ctx.now() });
        audit(tx, ctx, who, "RESUME_AFTER_DISPUTE", "Order", id, body.reason);
        return restored;
      });
      res.json({ id, status });
    }),
  );
  router.get(
    "/orders/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        row = docData(
          await ctx.db.collection("orders").doc(pathId(req.params.id)).get(),
        );
      requireThat(
        [row.buyer_id, row.seller_id].includes(who.uid) || who.role === "ADMIN",
        403,
        "FORBIDDEN",
        "Bạn không thuộc đơn hàng.",
      );
      const items = await ctx.db
        .collection("order_items")
        .where("order_id", "==", row.id)
        .get();
      res.json({ ...publicRow(row), items: items.docs.map(docData) });
    }),
  );
  router.post(
    "/orders/:id/cancel",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id),
        body = z
          .object({ reason: z.string().trim().min(5).max(1000) })
          .strict()
          .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const order = docData(
          await tx.get(ctx.db.collection("orders").doc(id)),
        );
        requireThat(
          [order.buyer_id, order.seller_id].includes(who.uid) ||
            who.role === "ADMIN",
          403,
          "FORBIDDEN",
          "Bạn không thuộc đơn hàng.",
        );
        if (order.status === "CANCELLED") return;
        requireThat(
          await releaseOrder(tx, ctx, who, order, body.reason),
          409,
          "INVALID_ORDER_STATE",
          "Đơn đã thanh toán cần xử lý hoàn tiền.",
        );
      });
      res.json({ id, status: "CANCELLED" });
    }),
  );
  router.post(
    "/orders/:id/ship",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id),
        body = z
          .object({ carrier: label, tracking_code: label })
          .strict()
          .parse(req.body);
      await ctx.db.runTransaction(async (tx) => {
        await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("orders").doc(id),
          order = docData(await tx.get(ref));
        requireThat(
          order.seller_id === who.uid,
          403,
          "FORBIDDEN",
          "Chỉ người bán xác nhận gửi hàng.",
        );
        requireThat(
          order.status === "PAID",
          409,
          "INVALID_ORDER_STATE",
          "Đơn cần thanh toán thành công trước khi gửi.",
        );
        await assertActiveVerified(tx, ctx, order.buyer_id);
        const rows = await tx.get(
          ctx.db.collection("order_items").where("order_id", "==", id),
        );
        const stocks = await Promise.all(
          rows.docs.map((doc) =>
            tx.get(
              ctx.db
                .collection("listing_items")
                .doc(doc.data().listing_item_id),
            ),
          ),
        );
        rows.docs.forEach((doc, index) => {
          if (stocks[index].exists)
            tx.update(stocks[index].ref, {
              _reserved: FieldValue.increment(-doc.data().quantity),
            });
        });
        tx.update(ref, {
          status: "SHIPPED",
          ...body,
          shipped_at: ctx.now(),
          updated_at: ctx.now(),
        });
        audit(tx, ctx, who, "SHIP", "Order", id, body.tracking_code);
      });
      res.json({ id, status: "SHIPPED" });
    }),
  );
  router.post(
    "/orders/:id/complete",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        id = pathId(req.params.id);
      z.object({})
        .strict()
        .parse(req.body ?? {});
      await ctx.db.runTransaction(async (tx) => {
        const user = await assertActiveVerified(tx, ctx, who.uid);
        const ref = ctx.db.collection("orders").doc(id),
          order = docData(await tx.get(ref));
        requireThat(
          order.buyer_id === who.uid,
          403,
          "FORBIDDEN",
          "Chỉ người mua xác nhận đã nhận hàng.",
        );
        if (order.status === "COMPLETED") return;
        requireThat(
          order.status === "SHIPPED",
          409,
          "INVALID_ORDER_STATE",
          "Đơn chưa được gửi hoặc đang khiếu nại.",
        );
        await assertActiveVerified(tx, ctx, order.seller_id);
        const dedupe = `completed:${id}:${who.uid}`,
          ledger = ctx.db.collection("green_ledger").doc(sha(dedupe)),
          existing = await tx.get(ledger);
        requireThat(
          !existing.exists,
          409,
          "LEDGER_EXISTS",
          "Cần kiểm tra trạng thái sổ điểm.",
        );
        tx.update(ref, {
          status: "COMPLETED",
          completed_at: ctx.now(),
          updated_at: ctx.now(),
          _points_awarded: 10,
        });
        tx.create(ledger, {
          id: ledger.id,
          user_id: who.uid,
          order_id: id,
          content_id: null,
          points: 10,
          reason: "ORDER_COMPLETED",
          dedupe_key: dedupe,
          created_at: ctx.now(),
        });
        tx.update(ctx.db.collection("users").doc(who.uid), {
          points_balance: Number(user.points_balance ?? 0) + 10,
        });
        audit(
          tx,
          ctx,
          who,
          "COMPLETE",
          "Order",
          id,
          "Người mua xác nhận đã nhận hàng",
        );
      });
      res.json({ id, status: "COMPLETED" });
    }),
  );
}
