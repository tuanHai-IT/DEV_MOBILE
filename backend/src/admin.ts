/**
 * Route quản trị: danh mục, điểm thu gom, nội dung và cấu hình hệ thống.
 * Chú thích chỉ để đọc code; request, quyền và dữ liệu ghi xuống không đổi.
 */
import type { Request, Router } from "express";
import {
  AggregateField,
  type DocumentData,
  type Query,
} from "firebase-admin/firestore";
import { z } from "zod";
import {
  actor,
  assertTransactionRole,
  asyncRoute,
  audit,
  docData,
  idempotency,
  idSchema,
  page,
  pathId,
  reasonSchema,
  requireThat,
  sha,
  type Context,
} from "./core.js";

const roles = ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"] as const;
const short = (max: number) => z.string().trim().min(1).max(max);
const reason = { reason: reasonSchema };
const categorySchema = z
  .object({
    name: short(100),
    description: z.string().trim().max(2000).nullable().default(null),
    active: z.boolean().default(true),
  })
  .strict();
const pointSchema = z
  .object({
    manager_id: idSchema.nullable().default(null),
    name: short(150),
    address: short(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    materials: short(1000),
    opening_hours: short(300),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  })
  .strict();
const contentSchema = z
  .object({
    parent_id: idSchema.nullable().default(null),
    kind: z.enum(["ARTICLE", "GROUP", "EVENT", "CHALLENGE", "REWARD", "BADGE"]),
    title: short(200),
    body: z.string().trim().max(20000),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    starts_at: z.string().datetime({ offset: true }).nullable().default(null),
    ends_at: z.string().datetime({ offset: true }).nullable().default(null),
    points_cost: z.number().int().min(0).max(1_000_000).default(0),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const metadataSchemas = {
  ARTICLE: z
    .object({
      reading_minutes: z.number().int().min(1).max(120).optional(),
      source_url: z
        .string()
        .url()
        .regex(/^https:\/\//)
        .max(1000)
        .optional(),
    })
    .strict(),
  GROUP: z
    .object({
      rules: z.string().max(4000).optional(),
      city: short(100).optional(),
    })
    .strict(),
  EVENT: z
    .object({
      location: short(500).optional(),
      capacity: z.number().int().min(1).max(100000).optional(),
      registration_closes_at: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
  CHALLENGE: z
    .object({
      target: z.number().int().min(1).max(1_000_000).optional(),
      unit: short(50).optional(),
      reward_points: z.number().int().min(0).max(5000).optional(),
      requirement_type: z.enum([
        "SELF_ATTESTED",
        "VERIFIED_ACCOUNT",
        "LIKE_AND_COMMENT",
        "POST_WITH_LIKE",
      ]).optional(),
    })
    .strict(),
  REWARD: z
    .object({
      stock: z.number().int().min(0).max(1_000_000).default(0),
      description: z.string().max(2000).optional(),
    })
    .strict(),
  BADGE: z.object({ criteria: z.string().max(2000).optional() }).strict(),
};
const settingSchemas = {
  app: z
    .object({ name: short(100), description: z.string().max(1000).default("") })
    .strict(),
  moderation: z
    .object({
      community_guidelines: short(10000),
      reporting_help: z.string().max(2000).default(""),
    })
    .strict(),
  contact: z
    .object({
      support_email: z.string().email().max(254),
      support_phone: z
        .string()
        .regex(/^\+?[0-9]{8,15}$/)
        .optional(),
      website: z
        .string()
        .url()
        .regex(/^https:\/\//)
        .max(1000)
        .optional(),
    })
    .strict(),
  maintenance: z
    .object({ enabled: z.boolean(), message: z.string().max(1000) })
    .strict(),
};
type SettingKey = keyof typeof settingSchemas;
const settingKeys = Object.keys(settingSchemas) as SettingKey[];

// Đọc id trên đường dẫn và chuẩn hóa qua pathId.
function param(req: Request): string {
  return pathId(req.params.id);
}
/** Zod 4 applies defaults inside optional fields. PATCH must only contain explicitly supplied keys. */
function supplied<T extends object>(parsed: T, raw: unknown): T {
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(raw, key),
    ),
  ) as T;
}
// Chỉ nhận khóa cấu hình đã được khai báo.
function settingKey(value: unknown): SettingKey {
  const key = z.string().parse(value);
  requireThat(
    settingKeys.includes(key as SettingKey),
    404,
    "SETTING_NOT_FOUND",
    "This configuration key is not editable",
  );
  return key as SettingKey;
}
// Kiểm tra ngày, điểm thưởng và metadata trước khi lưu bài.
function parseContent(input: unknown) {
  const parsed = contentSchema.parse(input);
  const starts = parsed.starts_at
    ? new Date(parsed.starts_at).toISOString()
    : null;
  const ends = parsed.ends_at ? new Date(parsed.ends_at).toISOString() : null;
  requireThat(
    !starts || !ends || ends > starts,
    400,
    "INVALID_DATES",
    "Content end must follow its start",
  );
  requireThat(
    parsed.kind === "REWARD" || parsed.points_cost === 0,
    400,
    "INVALID_POINTS_COST",
    "Only rewards have a points cost",
  );
  requireThat(
    parsed.kind !== "GROUP" || parsed.parent_id === null,
    400,
    "INVALID_PARENT",
    "Groups must be top-level content",
  );
  const metadata = metadataSchemas[parsed.kind].parse(
    parsed.metadata,
  ) as Record<string, unknown>;
  if (typeof metadata.registration_closes_at === "string") {
    const deadline = new Date(metadata.registration_closes_at).toISOString();
    metadata.registration_closes_at = deadline;
    requireThat(
      !ends || deadline <= ends,
      400,
      "INVALID_DATES",
      "Registration must close before the event ends",
    );
  }
  return {
    parent_id: parsed.parent_id,
    kind: parsed.kind,
    title: parsed.title,
    body: parsed.body,
    status: parsed.status,
    starts_at: starts,
    ends_at: ends,
    points_cost: parsed.points_cost,
    metadata_json: JSON.stringify(metadata),
  };
}

// Trả cấu hình ở dạng đọc, kèm giá trị JSON đã tách.
function projectedSetting(row: DocumentData): DocumentData {
  let value: unknown = null;
  try {
    value = JSON.parse(row.value_json);
  } catch {
    /* Invalid stored configuration is surfaced for administrator repair. */
  }
  return {
    id: row.id,
    key: row.key,
    value,
    display_only: true,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
  };
}

const legacyContentKinds = ["ARTICLE", "GROUP", "EVENT", "CHALLENGE", "REWARD", "BADGE"];
// Bài cộng đồng mới đi qua API riêng, không dùng route cũ.
function legacyContent(row: DocumentData): DocumentData {
  requireThat(legacyContentKinds.includes(row.kind),404,"NOT_FOUND","Use the community management API for posts, tips and private scans.");
  return row;
}
// Gắn các route quản trị lên router dùng chung.
export function registerAdminRoutes(router: Router, ctx: Context): void {
  const dashboard = asyncRoute(async (_req, res) => {
    const who = actor(res, ["ADMIN", "MODERATOR"]);
    // Aggregations run on the server; no unbounded document downloads or private-user reads for moderators.
    const shared = await Promise.all([
      ctx.db
        .collection("listings")
        .where("status", "==", "PENDING")
        .count()
        .get(),
      ctx.db
        .collection("reports")
        .where("order_id", "==", null)
        .where("status", "in", ["OPEN", "IN_REVIEW"])
        .count()
        .get(),
      ctx.db
        .collection("content_entries")
        .where("status", "==", "PUBLISHED")
        .count()
        .get(),
    ]);
    const moderation = {
      pending_listings: shared[0].data().count,
      open_content_reports: shared[1].data().count,
      published_content: shared[2].data().count,
    };
    if (who.role === "MODERATOR") {
      res.json({ moderation });
      return;
    }
    const [users, suspended, kyc, orders, disputes, reports, charges, refunds] =
      await Promise.all([
        ctx.db.collection("users").count().get(),
        ctx.db
          .collection("users")
          .where("status", "==", "SUSPENDED")
          .count()
          .get(),
        ctx.db
          .collection("verifications")
          .where("status", "==", "PENDING")
          .count()
          .get(),
        ctx.db.collection("orders").count().get(),
        ctx.db
          .collection("orders")
          .where("status", "==", "DISPUTED")
          .count()
          .get(),
        ctx.db
          .collection("reports")
          .where("status", "in", ["OPEN", "IN_REVIEW"])
          .count()
          .get(),
        ctx.db
          .collection("payments")
          .where("kind", "==", "CHARGE")
          .where("status", "==", "SUCCEEDED")
          .aggregate({ amount: AggregateField.sum("amount_vnd") })
          .get(),
        ctx.db
          .collection("payments")
          .where("kind", "==", "REFUND")
          .where("status", "==", "SUCCEEDED")
          .aggregate({ amount: AggregateField.sum("amount_vnd") })
          .get(),
      ]);
    res.json({
      moderation,
      users: users.data().count,
      suspended_users: suspended.data().count,
      pending_verifications: kyc.data().count,
      orders: orders.data().count,
      disputed_orders: disputes.data().count,
      open_reports: reports.data().count,
      successful_charge_vnd: charges.data().amount,
      successful_refund_vnd: refunds.data().amount,
      net_paid_vnd: charges.data().amount - refunds.data().amount,
    });
  });
  router.get("/admin/dashboard", dashboard);
  router.get("/admin/stats", dashboard);

  router.get(
    "/admin/users",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      let query: Query = ctx.db.collection("users");
      if (req.query.role !== undefined)
        query = query.where("role", "==", z.enum(roles).parse(req.query.role));
      if (req.query.status !== undefined)
        query = query.where(
          "status",
          "==",
          z.enum(["ACTIVE", "SUSPENDED"]).parse(req.query.status),
        );
      res.json(await page(query, req));
    }),
  );

  router.get(
    "/admin/users/:id",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      res.json(docData(await ctx.db.collection("users").doc(param(req)).get()));
    }),
  );

  router.patch(
    "/admin/users/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        uid = param(req);
      const input = z
        .object({
          role: z.enum(roles).optional(),
          status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
          ...reason,
        })
        .strict()
        .refine(
          (value) => value.role !== undefined || value.status !== undefined,
          "Provide role or status",
        )
        .parse(req.body);
      requireThat(
        uid !== who.uid ||
          ((!input.role || input.role === "ADMIN") &&
            (!input.status || input.status === "ACTIVE")),
        409,
        "SELF_ADMIN_CHANGE",
        "You cannot remove your own administrator access",
      );
      const ref = ctx.db.collection("users").doc(uid);
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const user = docData(await tx.get(ref));
        requireThat(
          user._deletion_pending !== true,
          409,
          "ACCOUNT_DELETION_IN_PROGRESS",
          "Account deletion is already in progress",
        );
        if (
          user.role === "ADMIN" &&
          user.status === "ACTIVE" &&
          ((input.role && input.role !== "ADMIN") ||
            input.status === "SUSPENDED")
        ) {
          const admins = await tx.get(
            ctx.db
              .collection("users")
              .where("role", "==", "ADMIN")
              .where("status", "==", "ACTIVE")
              .limit(2),
          );
          requireThat(
            admins.size > 1,
            409,
            "LAST_ADMIN",
            "The last active administrator must be retained",
          );
        }
        const update = {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
          updated_at: ctx.now(),
        };
        tx.update(ref, update);
        audit(tx, ctx, who, "USER_ACCESS_UPDATED", "User", uid, input.reason);
        return { ...user, ...update };
      });
      res.json(result);
    }),
  );

  router.delete(
    "/admin/users/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        uid = param(req),
        input = z
          .object({ confirmation: z.string().trim().min(1).max(254), ...reason })
          .strict()
          .parse(req.body),
        ref = ctx.db.collection("users").doc(uid);
      requireThat(
        uid !== who.uid,
        409,
        "SELF_ACCOUNT_DELETE",
        "You cannot delete the administrator account currently in use",
      );

      const deletion = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const snapshot = await tx.get(ref),
          user = docData(snapshot),
          expected =
            typeof user.email === "string" && user.email.trim()
              ? user.email.trim()
              : uid,
          confirmed =
            typeof user.email === "string" && user.email.trim()
              ? input.confirmation.trim().toLowerCase() === expected.toLowerCase()
              : input.confirmation.trim() === uid;
        requireThat(
          confirmed,
          409,
          "ACCOUNT_CONFIRMATION_MISMATCH",
          "Type the account email or UID to confirm deletion",
        );

        const pending = user._deletion_pending === true;
        if (
          !pending &&
          user.role === "ADMIN" &&
          user.status === "ACTIVE"
        ) {
          const admins = await tx.get(
            ctx.db
              .collection("users")
              .where("role", "==", "ADMIN")
              .where("status", "==", "ACTIVE")
              .limit(2),
          );
          requireThat(
            admins.size > 1,
            409,
            "LAST_ADMIN",
            "The last active administrator must be retained",
          );
        }
        const previousStatus = pending
          ? user._deletion_previous_status ?? "SUSPENDED"
          : user.status;
        if (!pending)
          tx.update(ref, {
            status: "SUSPENDED",
            _deletion_pending: true,
            _deletion_previous_status: previousStatus,
            updated_at: ctx.now(),
          });
        return { pending, previousStatus };
      });

      try {
        await ctx.auth.deleteUser(uid);
      } catch (error) {
        if ((error as { code?: string })?.code !== "auth/user-not-found") {
          if (!deletion.pending) {
            await ctx.db.runTransaction(async (tx) => {
              await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
              const snapshot = await tx.get(ref);
              if (snapshot.exists && snapshot.data()?._deletion_pending === true)
                tx.update(ref, {
                  status: deletion.previousStatus,
                  _deletion_pending: false,
                  _deletion_previous_status: null,
                  updated_at: ctx.now(),
                });
            });
          }
          throw error;
        }
      }

      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return;
        requireThat(
          snapshot.data()?._deletion_pending === true,
          409,
          "ACCOUNT_DELETE_NOT_PENDING",
          "Account deletion was not prepared",
        );
        tx.delete(ref);
        audit(tx, ctx, who, "USER_ACCOUNT_DELETED", "User", uid, input.reason);
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/admin/audit-logs",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      let query: Query = ctx.db.collection("audit_logs");
      if (req.query.actor_id !== undefined)
        query = query.where("actor_id", "==", pathId(req.query.actor_id));
      if (req.query.entity_type !== undefined)
        query = query.where(
          "entity_type",
          "==",
          z.string().trim().min(1).max(50).parse(req.query.entity_type),
        );
      res.json(await page(query, req));
    }),
  );

  router.get(
    "/admin/payments",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      let query: Query = ctx.db.collection("payments");
      if (req.query.status !== undefined)
        query = query.where(
          "status",
          "==",
          z
            .enum(["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"])
            .parse(req.query.status),
        );
      if (req.query.kind !== undefined)
        query = query.where(
          "kind",
          "==",
          z.enum(["CHARGE", "REFUND"]).parse(req.query.kind),
        );
      if (req.query.provider !== undefined)
        query = query.where(
          "provider",
          "==",
          z.enum(["MOMO", "VNPAY", "EMULATOR"]).parse(req.query.provider),
        );
      if (req.query.order_id !== undefined)
        query = query.where("order_id", "==", pathId(req.query.order_id));
      res.json(await page(query, req));
    }),
  );

  router.get(
    "/admin/green-ledger",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      let query: Query = ctx.db.collection("green_ledger");
      if (req.query.user_id !== undefined)
        query = query.where("user_id", "==", pathId(req.query.user_id));
      if (req.query.order_id !== undefined)
        query = query.where("order_id", "==", pathId(req.query.order_id));
      res.json(await page(query, req));
    }),
  );

  router.post(
    "/admin/users/:id/points",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        uid = param(req),
        key = idempotency(req);
      const input = z
        .object({
          // `points` is the desired final balance, not an amount to add.
          points: z
            .number()
            .int()
            .min(-1_000_000)
            .max(1_000_000),
          ...reason,
        })
        .strict()
        .parse(req.body);
      requireThat(
        input.points >= 0,
        409,
        "INVALID_POINTS_BALANCE",
        "The desired points balance cannot be negative",
      );
      const ref = ctx.db
        .collection("green_ledger")
        .doc(sha(`adjustment:${who.uid}:${key}`));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        const userRef = ctx.db.collection("users").doc(uid);
        const [userSnap, existing] = await Promise.all([
          tx.get(userRef),
          tx.get(ref),
        ]);
        const user = docData(userSnap);
        if (existing.exists) {
          const previous = existing.data()!;
          requireThat(
            previous.user_id === uid &&
              previous.target_balance === input.points &&
              previous.reason === input.reason,
            409,
            "IDEMPOTENCY_CONFLICT",
            "This adjustment key was used with different values",
          );
          return {
            row: { ...previous, id: ref.id },
            balance: Number(user.points_balance ?? 0),
            created: false,
          };
        }
        const previousBalance = Number(user.points_balance ?? 0);
        const balance = input.points;
        const delta = balance - previousBalance;
        requireThat(
          Number.isSafeInteger(previousBalance) &&
            previousBalance >= 0 &&
            Number.isSafeInteger(delta),
          409,
          "INVALID_POINTS_BALANCE",
          "The existing points balance is invalid",
        );
        const row = {
          id: ref.id,
          user_id: uid,
          order_id: null,
          content_id: null,
          points: delta,
          target_balance: balance,
          reason: input.reason,
          dedupe_key: `adjustment:${who.uid}:${key}`,
          created_at: ctx.now(),
          _actor_id: who.uid,
        };
        tx.create(ref, row);
        tx.update(userRef, { points_balance: balance, updated_at: ctx.now() });
        audit(
          tx,
          ctx,
          who,
          "GREEN_POINTS_ADJUSTED",
          "GreenLedger",
          ref.id,
          input.reason,
        );
        return { row, balance, created: true };
      });
      res
        .status(result.created ? 201 : 200)
        .json({ ...result.row, balance: result.balance });
    }),
  );

  for (const [route, collection, schema, allowed, entity, disabled] of [
    [
      "categories",
      "categories",
      categorySchema,
      ["ADMIN"],
      "Category",
      { active: false },
    ],
    [
      "collection-points",
      "collection_points",
      pointSchema,
      ["ADMIN"],
      "CollectionPoint",
      { status: "INACTIVE" },
    ],
  ] as const) {
    router.get(
      `/admin/${route}`,
      asyncRoute(async (req, res) => {
        actor(res, ["ADMIN", "MODERATOR"]);
        res.json(await page(ctx.db.collection(collection), req));
      }),
    );
    router.get(
      `/admin/${route}/:id`,
      asyncRoute(async (req, res) => {
        actor(res, ["ADMIN", "MODERATOR"]);
        res.json(
          docData(await ctx.db.collection(collection).doc(param(req)).get()),
        );
      }),
    );
    router.post(
      `/admin/${route}`,
      asyncRoute(async (req, res) => {
        const who = actor(res, [...allowed]);
        const input = schema.extend(reason).parse(req.body),
          { reason: justification, ...fields } = input;
        const ref = ctx.db.collection(collection).doc();
        const result = await ctx.db.runTransaction(async (tx) => {
          await assertTransactionRole(tx, ctx, who, [...allowed]);
          if ("manager_id" in fields && fields.manager_id) {
            const manager = docData(
              await tx.get(ctx.db.collection("users").doc(fields.manager_id)),
            );
            requireThat(
              manager.status === "ACTIVE" &&
                ["COLLECTOR", "ADMIN"].includes(manager.role),
              400,
              "INVALID_MANAGER",
              "Collection point manager must be an active collector or administrator",
            );
          }
          const row = {
            ...fields,
            id: ref.id,
            created_at: ctx.now(),
            updated_at: ctx.now(),
          };
          tx.create(ref, row);
          audit(
            tx,
            ctx,
            who,
            `${entity.toUpperCase()}_CREATED`,
            entity,
            ref.id,
            justification,
          );
          return row;
        });
        res.status(201).json(result);
      }),
    );
    router.patch(
      `/admin/${route}/:id`,
      asyncRoute(async (req, res) => {
        const who = actor(res, [...allowed]),
          itemId = param(req);
        const input = supplied(
          schema.partial().extend(reason).parse(req.body),
          req.body,
        );
        requireThat(
          Object.keys(input).length > 1,
          400,
          "FIELDS_REQUIRED",
          "Provide at least one field to update",
        );
        const { reason: justification, ...fields } = input;
        const ref = ctx.db.collection(collection).doc(itemId);
        const result = await ctx.db.runTransaction(async (tx) => {
          await assertTransactionRole(tx, ctx, who, [...allowed]);
          const original = docData(await tx.get(ref));
          if ("manager_id" in fields && fields.manager_id) {
            const manager = docData(
              await tx.get(ctx.db.collection("users").doc(fields.manager_id)),
            );
            requireThat(
              manager.status === "ACTIVE" &&
                ["COLLECTOR", "ADMIN"].includes(manager.role),
              400,
              "INVALID_MANAGER",
              "Collection point manager must be an active collector or administrator",
            );
          }
          const update = { ...fields, updated_at: ctx.now() };
          tx.update(ref, update);
          audit(
            tx,
            ctx,
            who,
            `${entity.toUpperCase()}_UPDATED`,
            entity,
            itemId,
            justification,
          );
          return { ...original, ...update };
        });
        res.json(result);
      }),
    );
    router.delete(
      `/admin/${route}/:id`,
      asyncRoute(async (req, res) => {
        const who = actor(res, [...allowed]),
          itemId = param(req),
          input = z.object(reason).strict().parse(req.body);
        const ref = ctx.db.collection(collection).doc(itemId);
        await ctx.db.runTransaction(async (tx) => {
          await assertTransactionRole(tx, ctx, who, [...allowed]);
          docData(await tx.get(ref));
          tx.update(ref, { ...disabled, updated_at: ctx.now() });
          audit(
            tx,
            ctx,
            who,
            `${entity.toUpperCase()}_DISABLED`,
            entity,
            itemId,
            input.reason,
          );
        });
        res.status(204).end();
      }),
    );
  }

  router.get(
    "/admin/content",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN", "MODERATOR"]);
      let query: Query = ctx.db.collection("content_entries");
      if (req.query.kind !== undefined)
        query = query.where(
          "kind",
          "==",
          contentSchema.shape.kind.parse(req.query.kind),
        );
      else query = query.where("kind", "in", legacyContentKinds);
      if (req.query.status !== undefined)
        query = query.where(
          "status",
          "==",
          z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(req.query.status),
        );
      res.json(await page(query, req));
    }),
  );
  router.get(
    "/admin/content/:id",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN", "MODERATOR"]);
      res.json(
        legacyContent(docData(
          await ctx.db.collection("content_entries").doc(param(req)).get(),
        )),
      );
    }),
  );
  router.post(
    "/admin/content",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]);
      const input = contentSchema.extend(reason).parse(req.body),
        { reason: justification, ...fields } = input;
      const parsed = parseContent(fields),
        ref = ctx.db.collection("content_entries").doc();
      const row = {
        ...parsed,
        id: ref.id,
        author_id: who.uid,
        created_at: ctx.now(),
        updated_at: ctx.now(),
      };
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        if (parsed.parent_id) {
          const parent = docData(
            await tx.get(
              ctx.db.collection("content_entries").doc(parsed.parent_id),
            ),
          );
          requireThat(
            parent.kind === "GROUP" && parent.status !== "ARCHIVED",
            400,
            "INVALID_PARENT",
            "Parent content must be an available group",
          );
        }
        tx.create(ref, row);
        audit(
          tx,
          ctx,
          who,
          "CONTENT_CREATED",
          "ContentEntry",
          ref.id,
          justification,
        );
      });
      res.status(201).json(row);
    }),
  );
  router.patch(
    "/admin/content/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]),
        contentId = param(req);
      const input = supplied(
        contentSchema.partial().extend(reason).parse(req.body),
        req.body,
      );
      requireThat(
        Object.keys(input).length > 1,
        400,
        "FIELDS_REQUIRED",
        "Provide at least one field to update",
      );
      const { reason: justification, ...fields } = input,
        ref = ctx.db.collection("content_entries").doc(contentId);
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        const original = docData(await tx.get(ref));
        let metadata: Record<string, unknown> = {};
        legacyContent(original);
        try {
          metadata = JSON.parse(original.metadata_json ?? "{}");
        } catch {
          /* Replacing invalid legacy metadata is allowed. */
        }
        const parsed = parseContent(
          Object.fromEntries(
            Object.entries({
              parent_id: original.parent_id ?? null,
              kind: original.kind,
              title: original.title,
              body: original.body,
              status: original.status,
              starts_at: original.starts_at ?? null,
              ends_at: original.ends_at ?? null,
              points_cost: original.points_cost ?? 0,
              metadata,
              ...fields,
            }),
          ),
        );
        requireThat(
          parsed.parent_id !== contentId,
          400,
          "INVALID_PARENT",
          "Content cannot be its own parent",
        );
        if (parsed.parent_id) {
          const parent = docData(
            await tx.get(
              ctx.db.collection("content_entries").doc(parsed.parent_id),
            ),
          );
          requireThat(
            parent.kind === "GROUP" && parent.status !== "ARCHIVED",
            400,
            "INVALID_PARENT",
            "Parent content must be an available group",
          );
        }
        const update = { ...parsed, updated_at: ctx.now() };
        tx.update(ref, update);
        audit(
          tx,
          ctx,
          who,
          "CONTENT_UPDATED",
          "ContentEntry",
          contentId,
          justification,
        );
        return { ...original, ...update };
      });
      res.json(result);
    }),
  );
  router.delete(
    "/admin/content/:id",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN", "MODERATOR"]),
        contentId = param(req),
        input = z.object(reason).strict().parse(req.body);
      const ref = ctx.db.collection("content_entries").doc(contentId);
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN", "MODERATOR"]);
        legacyContent(docData(await tx.get(ref)));
        tx.update(ref, { status: "ARCHIVED", updated_at: ctx.now() });
        audit(
          tx,
          ctx,
          who,
          "CONTENT_ARCHIVED",
          "ContentEntry",
          contentId,
          input.reason,
        );
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/admin/settings",
    asyncRoute(async (_req, res) => {
      actor(res, ["ADMIN"]);
      const documents = await ctx.db.getAll(
        ...settingKeys.map((key) =>
          ctx.db.collection("system_settings").doc(key),
        ),
      );
      res.json({
        items: documents
          .filter((doc) => doc.exists)
          .map((doc) => projectedSetting({ ...doc.data(), id: doc.id })),
      });
    }),
  );
  router.get(
    "/admin/settings/:key",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      res.json(
        projectedSetting(
          docData(
            await ctx.db
              .collection("system_settings")
              .doc(settingKey(req.params.key))
              .get(),
          ),
        ),
      );
    }),
  );
  router.patch(
    "/admin/settings/:key",
    asyncRoute(async (req, res) => {
      const who = actor(res, ["ADMIN"]),
        key = settingKey(req.params.key);
      const input = z
        .object({ value: z.unknown(), ...reason })
        .strict()
        .parse(req.body);
      const value = settingSchemas[key].parse(input.value),
        ref = ctx.db.collection("system_settings").doc(key);
      const row = {
        id: key,
        key,
        value_json: JSON.stringify(value),
        updated_by: who.uid,
        updated_at: ctx.now(),
      };
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, ["ADMIN"]);
        tx.set(ref, row);
        audit(
          tx,
          ctx,
          who,
          "SETTING_UPDATED",
          "SystemSetting",
          key,
          input.reason,
        );
      });
      res.json(projectedSetting(row));
    }),
  );
}
