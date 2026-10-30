/**
 * Kiểm thử route quản trị: phân quyền, danh mục, nội dung và cấu hình.
 */
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
import { registerAdminRoutes } from "../src/admin.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `admin_${randomUUID().replaceAll("-", "")}`;
const uid = (suffix: string) => `${prefix}_${suffix}`;

describe(
  "Administrator controls and configuration boundaries",
  { skip: !enabled, concurrency: false },
  () => {
    let firebase: App, ctx: Context, server: Server, base: string;
    async function request(
      who: string | null,
      method: string,
      path: string,
      body?: unknown,
      key?: string,
    ) {
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
    before(async () => {
      const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
      assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(host.hostname));
      const projectId = "demo-recycling-share";
      firebase = initializeApp(
        { projectId, storageBucket: `${projectId}.appspot.com` },
        prefix,
      );
      ctx = {
        db: getFirestore(firebase),
        auth: getAuth(firebase),
        bucket: getStorage(firebase).bucket(),
        now: () => "2026-10-18T10:00:00.000Z",
        emulator: true,
      };
      for (const [suffix, role, status] of [
        ["owner", "ADMIN", "ACTIVE"],
        ["second", "ADMIN", "ACTIVE"],
        ["moderator", "MODERATOR", "ACTIVE"],
        ["member", "MEMBER", "ACTIVE"],
        ["collector", "COLLECTOR", "ACTIVE"],
        ["suspended", "ADMIN", "SUSPENDED"],
      ] as const) {
        await ctx.db
          .collection("users")
          .doc(uid(suffix))
          .set({
            id: uid(suffix),
            role,
            status,
            display_name: suffix,
            email: `${suffix}@example.test`,
            points_balance: 0,
            created_at: ctx.now(),
          });
      }
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        const userId = req.get("X-Test-User");
        if (!userId) {
          next();
          return;
        }
        void ctx.db
          .collection("users")
          .doc(userId)
          .get()
          .then((doc) => {
            if (doc.exists)
              res.locals.actor = {
                uid: userId,
                role: doc.data()!.role,
                status: doc.data()!.status,
              };
            next();
          })
          .catch(next);
      });
      registerAdminRoutes(app, ctx);
      const errors: ErrorRequestHandler = (error, _req, res, _next) => {
        if (error instanceof ApiError) {
          res.status(error.status).json({ error: error.code });
          return;
        }
        if (error instanceof ZodError) {
          res.status(400).json({ error: "VALIDATION_ERROR" });
          return;
        }
        res.status(500).json({ error: String(error) });
      };
      app.use(errors);
      server = await new Promise<Server>((resolve) => {
        const running = app.listen(0, "127.0.0.1", () => resolve(running));
      });
      const location = server.address();
      assert.ok(location && typeof location !== "string");
      base = `http://127.0.0.1:${location.port}`;
    });
    after(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      if (firebase) await deleteApp(firebase);
    });

    it("protects private administration and limits moderator dashboard fields", async () => {
      assert.equal((await request(null, "GET", "/admin/users")).status, 401);
      for (const who of ["member", "moderator", "suspended"])
        assert.equal(
          (await request(uid(who), "GET", "/admin/users")).status,
          403,
        );
      const view = await request(uid("moderator"), "GET", "/admin/dashboard");
      assert.equal(view.status, 200);
      assert.deepEqual(Object.keys(view.data), ["moderation"]);
      assert.equal(typeof view.data.moderation.pending_listings, "number");
      assert.equal(
        (await request(uid("moderator"), "GET", "/admin/payments")).status,
        403,
      );
      assert.equal(
        (await request(uid("moderator"), "GET", "/admin/green-ledger")).status,
        403,
      );
      const privateUser = await request(
        uid("owner"),
        "GET",
        `/admin/users/${uid("member")}`,
      );
      assert.equal(privateUser.status, 200);
      assert.equal(privateUser.data.email, "member@example.test");
    });

    it("prevents self-removal, audits role updates, and applies revocation immediately", async () => {
      assert.equal(
        (
          await request(uid("owner"), "PATCH", `/admin/users/${uid("owner")}`, {
            role: "MEMBER",
            reason: "Demote myself",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(uid("owner"), "PATCH", `/admin/users/${uid("owner")}`, {
            status: "SUSPENDED",
            reason: "Suspend myself",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/users/${uid("member")}`,
            { points_balance: 999, reason: "Unauthorized field" },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/users/${uid("second")}`,
            { role: "MEMBER", reason: "Reduce administrator access" },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            uid("second"),
            "PATCH",
            `/admin/users/${uid("member")}`,
            { role: "ADMIN", reason: "Try stale admin access" },
          )
        ).status,
        403,
      );
      const logs = await request(
        uid("owner"),
        "GET",
        `/admin/audit-logs?actor_id=${uid("owner")}`,
      );
      assert.equal(logs.status, 200);
      assert.ok(
        logs.data.items.some(
          (row: any) => row.action === "USER_ACCESS_UPDATED",
        ),
      );
      assert.equal(
        (await request(uid("moderator"), "GET", "/admin/audit-logs")).status,
        403,
      );
    });

    it("validates explicit category and collection point CRUD and uses soft deletion", async () => {
      const category = await request(
        uid("owner"),
        "POST",
        "/admin/categories",
        { name: "Reused furniture", reason: "Create recycling category" },
      );
      assert.equal(category.status, 201);
      assert.equal(
        (
          await request(
            uid("moderator"),
            "PATCH",
            `/admin/categories/${category.data.id}`,
            { active: false, reason: "Try admin-only update" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/categories/${category.data.id}`,
            { price_vnd: 1, reason: "Inject unrelated field" },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "DELETE",
            `/admin/categories/${category.data.id}`,
            { reason: "Category no longer used" },
          )
        ).status,
        204,
      );
      assert.equal(
        (
          await ctx.db.collection("categories").doc(category.data.id).get()
        ).data()!.active,
        false,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/categories/${category.data.id}`,
            {
              name: "Archived furniture",
              reason: "Clarify inactive category label",
            },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await ctx.db.collection("categories").doc(category.data.id).get()
        ).data()!.active,
        false,
      );
      const point = {
        name: "Reuse center",
        address: "123 Reuse Street",
        latitude: 10.7,
        longitude: 106.7,
        materials: "Paper, plastic",
        opening_hours: "08:00–17:00",
        manager_id: uid("collector"),
        reason: "Create collection center",
      };
      assert.equal(
        (
          await request(uid("owner"), "POST", "/admin/collection-points", {
            ...point,
            latitude: 100,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(uid("owner"), "POST", "/admin/collection-points", {
            ...point,
            manager_id: uid("member"),
          })
        ).status,
        400,
      );
      const created = await request(
        uid("owner"),
        "POST",
        "/admin/collection-points",
        point,
      );
      assert.equal(created.status, 201);
      assert.equal(
        (
          await request(
            uid("owner"),
            "DELETE",
            `/admin/collection-points/${created.data.id}`,
            { reason: "Center permanently closed" },
          )
        ).status,
        204,
      );
      assert.equal(
        (
          await ctx.db
            .collection("collection_points")
            .doc(created.data.id)
            .get()
        ).data()!.status,
        "INACTIVE",
      );
    });

    it("validates content metadata by kind and preserves author identity", async () => {
      const group = await request(uid("moderator"), "POST", "/admin/content", {
        kind: "GROUP",
        title: "Reuse together",
        body: "Local group",
        status: "PUBLISHED",
        metadata: { rules: "Be respectful" },
        reason: "Create local community group",
      });
      assert.equal(group.status, 201);
      const articleBody = {
        kind: "ARTICLE",
        title: "Repair a chair",
        body: "Instructions",
        status: "PUBLISHED",
        parent_id: group.data.id,
        metadata: { reading_minutes: 4 },
        reason: "Publish useful reuse guidance",
      };
      assert.equal(
        (
          await request(uid("moderator"), "POST", "/admin/content", {
            ...articleBody,
            metadata: { stock: 10 },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(uid("moderator"), "POST", "/admin/content", {
            ...articleBody,
            points_cost: 20,
          })
        ).status,
        400,
      );
      const article = await request(
        uid("moderator"),
        "POST",
        "/admin/content",
        articleBody,
      );
      assert.equal(article.status, 201);
      assert.equal(article.data.author_id, uid("moderator"));
      const challenge = await request(uid("moderator"), "POST", "/admin/content", {
        kind: "CHALLENGE", title: "Plant three trees", body: "Reuse containers to grow three plants.",
        status: "PUBLISHED", metadata: {target: 3, unit: "plants", reward_points: 30},
        reason: "Create a points challenge",
      });
      assert.equal(challenge.status, 201, JSON.stringify(challenge.data));
      assert.equal(JSON.parse(challenge.data.metadata_json).reward_points, 30);
      const rewardEdit = await request(uid("moderator"), "PATCH", `/admin/content/${challenge.data.id}`, {
        metadata: {target: 3, unit: "plants", reward_points: 45}, reason: "Increase challenge reward",
      });
      assert.equal(rewardEdit.status, 200);
      assert.equal(JSON.parse(rewardEdit.data.metadata_json).reward_points, 45);
      assert.equal(JSON.parse(rewardEdit.data.metadata_json).unit, "plants");
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/content/${article.data.id}`,
            { author_id: uid("owner"), reason: "Try changing attribution" },
          )
        ).status,
        400,
      );
      const updated = await request(
        uid("moderator"),
        "PATCH",
        `/admin/content/${article.data.id}`,
        { title: "Repair your chair", reason: "Clarify the article title" },
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.data.status, "PUBLISHED");
      assert.equal(updated.data.parent_id, group.data.id);
      assert.equal(JSON.parse(updated.data.metadata_json).reading_minutes, 4);
      assert.equal(
        (
          await request(
            uid("moderator"),
            "PATCH",
            `/admin/content/${group.data.id}`,
            { parent_id: group.data.id, reason: "Try self parent" },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            uid("moderator"),
            "DELETE",
            `/admin/content/${article.data.id}`,
            { reason: "Archive outdated guidance" },
          )
        ).status,
        204,
      );
      assert.equal(
        (
          await ctx.db.collection("content_entries").doc(article.data.id).get()
        ).data()!.status,
        "ARCHIVED",
      );
    });

    it("makes manual point adjustments idempotent and prevents invalid balances", async () => {
      const path = `/admin/users/${uid("member")}/points`,
        body = { points: 20, reason: "Correct verified contribution" };
      assert.equal(
        (await request(uid("owner"), "POST", path, body)).status,
        400,
      );
      const first = await request(
        uid("owner"),
        "POST",
        path,
        body,
        "adjustment_key_01",
      );
      assert.equal(first.status, 201);
      assert.equal(first.data.balance, 20);
      assert.equal(
        (await request(uid("owner"), "POST", path, body, "adjustment_key_01"))
          .status,
        200,
      );
      assert.equal(
        (await ctx.db.collection("users").doc(uid("member")).get()).data()!
          .points_balance,
        20,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "POST",
            path,
            { ...body, points: 30 },
            "adjustment_key_01",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "POST",
            path,
            { ...body, points: -21 },
            "adjustment_key_02",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            uid("moderator"),
            "POST",
            path,
            body,
            "adjustment_key_03",
          )
        ).status,
        403,
      );
      const ledger = await request(
        uid("owner"),
        "GET",
        `/admin/green-ledger?user_id=${uid("member")}`,
      );
      assert.equal(ledger.data.items.length, 1);
    });

    it("allows only strict public settings and never exposes payment receipt records", async () => {
      const internalId = `receipt_${uid("secret")}`;
      await ctx.db
        .collection("system_settings")
        .doc(internalId)
        .set({ payment_id: "secret", provider_transaction_id: "private" });
      assert.equal(
        (await request(uid("owner"), "GET", `/admin/settings/${internalId}`))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            uid("owner"),
            "PATCH",
            `/admin/settings/${internalId}`,
            { value: {}, reason: "Try editing provider receipt" },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(uid("owner"), "PATCH", "/admin/settings/contact", {
            value: {
              support_email: "support@example.test",
              api_secret: "secret",
            },
            reason: "Try storing secret",
          })
        ).status,
        400,
      );
      const valid = await request(
        uid("owner"),
        "PATCH",
        "/admin/settings/contact",
        {
          value: { support_email: "support@example.test" },
          reason: "Update public support email",
        },
      );
      assert.equal(valid.status, 200);
      assert.equal(valid.data.value.support_email, "support@example.test");
      assert.equal(valid.data.display_only, true);
      const list = await request(uid("owner"), "GET", "/admin/settings");
      assert.equal(list.status, 200);
      assert.ok(
        list.data.items.every((row: any) =>
          ["app", "moderation", "contact", "maintenance"].includes(row.key),
        ),
      );
      assert.equal(
        (await request(uid("moderator"), "GET", "/admin/settings")).status,
        403,
      );
    });

    it("deletes an account only after explicit confirmation and preserves related history", async () => {
      const target = uid("delete_target");
      await ctx.auth.createUser({ uid: target, email: "delete-target@example.test" });
      await ctx.db.collection("users").doc(target).set({
        id: target,
        role: "MEMBER",
        status: "ACTIVE",
        display_name: "Delete target",
        email: "delete-target@example.test",
        points_balance: 12,
        created_at: ctx.now(),
      });
      const historyId = `delete_history_${target}`;
      await ctx.db.collection("orders").doc(historyId).set({
        buyer_id: target,
        status: "COMPLETED",
      });
      const path = `/admin/users/${target}`;

      assert.equal(
        (await request(uid("moderator"), "DELETE", path, {
          confirmation: "delete-target@example.test",
          reason: "Remove duplicate account",
        })).status,
        403,
      );
      assert.equal(
        (await request(uid("owner"), "DELETE", path, {
          confirmation: "wrong@example.test",
          reason: "Remove duplicate account",
        })).status,
        409,
      );
      assert.equal(
        (await ctx.db.collection("users").doc(target).get()).exists,
        true,
      );
      assert.equal(
        (await request(uid("owner"), "DELETE", `/admin/users/${uid("owner")}`, {
          confirmation: "owner@example.test",
          reason: "Try deleting the current administrator",
        })).status,
        409,
      );

      const removed = await request(uid("owner"), "DELETE", path, {
        confirmation: "DELETE-TARGET@example.test",
        reason: "Remove duplicate test account",
      });
      assert.equal(removed.status, 204);
      await assert.rejects(
        ctx.auth.getUser(target),
        (error: any) => error.code === "auth/user-not-found",
      );
      assert.equal(
        (await ctx.db.collection("users").doc(target).get()).exists,
        false,
      );
      assert.equal(
        (await ctx.db.collection("orders").doc(historyId).get()).data()?.buyer_id,
        target,
      );
      const audit = await ctx.db.collection("audit_logs").get();
      assert.equal(
        audit.docs.filter(
          (entry) =>
            entry.data().entity_id === target &&
            entry.data().action === "USER_ACCOUNT_DELETED",
        ).length,
        1,
      );
    });
  },
);
