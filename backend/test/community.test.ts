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

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `community_${randomUUID().replaceAll("-", "")}`;
const uid = (suffix: string) => `${prefix}_${suffix}`;
const clock = "2026-10-18T10:00:00.000Z";

describe(
  "Community backend transactions and privacy",
  { skip: !enabled, concurrency: false },
  () => {
    let firebase: App, ctx: Context, server: Server, base: string;
    type ApiResult = { status: number; data: any };
    async function request(
      who: string | null,
      method: string,
      path: string,
      body?: unknown,
      key?: string,
    ): Promise<ApiResult> {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(who ? { "X-Test-User": who } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const value = await response.text();
      return {
        status: response.status,
        data: value ? JSON.parse(value) : null,
      };
    }
    async function seed(
      collection: string,
      key: string,
      data: Record<string, unknown>,
    ) {
      await ctx.db
        .collection(collection)
        .doc(key)
        .set({ id: key, ...data });
    }

    before(async () => {
      const address = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
      assert.ok(
        ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname),
        "Tests require a loopback Firestore emulator",
      );
      const projectId = "demo-recycling-share";
      firebase = initializeApp(
        { projectId, storageBucket: `${projectId}.appspot.com` },
        prefix,
      );
      ctx = {
        db: getFirestore(firebase),
        auth: getAuth(firebase),
        bucket: getStorage(firebase).bucket(),
        now: () => clock,
        emulator: true,
      };
      for (const [suffix, role] of [
        ["buyer", "MEMBER"],
        ["seller", "MEMBER"],
        ["outsider", "MEMBER"],
        ["admin", "ADMIN"],
        ["moderator", "MODERATOR"],
      ] as const) {
        await seed("users", uid(suffix), {
          display_name: suffix,
          email: `${suffix}@example.test`,
          phone: "0900000000",
          role,
          status: "ACTIVE",
          created_at: clock,
          points_balance: 0,
        });
      }
      const app = express();
      app.use(express.json());
      // This test-only harness isolates service authorization from Firebase token verification, which is tested by the main app suite.
      app.use((req, res, next) => {
        const testUid = req.get("X-Test-User");
        if (!testUid) {
          next();
          return;
        }
        void ctx.db
          .collection("users")
          .doc(testUid)
          .get()
          .then((doc) => {
            if (doc.exists)
              res.locals.actor = {
                uid: testUid,
                role: doc.data()!.role,
                status: doc.data()!.status,
              };
            next();
          })
          .catch(next);
      });
      registerCommunityRoutes(app, ctx);
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

    it("rejects profile privilege changes and projects public profiles without contact data", async () => {
      assert.equal(
        (await request(null, "PATCH", "/me", { display_name: "No token" }))
          .status,
        401,
      );
      assert.equal(
        (await request(uid("buyer"), "PATCH", "/me", { role: "ADMIN" })).status,
        400,
      );
      assert.equal(
        (
          await request(uid("buyer"), "PATCH", "/me", {
            status: "ACTIVE",
            points_balance: 99999,
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(uid("buyer"), "PATCH", "/me", { phone: "<script>" }))
          .status,
        400,
      );
      const updatedProfile = await request(uid("buyer"), "PATCH", "/me", {
        display_name: "Updated buyer",
        bio: "Reuse first",
        city: "Hồ Chí Minh",
      });
      assert.equal(updatedProfile.status, 200);
      assert.equal(updatedProfile.data.display_name, "Updated buyer");
      assert.equal(updatedProfile.data.points_balance, 0);
      assert.equal(updatedProfile.data.verified, false);
      assert.equal(updatedProfile.data.pending_verification_id, null);
      const result = await request(null, "GET", `/users/${uid("buyer")}`);
      assert.equal(result.status, 200);
      assert.equal(result.data.display_name, "Updated buyer");
      for (const field of [
        "email",
        "phone",
        "role",
        "points_balance",
        "_verification_id",
      ])
        assert.equal(field in result.data, false);
      assert.equal(
        (await ctx.db.collection("users").doc(uid("buyer")).get()).data()!.role,
        "MEMBER",
      );
    });

    it("keeps exactly one default address across concurrent writes and enforces ownership", async () => {
      const body = {
        recipient: "Buyer",
        phone: "0900000000",
        line: "123 Reuse Street",
        city: "Hồ Chí Minh",
        is_default: true,
      };
      const [first, second] = await Promise.all([
        request(uid("buyer"), "POST", "/me/addresses", body),
        request(uid("buyer"), "POST", "/me/addresses", {
          ...body,
          line: "456 Reuse Street",
        }),
      ]);
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      const own = await request(uid("buyer"), "GET", "/me/addresses");
      assert.equal(own.data.items.length, 2);
      assert.equal(
        own.data.items.filter((row: any) => row.is_default).length,
        1,
      );
      assert.equal(
        (
          await request(
            uid("outsider"),
            "PATCH",
            `/me/addresses/${first.data.id}`,
            { city: "Other city" },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            uid("outsider"),
            "DELETE",
            `/me/addresses/${first.data.id}`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "PATCH",
            `/me/addresses/${first.data.id}`,
            { is_default: true },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "DELETE",
            `/me/addresses/${first.data.id}`,
          )
        ).status,
        204,
      );
      const remaining = await request(uid("buyer"), "GET", "/me/addresses");
      assert.equal(remaining.data.items.length, 1);
      assert.equal(remaining.data.items[0].is_default, true);
      assert.equal(
        (await request(uid("buyer"), "GET", "/me/addresses?limit=101")).status,
        400,
      );
    });

    it("requires private evidence for admin self-review and preserves approval on rejected renewal", async () => {
      const submitted = await request(
        uid("seller"),
        "POST",
        "/me/verifications",
        {},
      );
      assert.equal(submitted.status, 201);
      const verificationId = submitted.data.id;
      assert.equal(
        (await request(uid("seller"), "POST", "/me/verifications", {})).status,
        409,
      );
      const review = {
        status: "VERIFIED",
        reason: "Identity documents checked",
      };
      assert.equal(
        (
          await request(
            uid("moderator"),
            "POST",
            `/admin/verifications/${verificationId}/review`,
            review,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("admin"),
            "POST",
            `/admin/verifications/${verificationId}/review`,
            review,
          )
        ).status,
        409,
      );
      await seed("media_assets", uid("evidence"), {
        uploader_id: uid("seller"),
        verification_id: verificationId,
        visibility: "PRIVATE",
        _status: "READY",
        mime_type: "image/png",
      });
      assert.equal(
        (
          await request(
            uid("admin"),
            "POST",
            `/admin/verifications/${verificationId}/review`,
            review,
          )
        ).status,
        200,
      );
      let user = (
        await ctx.db.collection("users").doc(uid("seller")).get()
      ).data()!;
      assert.equal(user._verification_id, verificationId);
      assert.equal(user._pending_verification_id, null);
      assert.equal(
        (await request(null, "GET", `/users/${uid("seller")}`)).data.verified,
        true,
      );
      const renewal = await request(
        uid("seller"),
        "POST",
        "/me/verifications",
        {},
      );
      assert.equal(renewal.status, 201);
      assert.equal(
        (
          await request(
            uid("admin"),
            "POST",
            `/admin/verifications/${renewal.data.id}/review`,
            { status: "REJECTED", reason: "Renewal evidence is unreadable" },
          )
        ).status,
        200,
      );
      user = (
        await ctx.db.collection("users").doc(uid("seller")).get()
      ).data()!;
      assert.equal(user._verification_id, verificationId);
      assert.equal(
        (await request(null, "GET", `/users/${uid("seller")}`)).data.verified,
        true,
      );
      const self = await request(uid("admin"), "POST", "/me/verifications", {});
      assert.equal(self.status, 201);
      await seed("media_assets", uid("admin_evidence"), {
        uploader_id: uid("admin"),
        verification_id: self.data.id,
        visibility: "PRIVATE",
        _status: "READY",
        mime_type: "image/png",
      });
      assert.equal(
        (
          await request(
            uid("admin"),
            "POST",
            "/admin/verifications/" + self.data.id + "/review",
            review,
          )
        ).status,
        200,
      );
      const admin = (await ctx.db.collection("users").doc(uid("admin")).get()).data()!;
      assert.equal(admin._verification_id, self.data.id);
      assert.equal(admin._pending_verification_id, null);
      const notices = await request(uid("seller"), "GET", "/me/notifications");
      assert.equal(notices.status, 200);
      assert.ok(notices.data.items.length >= 2);
      assert.equal(
        (
          await request(
            uid("outsider"),
            "PATCH",
            `/me/notifications/${notices.data.items[0].id}/read`,
            {},
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            uid("seller"),
            "PATCH",
            `/me/notifications/${notices.data.items[0].id}/read`,
            {},
          )
        ).status,
        200,
      );
    });

    it("restricts conversations to participants and makes message retries idempotent", async () => {
      const created = await request(uid("buyer"), "POST", "/conversations", {
        member_id: uid("seller"),
      });
      assert.equal(created.status, 201);
      const conversationId = created.data.id;
      const duplicate = await request(uid("seller"), "POST", "/conversations", {
        member_id: uid("buyer"),
      });
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.data.id, conversationId);
      assert.equal((await request(uid("buyer"), "GET", `/conversations/${conversationId}`)).data.id, conversationId);
      assert.equal((await request(uid("seller"), "GET", `/conversations/${conversationId}`)).status, 403,
        "an unknown sender must go to the recipient's pending inbox");
      const requests = await request(uid("seller"), "GET", "/message-requests");
      assert.ok(requests.data.items.some((row: any) => row.id === conversationId));
      assert.equal((await request(uid("seller"), "POST", `/message-requests/${conversationId}/respond`, {accept: true})).status, 200);
      assert.equal((await request(uid("outsider"), "GET", `/conversations/${conversationId}`)).status, 403);
      assert.equal(
        (
          await request(
            uid("outsider"),
            "GET",
            `/conversations/${conversationId}/messages`,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("outsider"),
            "POST",
            `/conversations/${conversationId}/messages`,
            { text: "Injected" },
            "outsider_key",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "POST",
            `/conversations/${conversationId}/messages`,
            { text: "Hello" },
          )
        ).status,
        400,
      );
      const first = await request(
        uid("buyer"),
        "POST",
        `/conversations/${conversationId}/messages`,
        { text: "Hello" },
        "message_key_01",
      );
      assert.equal(first.status, 201);
      assert.equal(
        (
          await request(
            uid("buyer"),
            "POST",
            `/conversations/${conversationId}/messages`,
            { text: "Hello" },
            "message_key_01",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "POST",
            `/conversations/${conversationId}/messages`,
            { text: "Different" },
            "message_key_01",
          )
        ).status,
        409,
      );
      const messages = await request(
        uid("seller"),
        "GET",
        `/conversations/${conversationId}/messages`,
      );
      assert.equal(messages.data.items.length, 1);
      assert.deepEqual(
        messages.data.items[0]._member_ids,
        [uid("buyer"), uid("seller")].sort(),
      );
      for (let index = 1; index <= 4; index++) {
        await seed("messages", uid(`older_test_message_${index}`), {
          conversation_id: conversationId,
          sender_id: uid("buyer"),
          body: `Tin ${index}`,
          sent_at: `2099-01-0${index}T00:00:00.000Z`,
          _member_ids: [uid("buyer"), uid("seller")].sort(),
        });
      }
      const newest = await request(uid("seller"), "GET", `/conversations/${conversationId}/messages?newest=1&limit=2`);
      assert.deepEqual(newest.data.items.map((item: { body: string }) => item.body), ["Tin 4", "Tin 3"]);
      const older = await request(uid("seller"), "GET",
        `/conversations/${conversationId}/messages?newest=1&limit=2&cursor=${newest.data.next_cursor}`);
      assert.deepEqual(older.data.items.map((item: { body: string }) => item.body), ["Tin 2", "Tin 1"]);
      assert.equal((await request(uid("seller"), "GET",
        `/conversations/${conversationId}/messages?newest=1&limit=2&cursor=${older.data.next_cursor}`)).data.items[0].body,
      "Hello");
      await seed("orders", uid("wrong_order"), {
        buyer_id: uid("buyer"),
        seller_id: uid("outsider"),
        status: "PAID",
      });
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/conversations", {
            member_id: uid("seller"),
            order_id: uid("wrong_order"),
          })
        ).status,
        403,
      );
      const friendMembers = [uid("buyer"), uid("outsider")].sort();
      await ctx.db.collection("conversations").doc(sha(JSON.stringify([friendMembers, null]))).set({
        id: sha(JSON.stringify([friendMembers, null])), member_a_id: friendMembers[0], member_b_id: friendMembers[1],
        _member_ids: friendMembers, order_id: null, status: "PENDING", request_sender_id: uid("buyer"),
        request_recipient_id: uid("outsider"), created_at: clock,
      });
      await ctx.db.collection("interactions").doc(sha(`friend:${friendMembers.join(":")}`)).set({status: "ACCEPTED"});
      const promoted = await request(uid("buyer"), "POST", "/conversations", {member_id: uid("outsider")});
      assert.equal(promoted.status, 200);
      assert.equal(promoted.data.status, "ACCEPTED", "accepted friendship promotes the existing pending chat");
      assert.equal(promoted.data.request_recipient_id, null);
      const rejected = await request(uid("buyer"), "POST", "/conversations", {member_id: uid("moderator")});
      assert.equal(rejected.status, 201);
      assert.equal((await request(uid("moderator"), "POST", `/message-requests/${rejected.data.id}/respond`, {accept: false})).status, 200);
      assert.equal((await request(uid("buyer"), "GET", `/conversations/${rejected.data.id}`)).status, 403);
      assert.equal((await request(uid("buyer"), "GET", `/conversations/${rejected.data.id}/messages`)).status, 403);
      assert.equal((await request(uid("buyer"), "POST", `/conversations/${rejected.data.id}/messages`, {text: "Still there?"}, "declined_key")).status, 403);
      assert.equal((await request(uid("buyer"), "GET", "/conversations")).data.items.some((row: any) => row.id === rejected.data.id), false);
      assert.equal((await request(uid("buyer"), "POST", "/conversations", {member_id: uid("moderator")})).status, 409);
    });

    it("shares published posts only with friends and preserves the post link in chat", async () => {
      const buyerId = uid("buyer"), sellerId = uid("seller");
      const members = [buyerId, sellerId].sort();
      await seed("interactions", sha(`friend:${members.join(":")}`), {
        type: "FRIEND_REQUEST", user_id: buyerId, target_user_id: sellerId,
        _member_ids: members, status: "ACCEPTED",
      });
      const conversation = await request(buyerId, "POST", "/conversations", {member_id: sellerId});
      assert.ok([200, 201].includes(conversation.status));
      assert.equal(conversation.data.status, "ACCEPTED");
      const contentId = uid("shared_post");
      await seed("content_entries", contentId, {
        author_id: sellerId, kind: "POST", status: "PUBLISHED",
        title: "Tái chế chai nhựa", body: "Một cách tái chế hữu ích",
      });
      const path = `/conversations/${conversation.data.id}/messages`;
      const shared = await request(buyerId, "POST", path, {content_id: contentId}, "share_key_01");
      assert.equal(shared.status, 201);
      assert.equal(shared.data.content_id, contentId);
      assert.equal(shared.data.content_kind, "POST");
      assert.match(shared.data.body, /Tái chế chai nhựa/);
      assert.equal((await request(buyerId, "POST", path, {content_id: contentId}, "share_key_01")).data.id, shared.data.id);
      assert.equal((await request(buyerId, "POST", path, {body: "Different"}, "share_key_01")).status, 409);
      const inbox = await request(sellerId, "GET", path);
      assert.ok(inbox.data.items.some((item: any) => item.id === shared.data.id && item.content_id === contentId));

      const legacyFriendId = uid("legacy_friend");
      await seed("users", legacyFriendId, {display_name: "Legacy friend", role: "MEMBER", status: "ACTIVE"});
      const legacyMembers = [buyerId, legacyFriendId].sort();
      await seed("interactions", sha(`friend:${legacyMembers.join(":")}`), {
        type: "FRIEND_REQUEST", user_id: buyerId, target_user_id: legacyFriendId,
        _member_ids: legacyMembers, status: "ACCEPTED",
      });
      const legacyConversationId = sha(JSON.stringify([legacyMembers, null]));
      await seed("conversations", legacyConversationId, {
        member_a_id: legacyMembers[0], member_b_id: legacyMembers[1],
        _member_ids: legacyMembers, order_id: null, created_at: clock,
      });
      const upgraded = await request(buyerId, "POST", "/conversations", {member_id: legacyFriendId});
      assert.equal(upgraded.status, 200);
      assert.equal(upgraded.data.status, "ACCEPTED", "an older chat without status must be promoted for friends");
      const legacyShare = await request(buyerId, "POST", `/conversations/${legacyConversationId}/messages`,
        {content_id: contentId}, "share_legacy_key");
      assert.equal(legacyShare.status, 201);
      assert.equal((await request(legacyFriendId, "GET",
        `/conversations/${legacyConversationId}/messages`)).data.items[0].content_id, contentId);

      await seed("content_entries", uid("draft_to_share"), {
        author_id: sellerId, kind: "POST", status: "DRAFT", body: "Unpublished",
      });
      assert.equal((await request(buyerId, "POST", path,
        {content_id: uid("draft_to_share")}, "share_draft_key")).status, 404);
      const strangerId = uid("share_stranger");
      await seed("users", strangerId, {display_name: "Stranger", role: "MEMBER", status: "ACTIVE"});
      const pending = await request(buyerId, "POST", "/conversations", {member_id: strangerId});
      assert.equal(pending.status, 201);
      assert.equal((await request(buyerId, "POST", `/conversations/${pending.data.id}/messages`,
        {content_id: contentId}, "share_stranger_key")).status, 403);
    });

    it("validates interaction targets, prevents repeated saves and protects personal ledgers", async () => {
      await seed("listings", uid("listing"), {
        seller_id: uid("seller"),
        status: "APPROVED",
        kind: "SALE",
      });
      const body = { type: "SAVE", listing_id: uid("listing") };
      const saved = await request(uid("buyer"), "POST", "/interactions", body);
      assert.equal(saved.status, 201);
      assert.equal(
        (await request(uid("buyer"), "POST", "/interactions", body)).status,
        200,
      );
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/interactions", {
            ...body,
            target_user_id: uid("seller"),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/interactions", {
            type: "FOLLOW",
            target_user_id: uid("buyer"),
          })
        ).status,
        400,
      );
      await seed("content_entries", uid("article"), {
        author_id: uid("seller"),
        kind: "ARTICLE",
        status: "PUBLISHED",
      });
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/interactions", {
            type: "JOIN",
            content_id: uid("article"),
          })
        ).status,
        400,
      );
      await seed("content_entries", uid("ended"), {
        author_id: uid("seller"),
        kind: "EVENT",
        status: "PUBLISHED",
        ends_at: "2025-01-01T00:00:00.000Z",
      });
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/interactions", {
            type: "REGISTER",
            content_id: uid("ended"),
          })
        ).status,
        409,
      );
      await seed("content_entries", uid("closed_registration"), {
        author_id: uid("seller"),
        kind: "EVENT",
        status: "PUBLISHED",
        ends_at: "2027-01-01T00:00:00.000Z",
        metadata_json: JSON.stringify({
          registration_closes_at: "2026-10-01T00:00:00.000Z",
        }),
      });
      assert.equal(
        (
          await request(uid("buyer"), "POST", "/interactions", {
            type: "REGISTER",
            content_id: uid("closed_registration"),
          })
        ).status,
        409,
      );
      const only = await request(
        uid("buyer"),
        "GET",
        "/me/interactions?type=SAVE",
      );
      assert.equal(only.data.items.length, 1);
      assert.equal(
        (
          await request(
            uid("outsider"),
            "DELETE",
            `/interactions/${saved.data.id}`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "DELETE",
            `/interactions/${saved.data.id}`,
          )
        ).status,
        204,
      );
      await seed("green_ledger", uid("ledger"), {
        user_id: uid("buyer"),
        points: 20,
        reason: "Completed order",
        created_at: clock,
      });
      assert.equal(
        (await request(uid("outsider"), "GET", "/me/points")).data.items.length,
        0,
      );
      assert.equal(
        (await request(uid("buyer"), "GET", "/me/points")).data.items.length,
        1,
      );
    });

    it("atomically disputes paid orders and isolates financial reports from moderators", async () => {
      await seed("orders", uid("paid_order"), {
        buyer_id: uid("buyer"),
        seller_id: uid("seller"),
        status: "PAID",
        total_vnd: 50000,
      });
      const body = {
        order_id: uid("paid_order"),
        reason: "Product does not match the listing",
      };
      assert.equal(
        (await request(uid("outsider"), "POST", "/reports", body)).status,
        403,
      );
      const report = await request(uid("buyer"), "POST", "/reports", body);
      assert.equal(report.status, 201);
      assert.equal(
        (await ctx.db.collection("orders").doc(uid("paid_order")).get()).data()!
          .status,
        "DISPUTED",
      );
      assert.equal(
        (await request(uid("buyer"), "POST", "/reports", body)).status,
        200,
      );
      const reports = await request(uid("moderator"), "GET", "/admin/reports");
      assert.equal(reports.status, 200);
      assert.ok(reports.data.items.every((row: any) => !row.order_id));
      assert.equal(
        (
          await request(
            uid("moderator"),
            "POST",
            `/admin/reports/${report.data.id}/resolve`,
            { reason: "Handled" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("admin"),
            "POST",
            `/admin/reports/${report.data.id}/resolve`,
            {
              status: "RESOLVED",
              reason: "Reviewed; financial resolution handled separately",
            },
          )
        ).status,
        200,
      );
      assert.equal(
        (await ctx.db.collection("orders").doc(uid("paid_order")).get()).data()!
          .status,
        "DISPUTED",
      );
    });

    it("accepts community post reports and prevents authors from reviewing reports about their own posts", async () => {
      const contentId = uid("reported_post");
      await seed("content_entries", contentId, {
        author_id: uid("moderator"), kind: "POST", status: "PUBLISHED", body: "Published post",
      });
      const body = {content_id: contentId, reason: "Spam hoặc lừa đảo"};
      assert.equal((await request(uid("moderator"), "POST", "/reports", body)).status, 400);

      const report = await request(uid("buyer"), "POST", "/reports", body);
      assert.equal(report.status, 201);
      assert.equal(report.data.content_id, contentId);
      assert.equal((await request(uid("buyer"), "POST", "/reports", body)).status, 200);

      const queue = await request(uid("moderator"), "GET", "/admin/reports?status=OPEN");
      assert.equal(queue.status, 200);
      assert.ok(queue.data.items.some((row: any) => row.content_id === contentId));
      assert.equal((await request(uid("moderator"), "POST", `/admin/reports/${report.data.id}/resolve`, {
        status: "RESOLVED", reason: "Reviewed",
      })).status, 403);
      assert.equal((await request(uid("admin"), "POST", `/admin/reports/${report.data.id}/resolve`, {
        status: "RESOLVED", reason: "Reviewed by admin",
      })).status, 200);
    });

    it("publishes one review per participant only after completion and strips private order identifiers", async () => {
      await seed("orders", uid("completed_order"), {
        buyer_id: uid("buyer"),
        seller_id: uid("seller"),
        status: "COMPLETED",
      });
      const path = `/orders/${uid("completed_order")}/reviews`;
      const body = { rating: 5, body: "Excellent reuse purchase" };
      assert.equal(
        (await request(uid("outsider"), "POST", path, body)).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("buyer"),
            "POST",
            `/orders/${uid("paid_order")}/reviews`,
            body,
          )
        ).status,
        409,
      );
      assert.equal(
        (await request(uid("buyer"), "POST", path, { ...body, rating: 6 }))
          .status,
        400,
      );
      assert.equal(
        (await request(uid("buyer"), "POST", path, body)).status,
        201,
      );
      assert.equal(
        (await request(uid("buyer"), "POST", path, body)).status,
        200,
      );
      assert.equal(
        (
          await request(uid("buyer"), "POST", path, {
            rating: 4,
            body: "Changed",
          })
        ).status,
        409,
      );
      const publicReviews = await request(
        null,
        "GET",
        `/users/${uid("seller")}/reviews`,
      );
      assert.equal(publicReviews.status, 200);
      assert.equal(publicReviews.data.items.length, 1);
      assert.equal("order_id" in publicReviews.data.items[0], false);
      assert.equal("email" in publicReviews.data.items[0], false);
    });
  },
);
