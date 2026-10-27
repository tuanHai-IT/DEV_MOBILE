import type { Request, Router } from "express";
import {
  FieldPath,
  type DocumentData,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import { z } from "zod";
import {
  actor,
  assertTransactionRole,
  asyncRoute,
  audit,
  docData,
  requireThat,
  sha,
  type Actor,
  type Context,
} from "./core.js";

const identifier = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid identifier");
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Use 8–15 digits, optionally prefixed with +");
const text = (max: number) => z.string().trim().min(1).max(max);
const ownProfile = z
  .object({
    display_name: text(100).optional(),
    phone: phone.nullable().optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    city: text(100).nullable().optional(),
    avatar_key: text(512).nullable().optional(),
    cover_key: text(512).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one profile field is required",
  );
const addressBody = z
  .object({
    recipient: text(100),
    phone,
    line: text(300),
    city: text(100),
    is_default: z.boolean().optional(),
  })
  .strict();
const addressPatch = addressBody
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one address field is required",
  );
const emptyBody = z.object({}).strict();

function id(value: unknown): string {
  return identifier.parse(value);
}
function param(req: Request, key: string): string {
  return id(req.params[key]);
}
function pagination(req: Request): { limit: number; cursor?: string } {
  const limit =
    req.query.limit === undefined
      ? 25
      : z.coerce.number().int().min(1).max(100).parse(req.query.limit);
  const cursor =
    req.query.cursor === undefined ? undefined : id(req.query.cursor);
  return { limit, cursor };
}

/** Document IDs provide a stable, index-friendly cursor, including rows with identical timestamps. */
async function page(
  query: Query,
  req: Request,
  project: (row: DocumentData) => DocumentData = (row) => row,
) {
  const { limit, cursor } = pagination(req);
  let ordered = query.orderBy(FieldPath.documentId());
  if (cursor) ordered = ordered.startAfter(cursor);
  const snap = await ordered.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  return {
    items: docs.map((doc) => project({ ...doc.data(), id: doc.id })),
    next_cursor: snap.size > limit ? docs.at(-1)!.id : null,
  };
}

function idempotency(
  req: Request,
  bodyValue?: string,
  required = false,
): string | undefined {
  const header = req.get("Idempotency-Key");
  if (header && bodyValue)
    requireThat(
      header === bodyValue,
      400,
      "IDEMPOTENCY_MISMATCH",
      "Idempotency keys do not match",
    );
  const value = header ?? bodyValue;
  if (required)
    requireThat(
      Boolean(value),
      400,
      "IDEMPOTENCY_REQUIRED",
      "Provide an Idempotency-Key header",
    );
  return value === undefined
    ? undefined
    : z
        .string()
        .trim()
        .min(8)
        .max(128)
        .regex(/^[A-Za-z0-9_.:-]+$/)
        .parse(value);
}

function notification(
  tx: Transaction,
  ctx: Context,
  uid: string,
  source: string,
  body: string,
  sender: string,
) {
  const ref = ctx.db
    .collection("interactions")
    .doc(sha(`notification:${source}:${uid}`));
  tx.set(ref, {
    id: ref.id,
    user_id: uid,
    type: "NOTIFICATION",
    listing_id: null,
    content_id: null,
    target_user_id: sender,
    body,
    read_at: null,
    created_at: ctx.now(),
  });
}

function meProjection(row: DocumentData): DocumentData {
  return Object.fromEntries(
    [
      "id",
      "display_name",
      "email",
      "role",
      "status",
      "phone",
      "bio",
      "city",
      "avatar_key",
      "cover_key",
      "created_at",
      "updated_at",
      "verification_status",
      "points_balance",
    ]
      .filter((key) => row[key] !== undefined)
      .map((key) => [key, row[key]]),
  );
}

async function verified(
  ctx: Context,
  uid: string,
  row: DocumentData,
): Promise<boolean> {
  if (row.status !== "ACTIVE" || typeof row._verification_id !== "string")
    return false;
  const record = await ctx.db
    .collection("verifications")
    .doc(row._verification_id)
    .get();
  const data = record.data();
  return Boolean(
    data &&
    data.user_id === uid &&
    data.status === "VERIFIED" &&
    (!data.expires_at || data.expires_at > ctx.now()),
  );
}

function participant(who: Actor, data: DocumentData) {
  requireThat(
    data.member_a_id === who.uid || data.member_b_id === who.uid,
    403,
    "FORBIDDEN",
    "Only conversation participants have access",
  );
}

export function registerCommunityRoutes(router: Router, ctx: Context): void {
  router.get(
    "/me",
    asyncRoute(async (_req, res) => {
      const who = actor(res);
      const row = res.locals.authenticated_user ?? docData(await ctx.db.collection("users").doc(who.uid).get());
      res.json({
        ...meProjection(row),
        verified: await verified(ctx, who.uid, row),
        pending_verification_id: row._pending_verification_id ?? null,
      });
    }),
  );

  router.patch(
    "/me",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const input = ownProfile.parse(req.body);
      const ref = ctx.db.collection("users").doc(who.uid);
      await ctx.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        requireThat(
          snap.exists && snap.data()!.status === "ACTIVE",
          403,
          "ACCOUNT_INACTIVE",
          "Active account required",
        );
        for (const field of ["avatar_key", "cover_key"] as const) {
          const mediaId = input[field];
          if (!mediaId) continue;
          const asset = (
            await tx.get(ctx.db.collection("media_assets").doc(id(mediaId)))
          ).data();
          requireThat(
            asset &&
              asset.uploader_id === who.uid &&
              asset.visibility === "PUBLIC" &&
              asset._status === "READY" &&
              asset._parent_type === "AVATAR" &&
              asset._parent_id === who.uid,
            400,
            field === "avatar_key" ? "INVALID_AVATAR" : "INVALID_COVER",
            "Profile image must be your own completed public image upload",
          );
          requireThat(
            typeof asset.mime_type === "string" &&
              asset.mime_type.startsWith("image/"),
            400,
            field === "avatar_key" ? "INVALID_AVATAR" : "INVALID_COVER",
            "Profile image must be an image",
          );
        }
        tx.update(ref, { ...input, updated_at: ctx.now() });
      });
      const updated = (await ref.get()).data()!;
      res.json({
        ...meProjection({ ...updated, id: ref.id }),
        verified: await verified(ctx, who.uid, updated),
        pending_verification_id: updated._pending_verification_id ?? null,
      });
    }),
  );

  router.get(
    "/users/:id",
    asyncRoute(async (req, res) => {
      const uid = param(req, "id");
      const snap = await ctx.db.collection("users").doc(uid).get();
      const row = snap.data();
      requireThat(
        row && row.status === "ACTIVE",
        404,
        "NOT_FOUND",
        "User not found",
      );
      res.json({
        id: snap.id,
        display_name: row.display_name,
        bio: row.bio ?? null,
        city: row.city ?? null,
        avatar_key: row.avatar_key ?? null,
        cover_key: row.cover_key ?? null,
        created_at: row.created_at,
        verified: await verified(ctx, uid, row),
      });
    }),
  );

  router.get(
    "/me/addresses",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      res.json(
        await page(
          ctx.db.collection("addresses").where("user_id", "==", who.uid),
          req,
        ),
      );
    }),
  );

  router.post(
    "/me/addresses",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const input = addressBody.parse(req.body);
      const userRef = ctx.db.collection("users").doc(who.uid);
      const ref = ctx.db.collection("addresses").doc();
      const result = await ctx.db.runTransaction(async (tx) => {
        const [user, existing] = await Promise.all([
          tx.get(userRef),
          tx.get(
            ctx.db
              .collection("addresses")
              .where("user_id", "==", who.uid)
              .limit(21),
          ),
        ]);
        requireThat(
          user.exists && user.data()!.status === "ACTIVE",
          403,
          "ACCOUNT_INACTIVE",
          "Active account required",
        );
        requireThat(
          existing.size < 20,
          409,
          "ADDRESS_LIMIT",
          "You may save up to 20 addresses",
        );
        const current = existing.docs.find(
          (doc) =>
            doc.data().is_default === true || doc.data().is_default === 1,
        );
        const defaultId = input.is_default || !current ? ref.id : current.id;
        const record = {
          ...input,
          id: ref.id,
          user_id: who.uid,
          is_default: defaultId === ref.id,
          created_at: ctx.now(),
        };
        for (const doc of existing.docs)
          if (Boolean(doc.data().is_default) !== (doc.id === defaultId))
            tx.update(doc.ref, { is_default: doc.id === defaultId });
        tx.create(ref, record);
        tx.update(userRef, { _default_address_id: defaultId });
        return record;
      });
      res.status(201).json(result);
    }),
  );

  router.patch(
    "/me/addresses/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        addressId = param(req, "id");
      const input = addressPatch.parse(req.body);
      const result = await ctx.db.runTransaction(async (tx) => {
        const userRef = ctx.db.collection("users").doc(who.uid);
        const [user, existing] = await Promise.all([
          tx.get(userRef),
          tx.get(
            ctx.db
              .collection("addresses")
              .where("user_id", "==", who.uid)
              .limit(21),
          ),
        ]);
        requireThat(
          user.exists && user.data()!.status === "ACTIVE",
          403,
          "ACCOUNT_INACTIVE",
          "Active account required",
        );
        requireThat(
          existing.size <= 20,
          409,
          "ADDRESS_LIMIT",
          "Address limit exceeded; contact support",
        );
        const target = existing.docs.find((doc) => doc.id === addressId);
        requireThat(target, 404, "NOT_FOUND", "Address not found");
        const current = existing.docs.find((doc) =>
          Boolean(doc.data().is_default),
        );
        let defaultId = current?.id ?? addressId;
        if (input.is_default === true) defaultId = addressId;
        if (input.is_default === false && defaultId === addressId)
          defaultId =
            existing.docs.find((doc) => doc.id !== addressId)?.id ?? addressId;
        for (const doc of existing.docs) {
          if (doc.id === addressId)
            tx.update(doc.ref, {
              ...input,
              is_default: doc.id === defaultId,
              updated_at: ctx.now(),
            });
          else if (Boolean(doc.data().is_default) !== (doc.id === defaultId))
            tx.update(doc.ref, { is_default: doc.id === defaultId });
        }
        tx.update(userRef, { _default_address_id: defaultId });
        return {
          ...target.data(),
          ...input,
          id: addressId,
          is_default: addressId === defaultId,
        };
      });
      res.json(result);
    }),
  );

  router.delete(
    "/me/addresses/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        addressId = param(req, "id");
      await ctx.db.runTransaction(async (tx) => {
        const userRef = ctx.db.collection("users").doc(who.uid);
        const [user, existing] = await Promise.all([
          tx.get(userRef),
          tx.get(
            ctx.db
              .collection("addresses")
              .where("user_id", "==", who.uid)
              .limit(21),
          ),
        ]);
        requireThat(
          user.exists && user.data()!.status === "ACTIVE",
          403,
          "ACCOUNT_INACTIVE",
          "Active account required",
        );
        requireThat(
          existing.size <= 20,
          409,
          "ADDRESS_LIMIT",
          "Address limit exceeded; contact support",
        );
        const target = existing.docs.find((doc) => doc.id === addressId);
        requireThat(target, 404, "NOT_FOUND", "Address not found");
        const remaining = existing.docs.filter((doc) => doc.id !== addressId);
        const defaultId =
          remaining.find((doc) => Boolean(doc.data().is_default))?.id ??
          remaining[0]?.id ??
          null;
        for (const doc of remaining)
          if (Boolean(doc.data().is_default) !== (doc.id === defaultId))
            tx.update(doc.ref, { is_default: doc.id === defaultId });
        tx.delete(target.ref);
        tx.update(userRef, { _default_address_id: defaultId });
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/me/verifications",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      res.json(
        await page(
          ctx.db.collection("verifications").where("user_id", "==", who.uid),
          req,
        ),
      );
    }),
  );

  router.post(
    "/me/verifications",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      emptyBody.parse(req.body ?? {});
      const ref = ctx.db.collection("verifications").doc();
      const result = await ctx.db.runTransaction(async (tx) => {
        const userRef = ctx.db.collection("users").doc(who.uid);
        const snap = await tx.get(userRef);
        const user = snap.data();
        requireThat(
          user && user.status === "ACTIVE",
          403,
          "ACCOUNT_INACTIVE",
          "Active account required",
        );
        if (user._pending_verification_id) {
          const pending = await tx.get(
            ctx.db
              .collection("verifications")
              .doc(user._pending_verification_id),
          );
          requireThat(
            !pending.exists || pending.data()!.status !== "PENDING",
            409,
            "VERIFICATION_PENDING",
            "A verification is already awaiting review",
          );
        }
        const record = {
          id: ref.id,
          user_id: who.uid,
          status: "PENDING",
          submitted_at: ctx.now(),
          reviewer_id: null,
          reviewed_at: null,
          expires_at: null,
          reason: null,
        };
        tx.create(ref, record);
        tx.update(userRef, {
          _pending_verification_id: ref.id,
          ...(!user._verification_id ? { verification_status: "PENDING" } : {}),
        });
        return record;
      });
      res.status(201).json(result);
    }),
  );

  router.get(
    "/admin/verifications",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      let query: Query = ctx.db.collection("verifications");
      if (req.query.status !== undefined)
        query = query.where(
          "status",
          "==",
          z
            .enum(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"])
            .parse(req.query.status),
        );
      res.json(await page(query, req));
    }),
  );

  router.post(
    "/admin/verifications/:id/review",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        verificationId = param(req, "id");
      const input = z
        .object({
          status: z.enum(["VERIFIED", "REJECTED"]),
          reason: text(2000),
          expires_at: z.string().datetime({ offset: true }).optional(),
        })
        .strict()
        .parse(req.body);
      const expires =
        input.status === "VERIFIED"
          ? new Date(
              input.expires_at ??
                Date.parse(ctx.now()) + 365 * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null;
      if (expires)
        requireThat(
          expires > ctx.now(),
          400,
          "INVALID_EXPIRY",
          "Verification expiry must be in the future",
        );
      const ref = ctx.db.collection("verifications").doc(verificationId);
      const result = await ctx.db.runTransaction(async (tx) => {
        const reviewer = await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const snap = await tx.get(ref),
          row = snap.data();
        requireThat(row, 404, "NOT_FOUND", "Verification not found");
        requireThat(
          reviewer.role === "ADMIN" || row.user_id !== who.uid,
          403,
          "SELF_REVIEW",
          "You cannot review your own verification",
        );
        requireThat(
          row.status === "PENDING",
          409,
          "INVALID_STATE",
          "Only pending verifications may be reviewed",
        );
        const userRef = ctx.db.collection("users").doc(row.user_id);
        const user = (await tx.get(userRef)).data();
        requireThat(
          user && user.status === "ACTIVE",
          409,
          "ACCOUNT_INACTIVE",
          "Cannot verify an inactive account",
        );
        requireThat(
          user._pending_verification_id === verificationId,
          409,
          "STALE_VERIFICATION",
          "This is not the current pending verification",
        );
        if (input.status === "VERIFIED") {
          const assets = await tx.get(
            ctx.db
              .collection("media_assets")
              .where("verification_id", "==", verificationId)
              .where("_status", "==", "READY")
              .limit(1),
          );
          const asset = assets.docs[0]?.data();
          requireThat(
            asset &&
              asset.uploader_id === row.user_id &&
              asset.visibility === "PRIVATE",
            409,
            "EVIDENCE_REQUIRED",
            "A completed private verification document is required",
          );
        }
        const update = {
          status: input.status,
          reason: input.reason,
          reviewer_id: who.uid,
          reviewed_at: ctx.now(),
          expires_at: expires,
        };
        tx.update(ref, update);
        tx.update(userRef, {
          _pending_verification_id: null,
          ...(input.status === "VERIFIED"
            ? {
                _verification_id: verificationId,
                verification_status: "VERIFIED",
              }
            : !user._verification_id
              ? { verification_status: "REJECTED" }
              : {}),
        });
        notification(
          tx,
          ctx,
          row.user_id,
          `verification:${verificationId}`,
          `Verification ${input.status.toLowerCase()}: ${input.reason}`,
          who.uid,
        );
        audit(
          tx,
          ctx,
          who,
          `VERIFICATION_${input.status}`,
          "Verification",
          verificationId,
          input.reason,
        );
        return { ...row, ...update, id: verificationId };
      });
      res.json(result);
    }),
  );

  router.get(
    "/conversations",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const result = await page(
          ctx.db
            .collection("conversations")
            .where("_member_ids", "array-contains", who.uid),
          req,
        );
      const visible = result.items.filter(row => !["PENDING", "DECLINED"].includes(row.status));
      const partnerIds = [...new Set(visible.map(row => row.member_a_id === who.uid
        ? row.member_b_id : row.member_a_id).filter((id): id is string => typeof id === "string" && !!id))];
      const partners = partnerIds.length
        ? await ctx.db.getAll(...partnerIds.map(id => ctx.db.collection("users").doc(id))) : [];
      const byId = new Map(partners.map(doc => [doc.id, doc.data()]));
      res.json({...result, items: visible.map(row => {
        const partnerId = row.member_a_id === who.uid ? row.member_b_id : row.member_a_id;
        const partner = byId.get(partnerId);
        const active = partner?.status === "ACTIVE";
        return {...row, partner: {id: partnerId,
          display_name: active ? partner?.display_name || "Thành viên EcoShare" : "Thành viên EcoShare",
          avatar_key: active ? partner?.avatar_key ?? null : null}};
      })});
    }),
  );

  router.post(
    "/conversations",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const input = z
        .object({ member_id: identifier, order_id: identifier.optional() })
        .strict()
        .parse(req.body);
      requireThat(
        input.member_id !== who.uid,
        400,
        "INVALID_RECIPIENT",
        "Choose another user",
      );
      const members = [who.uid, input.member_id].sort();
      const relationshipRef = ctx.db.collection("interactions").doc(sha(`friend:${members.join(":")}`));
      const ref = ctx.db
        .collection("conversations")
        .doc(sha(JSON.stringify([members, input.order_id ?? null])));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const [other, existing, relationship] = await Promise.all([
          tx.get(ctx.db.collection("users").doc(input.member_id)),
          tx.get(ref),
          tx.get(relationshipRef),
        ]);
        requireThat(
          other.exists && other.data()!.status === "ACTIVE",
          404,
          "NOT_FOUND",
          "Recipient not found",
        );
        if (input.order_id) {
          const order = (
            await tx.get(ctx.db.collection("orders").doc(input.order_id))
          ).data();
          requireThat(
            order &&
              members.includes(order.buyer_id) &&
              members.includes(order.seller_id) &&
              order.buyer_id !== order.seller_id,
            403,
            "ORDER_PARTICIPANTS_REQUIRED",
            "Conversation must contain the buyer and seller of this order",
          );
        }
        if (existing.exists) {
          const current = existing.data()!;
          participant(who, current);
          requireThat(current.status !== "DECLINED" || input.order_id || relationship.data()?.status === "ACCEPTED",
            409, "MESSAGE_REQUEST_DECLINED", "NgÆ°á»i nháº­n Ä‘Ã£ tá»« chá»‘i tin nháº¯n nÃ y.");
          if (current.status !== "ACCEPTED" && (input.order_id || relationship.data()?.status === "ACCEPTED")) {
            const acceptedAt = ctx.now();
            tx.update(ref, {status: "ACCEPTED", request_sender_id: null, request_recipient_id: null,
              accepted_at: acceptedAt, updated_at: acceptedAt});
            return {row: {...current, id: ref.id, status: "ACCEPTED", request_sender_id: null,
              request_recipient_id: null, accepted_at: acceptedAt, updated_at: acceptedAt}, created: false};
          }
          return { row: { ...current, id: ref.id }, created: false };
        }
        const row = {
          id: ref.id,
          member_a_id: members[0],
          member_b_id: members[1],
          _member_ids: members,
          order_id: input.order_id ?? null,
          status: input.order_id || relationship.data()?.status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
          request_sender_id: input.order_id || relationship.data()?.status === "ACCEPTED" ? null : who.uid,
          request_recipient_id: input.order_id || relationship.data()?.status === "ACCEPTED" ? null : input.member_id,
          accepted_at: input.order_id || relationship.data()?.status === "ACCEPTED" ? ctx.now() : null,
          created_at: ctx.now(),
        };
        tx.create(ref, row);
        return { row, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.row);
    }),
  );

  router.get("/message-requests", asyncRoute(async (req, res) => {
    const who = actor(res);
    const result = await page(ctx.db.collection("conversations")
      .where("request_recipient_id", "==", who.uid).where("status", "==", "PENDING"), req);
    const senderIds = [...new Set(result.items.map(row => row.request_sender_id).filter((id): id is string => typeof id === "string"))];
    const users = senderIds.length ? await ctx.db.getAll(...senderIds.map(id => ctx.db.collection("users").doc(id))) : [];
    const byId = new Map(users.map(doc => [doc.id, doc.data()]));
    res.json({...result, items: result.items.map(row => ({...row, sender: {id: row.request_sender_id,
      display_name: byId.get(row.request_sender_id)?.display_name ?? "Thành viên EcoShare",
      avatar_key: byId.get(row.request_sender_id)?.avatar_key ?? null}}))});
  }));
  router.post("/message-requests/:id/respond", asyncRoute(async (req, res) => {
    const who = actor(res), input = z.object({accept: z.boolean()}).strict().parse(req.body);
    const ref = ctx.db.collection("conversations").doc(id(req.params.id));
    const row = await ctx.db.runTransaction(async tx => {
      await assertTransactionRole(tx, ctx, who, ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"]);
      const current = docData(await tx.get(ref));
      requireThat(current.status === "PENDING" && current.request_recipient_id === who.uid,
        403, "MESSAGE_REQUEST_FORBIDDEN", "Chỉ người nhận mới được xử lý tin nhắn chờ.");
      const status = input.accept ? "ACCEPTED" : "DECLINED";
      tx.update(ref, {status, accepted_at: input.accept ? ctx.now() : null, updated_at: ctx.now()});
      return {...current, status, accepted_at: input.accept ? ctx.now() : null};
    });
    res.json(row);
  }));

  router.get(
    "/conversations/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res), conversationId = param(req, "id");
      const snapshot = await ctx.db.collection("conversations").doc(conversationId).get();
      const conversation = snapshot.data();
      requireThat(conversation, 404, "NOT_FOUND", "Conversation not found");
      participant(who, conversation);
      requireThat(conversation.status !== "DECLINED", 403, "MESSAGE_REQUEST_DECLINED", "Tin nháº¯n nÃ y Ä‘Ã£ bá»‹ tá»« chá»‘i.");
      requireThat(conversation.status !== "PENDING" || conversation.request_sender_id === who.uid,
        403, "MESSAGE_REQUEST_PENDING", "Hãy chấp nhận tin nhắn chờ trước khi mở cuộc trò chuyện.");
      res.json({ ...conversation, id: snapshot.id });
    }),
  );

  router.get(
    "/conversations/:id/messages",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        conversationId = param(req, "id");
      const conversation = (
        await ctx.db.collection("conversations").doc(conversationId).get()
      ).data();
      requireThat(conversation, 404, "NOT_FOUND", "Conversation not found");
      participant(who, conversation);
      requireThat(conversation.status !== "DECLINED", 403, "MESSAGE_REQUEST_DECLINED", "Tin nháº¯n nÃ y Ä‘Ã£ bá»‹ tá»« chá»‘i.");
      requireThat(conversation.status !== "PENDING" || conversation.request_sender_id === who.uid,
        403, "MESSAGE_REQUEST_PENDING", "Người nhận cần chấp nhận tin nhắn trước khi trò chuyện.");
      // Messages use a timestamp + document ID cursor to preserve chat order.
      const { limit } = pagination(req);
      requireThat(req.query.newest === undefined || req.query.newest === "1",
        400, "INVALID_ORDER", "newest must be 1 when provided");
      const newest = req.query.newest === "1";
      let query: Query = ctx.db
        .collection("messages")
        .where("conversation_id", "==", conversationId)
        .orderBy("sent_at", newest ? "desc" : "asc")
        .orderBy(FieldPath.documentId(), newest ? "desc" : "asc");
      if (req.query.cursor !== undefined) {
        const cursor = await ctx.db
          .collection("messages")
          .doc(id(req.query.cursor))
          .get();
        requireThat(
          cursor.exists && cursor.data()!.conversation_id === conversationId,
          400,
          "INVALID_CURSOR",
          "Cursor must belong to this conversation",
        );
        query = query.startAfter(cursor);
      }
      const snap = await query.limit(limit + 1).get(),
        docs = snap.docs.slice(0, limit);
      res.json({
        items: docs.map((doc) => ({ ...doc.data(), id: doc.id })),
        next_cursor: snap.size > limit ? docs.at(-1)!.id : null,
      });
    }),
  );

  router.post(
    "/conversations/:id/messages",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        conversationId = param(req, "id");
      const input = z
        .object({
          text: text(2000).optional(),
          body: text(2000).optional(),
          content_id: identifier.optional(),
          idempotency_key: z.string().optional(),
        })
        .strict()
        .refine(
          (value) => [value.text, value.body, value.content_id].filter(Boolean).length === 1,
          "Provide text, body or a shared post, exactly one",
        )
        .parse(req.body);
      const key = idempotency(req, input.idempotency_key, true)!;
      const ref = ctx.db
        .collection("messages")
        .doc(sha(JSON.stringify([who.uid, conversationId, key])));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const conversationRef = ctx.db
          .collection("conversations")
          .doc(conversationId);
        const [conversationSnap, existing] = await Promise.all([
          tx.get(conversationRef),
          tx.get(ref),
        ]);
        const conversation = conversationSnap.data();
        requireThat(conversation, 404, "NOT_FOUND", "Conversation not found");
        participant(who, conversation);
        requireThat(conversation.status !== "DECLINED", 403, "MESSAGE_REQUEST_DECLINED", "Tin nháº¯n nÃ y Ä‘Ã£ bá»‹ tá»« chá»‘i.");
        if (existing.exists) {
          requireThat(
            input.content_id
              ? existing.data()!.content_id === input.content_id
              : existing.data()!.body === (input.text ?? input.body),
            409,
            "IDEMPOTENCY_CONFLICT",
            "This key was used with a different message",
          );
          return { row: { ...existing.data(), id: ref.id }, created: false };
        }
        const recipient =
          conversation.member_a_id === who.uid
            ? conversation.member_b_id
            : conversation.member_a_id;
        const recipientData = (
          await tx.get(ctx.db.collection("users").doc(recipient))
        ).data();
        requireThat(
          recipientData && recipientData.status === "ACTIVE",
          409,
          "RECIPIENT_INACTIVE",
          "Recipient is currently unavailable",
        );
        let sharedContent: DocumentData | undefined;
        if (input.content_id) {
          const members = [who.uid, recipient].sort();
          const [friendSnap, contentSnap] = await Promise.all([
            tx.get(ctx.db.collection("interactions").doc(sha(`friend:${members.join(":")}`))),
            tx.get(ctx.db.collection("content_entries").doc(input.content_id)),
          ]);
          requireThat(
            friendSnap.data()?.status === "ACCEPTED",
            403,
            "FRIENDS_ONLY",
            "Only friends can receive shared posts",
          );
          sharedContent = contentSnap.data();
          requireThat(
            sharedContent && sharedContent.status === "PUBLISHED" &&
              ["POST", "TIP"].includes(sharedContent.kind),
            404,
            "POST_NOT_FOUND",
            "Published post not found",
          );
        }
        const preview = sharedContent
          ? String(sharedContent.title || sharedContent.body || "Bài viết")
              .replace(/\s+/g, " ").trim().slice(0, 160)
          : "";
        const body = sharedContent
          ? `Đã chia sẻ ${sharedContent.kind === "TIP" ? "mẹo hay" : "bài viết"}: ${preview}`
          : input.text ?? input.body!;
        const row = {
          id: ref.id,
          conversation_id: conversationId,
          sender_id: who.uid,
          body,
          content_id: input.content_id ?? null,
          content_kind: sharedContent?.kind ?? null,
          sent_at: ctx.now(),
          read_at: null,
          _member_ids: [
            conversation.member_a_id,
            conversation.member_b_id,
          ].sort(),
          _idempotency_key: key,
        };
        tx.create(ref, row);
        tx.update(conversationRef, {
          ...(sharedContent ? {status: "ACCEPTED", request_sender_id: null,
            request_recipient_id: null, accepted_at: conversation.accepted_at ?? row.sent_at} : {}),
          updated_at: row.sent_at,
          last_message: body.slice(0, 200),
          last_sender_id: who.uid,
        });
        return { row, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.row);
    }),
  );

  router.get(
    "/me/points",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const [user, ledger] = await Promise.all([
        res.locals.authenticated_user
          ? Promise.resolve(res.locals.authenticated_user)
          : ctx.db.collection("users").doc(who.uid).get().then(docData),
        page(
          ctx.db.collection("green_ledger").where("user_id", "==", who.uid),
          req,
        ),
      ]);
      res.json({ balance: user.points_balance ?? 0, ...ledger });
    }),
  );

  router.get(
    "/me/interactions",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      let query: Query = ctx.db
        .collection("interactions")
        .where("user_id", "==", who.uid);
      if (req.query.type !== undefined)
        query = query.where(
          "type",
          "==",
          z
            .enum(["LIKE", "SAVE", "COMMENT", "FOLLOW", "JOIN", "REGISTER"])
            .parse(req.query.type),
        );
      res.json(await page(query, req));
    }),
  );

  router.post(
    "/interactions",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const input = z
        .object({
          type: z.enum([
            "LIKE",
            "SAVE",
            "COMMENT",
            "FOLLOW",
            "JOIN",
            "REGISTER",
          ]),
          listing_id: identifier.optional(),
          content_id: identifier.optional(),
          target_user_id: identifier.optional(),
          body: text(2000).optional(),
          idempotency_key: z.string().optional(),
        })
        .strict()
        .parse(req.body);
      const targets = [
        input.listing_id,
        input.content_id,
        input.target_user_id,
      ].filter(Boolean);
      requireThat(
        targets.length === 1,
        400,
        "INVALID_TARGET",
        "Choose exactly one interaction target",
      );
      if (input.type === "FOLLOW")
        requireThat(
          Boolean(input.target_user_id) && input.target_user_id !== who.uid,
          400,
          "INVALID_TARGET",
          "Follow another user",
        );
      else
        requireThat(
          !input.target_user_id,
          400,
          "INVALID_TARGET",
          "This interaction requires a listing or content",
        );
      if (["JOIN", "REGISTER"].includes(input.type))
        requireThat(
          Boolean(input.content_id),
          400,
          "INVALID_TARGET",
          "Joining and registration require content",
        );
      if (input.type === "COMMENT")
        requireThat(
          Boolean(input.body),
          400,
          "BODY_REQUIRED",
          "Comment text is required",
        );
      else
        requireThat(
          input.body === undefined,
          400,
          "INVALID_BODY",
          "Only comments accept body text",
        );
      const key = idempotency(req, input.idempotency_key);
      const targetKind = input.listing_id
        ? "listing"
        : input.content_id
          ? "content"
          : "user";
      const unique = input.type === "COMMENT" ? (key ?? sha(input.body!)) : "";
      const ref = ctx.db
        .collection("interactions")
        .doc(
          sha(
            JSON.stringify([
              who.uid,
              input.type,
              targetKind,
              targets[0],
              unique,
            ]),
          ),
        );
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const collection = input.listing_id
          ? "listings"
          : input.content_id
            ? "content_entries"
            : "users";
        const [targetSnap, existing] = await Promise.all([
          tx.get(ctx.db.collection(collection).doc(targets[0]!)),
          tx.get(ref),
        ]);
        const target = targetSnap.data();
        requireThat(target, 404, "NOT_FOUND", "Interaction target not found");
        if (collection === "users")
          requireThat(
            target.status === "ACTIVE",
            404,
            "NOT_FOUND",
            "User not found",
          );
        if (collection === "listings")
          requireThat(
            ["APPROVED", "SOLD"].includes(target.status),
            404,
            "NOT_FOUND",
            "Listing is unavailable",
          );
        if (collection === "content_entries") {
          requireThat(!["POST","TIP","SCAN"].includes(target.kind),400,"USE_SOCIAL_API","Use post and tip endpoints for social interactions.");
          requireThat(
            target.status === "PUBLISHED",
            404,
            "NOT_FOUND",
            "Content is unavailable",
          );
          if (input.type === "JOIN")
            requireThat(
              target.kind === "GROUP",
              400,
              "INVALID_TARGET",
              "JOIN requires a group",
            );
          if (input.type === "REGISTER") {
            requireThat(
              ["EVENT", "CHALLENGE"].includes(target.kind),
              400,
              "INVALID_TARGET",
              "REGISTER requires an event or challenge",
            );
            requireThat(
              !target.ends_at || target.ends_at > ctx.now(),
              409,
              "CONTENT_ENDED",
              "Registration has closed",
            );
            let metadata: Record<string, unknown> = {};
            try {
              metadata = JSON.parse(target.metadata_json ?? "{}");
            } catch {
              /* Legacy content may have no metadata. */
            }
            requireThat(
              typeof metadata.registration_closes_at !== "string" ||
                metadata.registration_closes_at > ctx.now(),
              409,
              "REGISTRATION_CLOSED",
              "Registration has closed",
            );
          }
        }
        if (existing.exists) {
          requireThat(
            (existing.data()!.body ?? null) === (input.body ?? null),
            409,
            "IDEMPOTENCY_CONFLICT",
            "This key was used for a different comment",
          );
          return { row: { ...existing.data(), id: ref.id }, created: false };
        }
        const row = {
          id: ref.id,
          user_id: who.uid,
          type: input.type,
          listing_id: input.listing_id ?? null,
          content_id: input.content_id ?? null,
          target_user_id: input.target_user_id ?? null,
          body: input.body ?? null,
          read_at: null,
          created_at: ctx.now(),
        };
        tx.create(ref, row);
        return { row, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.row);
    }),
  );

  router.delete(
    "/interactions/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        interactionId = param(req, "id");
      const ref = ctx.db.collection("interactions").doc(interactionId);
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const row = (await tx.get(ref)).data();
        requireThat(
          row &&
            row.user_id === who.uid &&
            ["LIKE", "SAVE", "COMMENT", "FOLLOW", "JOIN", "REGISTER"].includes(
              row.type,
            ),
          404,
          "NOT_FOUND",
          "Interaction not found",
        );
        if(row.content_id){
          const parent=(await tx.get(ctx.db.collection("content_entries").doc(row.content_id))).data();
          requireThat(!parent || !["POST","TIP","SCAN"].includes(parent.kind),400,"USE_SOCIAL_API","Use the post or tip reaction endpoint to update social counters.");
        }
        tx.delete(ref);
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/me/notifications",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      res.json(
        await page(
          ctx.db
            .collection("interactions")
            .where("user_id", "==", who.uid)
            .where("type", "==", "NOTIFICATION"),
          req,
        ),
      );
    }),
  );

  router.patch(
    "/me/notifications/:id/read",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        notificationId = param(req, "id");
      emptyBody.parse(req.body ?? {});
      const ref = ctx.db.collection("interactions").doc(notificationId);
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const row = (await tx.get(ref)).data();
        requireThat(
          row && row.user_id === who.uid && row.type === "NOTIFICATION",
          404,
          "NOT_FOUND",
          "Notification not found",
        );
        const readAt = row.read_at ?? ctx.now();
        tx.update(ref, { read_at: readAt });
        return { ...row, id: ref.id, read_at: readAt };
      });
      res.json(result);
    }),
  );

  router.post(
    "/reports",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      const input = z
        .object({
          listing_id: identifier.optional(),
          content_id: identifier.optional(),
          target_user_id: identifier.optional(),
          order_id: identifier.optional(),
          reason: text(2000),
        })
        .strict()
        .parse(req.body);
      const targets = [
        input.listing_id,
        input.content_id,
        input.target_user_id,
        input.order_id,
      ].filter(Boolean);
      requireThat(
        targets.length === 1,
        400,
        "INVALID_TARGET",
        "Choose exactly one listing, user or order",
      );
      requireThat(
        input.target_user_id !== who.uid,
        400,
        "SELF_REPORT",
        "You cannot report yourself",
      );
      const kind = input.order_id
        ? "order"
        : input.listing_id
          ? "listing"
          : input.content_id
            ? "content"
            : "user";
      const ref = ctx.db
        .collection("reports")
        .doc(sha(JSON.stringify([who.uid, kind, targets[0]])));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const targetRef = ctx.db
          .collection(
            kind === "order"
              ? "orders"
              : kind === "listing"
                ? "listings"
                : kind === "content"
                  ? "content_entries"
                  : "users",
          )
          .doc(targets[0]!);
        const [targetSnap, existing] = await Promise.all([
          tx.get(targetRef),
          tx.get(ref),
        ]);
        const target = targetSnap.data();
        requireThat(target, 404, "NOT_FOUND", "Report target not found");
        if (kind === "order") {
          requireThat(
            target.buyer_id === who.uid || target.seller_id === who.uid,
            403,
            "FORBIDDEN",
            "Only order participants can report an order",
          );
          if (!existing.exists)
            requireThat(
              ["PAID", "SHIPPED", "COMPLETED", "DISPUTED"].includes(
                target.status,
              ),
              409,
              "INVALID_ORDER_STATE",
              "Only a paid, shipped or completed order can be disputed",
            );
        }
        if (kind === "listing")
          requireThat(
            ["APPROVED", "SOLD"].includes(target.status),
            404,
            "NOT_FOUND",
            "Listing is unavailable",
          );
        if (kind === "user")
          requireThat(
            target.status === "ACTIVE",
            404,
            "NOT_FOUND",
            "User not found",
          );
        if (kind === "content") {
          requireThat(
            ["POST", "TIP"].includes(target.kind) && target.status === "PUBLISHED",
            404,
            "NOT_FOUND",
            "Published post not found",
          );
          requireThat(target.author_id !== who.uid, 400, "SELF_REPORT", "You cannot report your own post");
        }
        if (existing.exists) {
          requireThat(
            existing.data()!.reason === input.reason,
            409,
            "REPORT_EXISTS",
            "You have already reported this target",
          );
          return { row: { ...existing.data(), id: ref.id }, created: false };
        }
        const row = {
          id: ref.id,
          reporter_id: who.uid,
          listing_id: input.listing_id ?? null,
          content_id: input.content_id ?? null,
          target_user_id: input.target_user_id ?? null,
          order_id: input.order_id ?? null,
          reason: input.reason,
          status: "OPEN",
          resolver_id: null,
          resolution: null,
          created_at: ctx.now(),
          ...(kind === "order" ? { _order_status_before: target.status } : {}),
        };
        tx.create(ref, row);
        if (kind === "order" && target.status !== "DISPUTED")
          tx.update(targetRef, { status: "DISPUTED", updated_at: ctx.now() });
        return { row, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.row);
    }),
  );

  router.get(
    "/me/reports",
    asyncRoute(async (req, res) => {
      const who = actor(res);
      res.json(
        await page(
          ctx.db.collection("reports").where("reporter_id", "==", who.uid),
          req,
        ),
      );
    }),
  );

  router.get(
    "/admin/reports",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]);
      let query: Query = ctx.db.collection("reports");
      if (who.role === "MODERATOR") query = query.where("order_id", "==", null);
      if (req.query.status !== undefined)
        query = query.where(
          "status",
          "==",
          z
            .enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"])
            .parse(req.query.status),
        );
      res.json(await page(query, req));
    }),
  );

  router.post(
    "/admin/reports/:id/resolve",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]),
        reportId = param(req, "id");
      const input = z
        .object({
          status: z.enum(["RESOLVED", "DISMISSED"]).default("RESOLVED"),
          reason: text(2000),
        })
        .strict()
        .parse(req.body);
      const ref = ctx.db.collection("reports").doc(reportId);
      const result = await ctx.db.runTransaction(async (tx) => {
        const reviewer = await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        const row = (await tx.get(ref)).data();
        requireThat(row, 404, "NOT_FOUND", "Report not found");
        requireThat(
          !row.order_id || reviewer.role === "ADMIN",
          403,
          "ADMIN_REQUIRED",
          "Only administrators resolve transaction disputes",
        );
        requireThat(
          reviewer.role === "ADMIN" ||
            (row.reporter_id !== who.uid && row.target_user_id !== who.uid),
          403,
          "SELF_REVIEW",
          "You cannot resolve a report involving yourself",
        );
        requireThat(
          ["OPEN", "IN_REVIEW"].includes(row.status),
          409,
          "INVALID_STATE",
          "Report is already closed",
        );
        if (row.order_id) {
          const order = (
            await tx.get(ctx.db.collection("orders").doc(row.order_id))
          ).data();
          requireThat(order, 404, "NOT_FOUND", "Order not found");
          requireThat(
            reviewer.role === "ADMIN" ||
              (order && order.buyer_id !== who.uid && order.seller_id !== who.uid),
            403,
            "SELF_REVIEW",
            "You cannot resolve a dispute involving yourself",
          );
        }
        if (row.listing_id) {
          const listing = (
            await tx.get(ctx.db.collection("listings").doc(row.listing_id))
          ).data();
          requireThat(listing, 404, "NOT_FOUND", "Listing not found");
          requireThat(
            reviewer.role === "ADMIN" || (listing && listing.seller_id !== who.uid),
            403,
            "SELF_REVIEW",
            "You cannot resolve a report about your listing",
          );
        }
        if (row.content_id) {
          const content = (
            await tx.get(ctx.db.collection("content_entries").doc(row.content_id))
          ).data();
          requireThat(content, 404, "NOT_FOUND", "Reported post not found");
          requireThat(
            reviewer.role === "ADMIN" || content.author_id !== who.uid,
            403,
            "SELF_REVIEW",
            "You cannot resolve a report about your post",
          );
        }
        const update = {
          status: input.status,
          resolver_id: who.uid,
          resolution: input.reason,
          resolved_at: ctx.now(),
        };
        tx.update(ref, update);
        notification(
          tx,
          ctx,
          row.reporter_id,
          `report:${reportId}`,
          `Report ${input.status.toLowerCase()}: ${input.reason}`,
          who.uid,
        );
        audit(
          tx,
          ctx,
          who,
          `REPORT_${input.status}`,
          "Report",
          reportId,
          input.reason,
        );
        return { ...row, ...update, id: ref.id };
      });
      res.json(result);
    }),
  );

  router.post(
    "/orders/:id/reviews",
    asyncRoute(async (req, res) => {
      const who = actor(res),
        orderId = param(req, "id");
      const input = z
        .object({
          rating: z.number().int().min(1).max(5),
          body: z.string().trim().max(2000),
        })
        .strict()
        .parse(req.body);
      const ref = ctx.db
        .collection("reviews")
        .doc(sha(JSON.stringify([orderId, who.uid])));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, [
          "MEMBER",
          "COLLECTOR",
          "MODERATOR",
          "ADMIN",
        ]);
        const [orderSnap, existing] = await Promise.all([
          tx.get(ctx.db.collection("orders").doc(orderId)),
          tx.get(ref),
        ]);
        const order = orderSnap.data();
        requireThat(order, 404, "NOT_FOUND", "Order not found");
        requireThat(
          order.buyer_id === who.uid || order.seller_id === who.uid,
          403,
          "FORBIDDEN",
          "Only order participants can review",
        );
        requireThat(
          order.status === "COMPLETED",
          409,
          "INVALID_STATE",
          "Only completed orders can be reviewed",
        );
        if (existing.exists) {
          requireThat(
            existing.data()!.body === input.body &&
              existing.data()!.rating === input.rating,
            409,
            "REVIEW_EXISTS",
            "You have already reviewed this order",
          );
          return { row: { ...existing.data(), id: ref.id }, created: false };
        }
        const row = {
          id: ref.id,
          order_id: orderId,
          author_id: who.uid,
          target_user_id:
            order.buyer_id === who.uid ? order.seller_id : order.buyer_id,
          rating: input.rating,
          body: input.body,
          created_at: ctx.now(),
        };
        tx.create(ref, row);
        return { row, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.row);
    }),
  );

  router.get(
    "/users/:id/reviews",
    asyncRoute(async (req, res) => {
      const uid = param(req, "id");
      const user = (await ctx.db.collection("users").doc(uid).get()).data();
      requireThat(
        user && user.status === "ACTIVE",
        404,
        "NOT_FOUND",
        "User not found",
      );
      res.json(
        await page(
          ctx.db.collection("reviews").where("target_user_id", "==", uid),
          req,
          (row) => ({
            id: row.id,
            author_id: row.author_id,
            target_user_id: row.target_user_id,
            rating: row.rating,
            body: row.body,
            created_at: row.created_at,
          }),
        ),
      );
    }),
  );
}
