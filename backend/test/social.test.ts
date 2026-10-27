import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ZodError } from "zod";
import { ApiError, type Context } from "../src/core.js";
import { registerSocialRoutes } from "../src/social.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const prefix = `social_${randomUUID().replaceAll("-", "")}`;
const uid = (name: string) => `${prefix}_${name}`;

describe("Community posts, reactions, comments, friends, notifications and private scans", {skip: !enabled, concurrency: false}, () => {
  let firebase: App, ctx: Context, server: Server, base: string;
  let postId: string, tipId: string, friendship: string;
  let nextKey = 0;
  async function request(who: string | null, method: string, path: string, body?: unknown, key?: string) {
    const response = await fetch(`${base}${path}`, {method, headers: {
      ...(who ? {"X-Test-User": who} : {}), ...(body !== undefined ? {"Content-Type": "application/json"} : {}),
      "Idempotency-Key": key ?? `${prefix}_${++nextKey}`,
    }, ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
    const raw = await response.text();
    return {status: response.status, data: raw ? JSON.parse(raw) : null};
  }
  before(async () => {
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(host.hostname));
    firebase = initializeApp({projectId: "demo-recycling-share", storageBucket: "demo-recycling-share.appspot.com"}, prefix);
    ctx = {db: getFirestore(firebase), auth: getAuth(firebase), bucket: getStorage(firebase).bucket(), now: () => new Date().toISOString(), emulator: true};
    for (const [name, role] of [["author", "MEMBER"], ["reader", "MEMBER"], ["other", "MEMBER"], ["challenger", "MEMBER"], ["post_challenger", "MEMBER"], ["moderator", "MODERATOR"], ["admin", "ADMIN"]]) {
      await ctx.db.collection("users").doc(uid(name!)).set({id: uid(name!), role, status: "ACTIVE", display_name: name,
        email: `${name}@private.test`, phone: "0900000000", city: "Huế", bio: "Sống xanh", avatar_key: null});
    }
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      const userId = req.get("X-Test-User");
      if (!userId) return next();
      void ctx.db.collection("users").doc(userId).get().then((row) => {
        if (row.exists) res.locals.actor = {uid: userId, role: row.data()!.role, status: row.data()!.status};
        next();
      }).catch(next);
    });
    registerSocialRoutes(app, ctx);
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      if (error instanceof ApiError) res.status(error.status).json({error: error.code});
      else if (error instanceof ZodError) res.status(400).json({error: "VALIDATION_ERROR"});
      else res.status(500).json({error: String(error)});
    };
    app.use(errors);
    server = await new Promise<Server>((resolve) => {const running = app.listen(0, "127.0.0.1", () => resolve(running));});
    const address = server.address(); assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (ctx) {
      const ids = ["author", "reader", "other", "challenger", "post_challenger", "moderator", "admin"].map(uid);
      const [entries, interactions] = await Promise.all([
        ctx.db.collection("content_entries").where("author_id", "in", ids).get(),
        ctx.db.collection("interactions").where("user_id", "in", ids).get(),
      ]);
      const batch = ctx.db.batch();
      for (const row of [...entries.docs, ...interactions.docs]) batch.delete(row.ref);
      for (const id of ids) batch.delete(ctx.db.collection("users").doc(id));
      await batch.commit();
    }
    if (firebase) await deleteApp(firebase);
  });
  it("persists posts and tips separately, validates metadata and prevents duplicate submissions", async () => {
    const body = {body: "Làm chậu cây từ chai nhựa đã dùng.", materials: ["Nhựa"], weight_kg: 1.5, tags: ["DIY", "ZeroWaste"]};
    const key = `${prefix}_post_key`;
    const created = await request(uid("author"), "POST", "/posts", body, key);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    postId = created.data.id;
    assert.equal(created.data.kind, "POST");
    assert.equal(created.data.status, "PUBLISHED");
    assert.deepEqual(created.data.materials, ["Nhựa"]);
    assert.equal(created.data.author.email, undefined);
    assert.equal((await ctx.db.collection("content_entries").doc(postId).get()).data()!.body, body.body);
    const repeated = await request(uid("author"), "POST", "/posts", body, key);
    assert.equal(repeated.status, 200); assert.equal(repeated.data.id, postId);
    assert.equal((await request(uid("author"), "POST", "/posts", {body: "Khác"}, key)).status, 409);
    assert.equal((await request(uid("author"), "POST", "/posts", {body: "x".repeat(501)})).status, 400);
    assert.equal((await request(null, "POST", "/posts", body)).status, 401);
    const tip = await request(uid("author"), "POST", "/tips", {body: "Rửa sạch chai trước khi tái chế.", title: "Mẹo nhỏ"});
    assert.equal(tip.status, 201, JSON.stringify(tip.data)); tipId = tip.data.id;
    const posts = await request(null, "GET", `/posts?author_id=${uid("author")}`);
    assert.ok(posts.data.items.some((row: any) => row.id === postId));
    assert.ok(posts.data.items.every((row: any) => row.kind === "POST"));
    assert.ok(!posts.data.items.some((row: any) => row.id === tipId));
    const tips = await request(null, "GET", `/tips?author_id=${uid("author")}`);
    assert.ok(tips.data.items.some((row: any) => row.id === tipId));
  });
  it("enforces authorship and returns the full persisted post without exposing private profile data", async () => {
    assert.equal((await request(uid("reader"), "PATCH", `/posts/${postId}`, {body: "Hijack"})).status, 403);
    const edited = await request(uid("author"), "PATCH", `/posts/${postId}`, {body: "Chậu cây tái chế đã hoàn thành.", tags: ["DIY"]});
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    const detail = await request(null, "GET", `/posts/${postId}`);
    assert.equal(detail.data.body, "Chậu cây tái chế đã hoàn thành.");
    assert.equal(detail.data.author.id, uid("author"));
    assert.equal(detail.data.author.email, undefined);
    assert.equal(detail.data.author.phone, undefined);
    assert.equal((await request(null, "GET", `/tips/${postId}`)).status, 404);
  });
  it("counts concurrent likes once per user, persists red-heart/yellow-save state, and reverses it idempotently", async () => {
    const repeated = await Promise.all(Array.from({length: 6}, () => request(uid("reader"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: true})));
    assert.ok(repeated.every((response) => response.status === 200), JSON.stringify(repeated));
    assert.equal((await request(uid("other"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: true})).data.like_count, 2);
    const reader = await request(uid("reader"), "GET", `/posts/${postId}`);
    assert.equal(reader.data.liked, true); assert.equal(reader.data.like_count, 2);
    const outsider = await request(null, "GET", `/posts/${postId}`); assert.equal(outsider.data.liked, false);
    const save = await request(uid("reader"), "PUT", `/posts/${postId}/reactions/SAVE`, {active: true});
    assert.equal(save.status, 200); assert.equal(save.data.saved_count, 1);
    const saved = await request(uid("reader"), "GET", "/posts?saved=true");
    assert.ok(saved.data.items.some((row: any) => row.id === postId && row.saved));
    assert.equal((await request(null, "GET", "/posts?saved=true")).status, 401);
    const removed = await Promise.all(Array.from({length: 4}, () => request(uid("reader"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: false})));
    assert.ok(removed.every((response) => response.status === 200));
    const row = (await ctx.db.collection("content_entries").doc(postId).get()).data()!;
    assert.equal(row.like_count, 1); assert.equal(row.saved_count, 1);
    assert.equal((await request(uid("reader"), "PUT", `/posts/${postId}/reactions/SHARE`, {active: true})).status, 400);
  });
  it("preserves omitted post and tip metadata on PATCH and rejects an empty update", async () => {
    for (const [path, id] of [["posts", postId], ["tips", tipId]]) {
      const meta = {materials: ["Nhựa", "Kim loại"], weight_kg: 2.75, tags: ["DIY", "ZeroWaste"]};
      assert.equal((await request(uid("author"), "PATCH", `/${path}/${id}`, meta)).status, 200);
      const bodyOnly = await request(uid("author"), "PATCH", `/${path}/${id}`, {body: "Đã sửa nội dung, giữ nguyên phân loại và cân nặng."});
      assert.equal(bodyOnly.status, 200, JSON.stringify(bodyOnly.data));
      for (const field of ["materials", "weight_kg", "tags"] as const) assert.deepEqual(bodyOnly.data[field], meta[field]);
      assert.equal((await request(uid("author"), "PATCH", `/${path}/${id}`, {})).status, 400);
      const stored = (await ctx.db.collection("content_entries").doc(id!).get()).data()!;
      for (const field of ["materials", "weight_kg", "tags"] as const) assert.deepEqual(stored[field], meta[field]);
      // Explicit clears remain intentional and supported.
      const clear = await request(uid("author"), "PATCH", `/${path}/${id}`, {weight_kg: null, tags: []});
      assert.equal(clear.status, 200); assert.equal(clear.data.weight_kg, null); assert.deepEqual(clear.data.tags, []);
      assert.deepEqual(clear.data.materials, meta.materials);
    }
  });
  it("persists full comments and sends one notification even when a submission is retried concurrently", async () => {
    const key = `${prefix}_comment_key`;
    const responses = await Promise.all(Array.from({length: 4}, () => request(uid("reader"), "POST", `/posts/${postId}/comments`, {body: "Ý tưởng hay!"}, key)));
    assert.ok(responses.every((response) => [200, 201].includes(response.status)), JSON.stringify(responses));
    assert.equal(new Set(responses.map((response) => response.data.id)).size, 1);
    assert.equal((await ctx.db.collection("content_entries").doc(postId).get()).data()!.comment_count, 1);
    const comments = await request(null, "GET", `/posts/${postId}/comments`);
    assert.equal(comments.data.items.length, 1);
    assert.equal(comments.data.items[0].body, "Ý tưởng hay!"); assert.equal(comments.data.items[0].author.id, uid("reader"));
    assert.equal(comments.data.items[0].author.email, undefined);
    const commentId = comments.data.items[0].id;
    const likePath = `/posts/${postId}/comments/${commentId}/reactions/LIKE`;
    assert.equal(comments.data.items[0].like_count, 0);
    assert.equal((await request(uid("other"), "PUT", likePath, {active: true})).data.like_count, 1);
    assert.equal((await request(uid("other"), "PUT", likePath, {active: true})).data.like_count, 1);
    assert.equal((await request(uid("other"), "GET", `/posts/${postId}/comments`)).data.items[0].liked, true);
    assert.equal((await request(null, "GET", `/posts/${postId}/comments`)).data.items[0].liked, false);
    assert.equal((await request(uid("other"), "PUT", `/tips/${tipId}/comments/${commentId}/reactions/LIKE`, {active: true})).status, 404);
    assert.equal((await request(uid("other"), "PUT", likePath, {active: false})).data.like_count, 0);
    assert.equal((await request(uid("reader"), "POST", `/posts/${postId}/comments`, {body: "Nội dung khác"}, key)).status, 409);
    const reply = await request(uid("other"), "POST", `/posts/${postId}/comments`,
      {body: "Mình cũng muốn thử!", parent_comment_id: comments.data.items[0].id}, `${prefix}_reply_key`);
    assert.equal(reply.status, 201, JSON.stringify(reply.data));
    assert.equal(reply.data.parent_comment_id, comments.data.items[0].id);
    assert.equal((await request(uid("other"), "POST", `/tips/${tipId}/comments`,
      {body: "Sai bài", parent_comment_id: comments.data.items[0].id})).status, 404);
    const notifications = await request(uid("author"), "GET", "/notifications");
    assert.equal(notifications.data.items.filter((row: any) => row.subtype === "COMMENT").length, 1);
    assert.ok(notifications.data.unread_count >= 3);
    assert.ok(notifications.data.items.some((row: any) => row.subtype === "LIKE" && row.content_id === postId));
    assert.ok(notifications.data.items.every((row: any) => row.subtype !== "SAVE"));
    await ctx.db.collection("interactions").doc(responses[0]!.data.id).update({status: "HIDDEN"});
    assert.equal((await request(null, "GET", `/posts/${postId}/comments`)).data.items.length, 0);
    assert.equal((await request(uid("reader"), "POST", `/tips/${tipId}/comments`, {body: "Cảm ơn mẹo hay"})).status, 201);
  });
  it("awards each published challenge exactly once and makes tips, challenges and market listings searchable", async () => {
    const challengeId = uid("challenge");
    await ctx.db.collection("content_entries").doc(challengeId).set({id: challengeId, kind: "CHALLENGE", status: "PUBLISHED",
      author_id: uid("admin"), title: "Thử thách trồng cây", body: "Tái sử dụng chai nhựa để trồng một cây xanh.",
      starts_at: null, ends_at: null, metadata_json: JSON.stringify({target: 1, unit: "cây", reward_points: 25}),
      created_at: ctx.now(), updated_at: ctx.now()});
    const first = await request(uid("reader"), "POST", `/challenges/${challengeId}/complete`, {}, `${prefix}_challenge_complete`);
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(first.data.points, 25); assert.equal(first.data.balance, 25);
    const retry = await request(uid("reader"), "POST", `/challenges/${challengeId}/complete`, {}, `${prefix}_challenge_retry`);
    assert.equal(retry.status, 200); assert.equal(retry.data.balance, 25);
    assert.equal((await ctx.db.collection("green_ledger").where("content_id", "==", challengeId).get()).size, 1);
    const feed = await request(uid("reader"), "GET", "/challenges?limit=10");
    assert.ok(feed.data.items.some((row: any) => row.id === challengeId && row.completed && row.reward_points === 25));
    const search = await request(null, "GET", "/explore/search?q=tr%E1%BB%93ng%20c%C3%A2y&limit=20");
    assert.ok(search.data.items.some((row: any) => row.id === challengeId && row.kind === "CHALLENGE"));
    const signedInSearch = await request(uid("reader"), "GET", "/explore/search?q=tr%E1%BB%93ng%20c%C3%A2y&limit=20");
    assert.ok(signedInSearch.data.items.some((row: any) => row.id === challengeId && row.completed && row.reward_points === 25));
  });
  it("checks the like-and-comment requirement against the same published post before awarding challenge points", async () => {
    const challengeId = uid("challenge_like_comment");
    await ctx.db.collection("content_entries").doc(challengeId).set({id: challengeId, kind: "CHALLENGE", status: "PUBLISHED",
      author_id: uid("admin"), title: "Tương tác xanh", body: "Thả tim và bình luận cùng một bài chia sẻ công khai.",
      starts_at: null, ends_at: null, metadata_json: JSON.stringify({reward_points: 100, requirement_type: "LIKE_AND_COMMENT"}),
      created_at: ctx.now(), updated_at: ctx.now()});
    const locked = await request(uid("challenger"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(locked.status, 409);
    assert.equal(locked.data.error, "CHALLENGE_REQUIREMENT_NOT_MET");
    await request(uid("challenger"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: true});
    await request(uid("challenger"), "POST", `/posts/${postId}/comments`, {body: "Bài viết tái chế hữu ích quá!"});
    const completed = await request(uid("challenger"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(completed.status, 201, JSON.stringify(completed.data));
    assert.equal(completed.data.points, 100);
    assert.equal((await request(uid("challenger"), "POST", `/challenges/${challengeId}/complete`, {})).data.balance, 100);
  });
  it("requires a current approved verification record before rewarding the verification challenge", async () => {
    const challengeId = uid("challenge_verification");
    const verificationId = uid("verification");
    await ctx.db.collection("content_entries").doc(challengeId).set({id: challengeId, kind: "CHALLENGE", status: "PUBLISHED",
      author_id: uid("admin"), title: "Xác thực tài khoản", body: "Gửi giấy tờ và chờ quản trị viên duyệt xác minh.",
      starts_at: null, ends_at: null, metadata_json: JSON.stringify({reward_points: 100, requirement_type: "VERIFIED_ACCOUNT"}),
      created_at: ctx.now(), updated_at: ctx.now()});
    const locked = await request(uid("reader"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(locked.status, 409);
    assert.equal(locked.data.error, "CHALLENGE_REQUIREMENT_NOT_MET");
    await ctx.db.collection("verifications").doc(verificationId).set({id: verificationId, user_id: uid("reader"), status: "VERIFIED", expires_at: "2999-01-01T00:00:00.000Z"});
    await ctx.db.collection("users").doc(uid("reader")).update({_verification_id: verificationId});
    const completed = await request(uid("reader"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(completed.status, 201, JSON.stringify(completed.data));
    assert.equal(completed.data.points, 100);
    await ctx.db.collection("verifications").doc(verificationId).delete();
    await ctx.db.collection("users").doc(uid("reader")).update({_verification_id: null});
  });
  it("requires a published post and a like on another member's published post", async () => {
    const challengeId = uid("challenge_post_like");
    await ctx.db.collection("content_entries").doc(challengeId).set({id: challengeId, kind: "CHALLENGE", status: "PUBLISHED",
      author_id: uid("admin"), title: "Bài viết xanh", body: "Đăng bài và thả tim bài viết của một thành viên khác.",
      starts_at: null, ends_at: null, metadata_json: JSON.stringify({reward_points: 150, requirement_type: "POST_WITH_LIKE"}),
      created_at: ctx.now(), updated_at: ctx.now()});
    const ownPost = await request(uid("post_challenger"), "POST", "/posts", {body: "Ý tưởng tái chế mới của mình."});
    assert.equal(ownPost.status, 201, JSON.stringify(ownPost.data));
    await request(uid("post_challenger"), "PUT", `/posts/${ownPost.data.id}/reactions/LIKE`, {active: true});
    const ownLike = await request(uid("post_challenger"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(ownLike.status, 409);
    assert.equal(ownLike.data.error, "CHALLENGE_REQUIREMENT_NOT_MET");
    await request(uid("post_challenger"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: true});
    const completed = await request(uid("post_challenger"), "POST", `/challenges/${challengeId}/complete`, {});
    assert.equal(completed.status, 201, JSON.stringify(completed.data));
    assert.equal(completed.data.points, 150);
  });
  it("keeps batched challenge completion flags separate for each viewer", async () => {
    const [reader, challenger, anonymous] = await Promise.all([
      request(uid("reader"), "GET", "/challenges?limit=100"),
      request(uid("challenger"), "GET", "/challenges?limit=100"),
      request(null, "GET", "/challenges?limit=100"),
    ]);
    const completion = (response: any, suffix: string) => response.data.items.find((row: any) => row.id === uid(suffix))?.completed;
    assert.equal(completion(reader, "challenge_verification"), true);
    assert.equal(completion(reader, "challenge_like_comment"), false);
    assert.equal(completion(challenger, "challenge_verification"), false);
    assert.equal(completion(challenger, "challenge_like_comment"), true);
    assert.equal(completion(anonymous, "challenge_verification"), false);
    assert.equal(completion(anonymous, "challenge_like_comment"), false);
  });
  it("keeps each story author correct when several stories share an author", async () => {
    const created = [];
    for (const author of ["author", "author", "reader"]) {
      const story = await request(uid(author), "POST", "/stories", {body: `Story by ${author}`, duration_ms: 10000});
      assert.equal(story.status, 201);
      created.push({ id: story.data.id, author });
    }
    const feed = await request(null, "GET", "/stories?limit=100");
    assert.equal(feed.status, 200);
    for (const expected of created) {
      const story = feed.data.items.find((row: any) => row.id === expected.id);
      assert.ok(story);
      assert.equal(story.author.id, uid(expected.author));
      assert.equal(story.author.display_name, expected.author);
      assert.equal(story.author.email, undefined);
      assert.deepEqual(story.media, []);
    }
  });
  it("protects notification ownership and persists individual/read-all status", async () => {
    const notifications = await request(uid("author"), "GET", "/notifications");
    const id = notifications.data.items[0].id;
    assert.equal((await request(uid("reader"), "POST", `/notifications/${id}/read`, {})).status, 404);
    assert.equal((await request(uid("author"), "POST", `/notifications/${id}/read`, {})).status, 200);
    assert.ok((await ctx.db.collection("interactions").doc(id).get()).data()!.read_at);
    assert.equal((await request(uid("author"), "POST", "/notifications/read-all", {})).status, 200);
    assert.equal((await request(uid("author"), "GET", "/notifications?limit=1")).data.unread_count, 0);
  });
  it("creates one friendship per pair, restricts acceptance to its recipient, and exposes no private user fields", async () => {
    assert.equal((await request(uid("reader"), "POST", "/friends/requests", {user_id: uid("reader")})).status, 400);
    const sent = await request(uid("reader"), "POST", "/friends/requests", {user_id: uid("author")});
    assert.equal(sent.status, 201, JSON.stringify(sent.data)); friendship = sent.data.id;
    assert.equal((await request(uid("reader"), "POST", "/friends/requests", {user_id: uid("author")})).data.id, friendship);
    assert.equal((await request(uid("author"), "POST", "/friends/requests", {user_id: uid("reader")})).status, 409);
    const requests = await request(uid("author"), "GET", "/friends?tab=requests");
    assert.ok(requests.data.items.some((row: any) => row.request_id === friendship && row.id === uid("reader")));
    assert.equal(requests.data.items[0].email, undefined);
    assert.equal((await request(uid("reader"), "POST", `/friends/requests/${friendship}/respond`, {accept: true})).status, 403);
    assert.equal((await request(uid("other"), "POST", `/friends/requests/${friendship}/respond`, {accept: true})).status, 403);
    const accepted = await Promise.all(Array.from({length: 3}, () => request(uid("author"), "POST", `/friends/requests/${friendship}/respond`, {accept: true})));
    assert.ok(accepted.every((response) => response.status === 200), JSON.stringify(accepted));
    const friends = await request(uid("reader"), "GET", "/friends?tab=friends&q=author");
    assert.ok(friends.data.items.some((row: any) => row.id === uid("author") && row.status === "ACCEPTED"));
    assert.ok((await request(uid("reader"), "GET", "/notifications")).data.items.some((row: any) => row.subtype === "FRIEND_ACCEPTED"));
    assert.equal((await request(uid("author"), "POST", `/friends/requests/${friendship}/respond`, {accept: false})).status, 409);
  });
  it("paginates newest posts and oldest comments without skipping equal timestamps", async () => {
    for (const [name, date] of [["a", "2026-10-18T01:00:00.000Z"], ["b", "2026-10-18T01:00:00.000Z"], ["c", "2026-10-18T02:00:00.000Z"]]) {
      const id = uid(`timeline_${name}`);
      await ctx.db.collection("content_entries").doc(id).set({id, kind: "POST", status: "PUBLISHED", author_id: uid("other"), title: name, body: name, created_at: date});
    }
    const first = await request(null, "GET", `/posts?author_id=${uid("other")}&limit=1`);
    assert.equal(first.data.items[0].id, uid("timeline_c")); assert.equal(first.data.next_cursor, uid("timeline_c"));
    const second = await request(null, "GET", `/posts?author_id=${uid("other")}&limit=1&cursor=${first.data.next_cursor}`);
    assert.equal(second.data.items[0].id, uid("timeline_a"));
    const third = await request(null, "GET", `/posts?author_id=${uid("other")}&limit=1&cursor=${second.data.next_cursor}`);
    assert.equal(third.data.items[0].id, uid("timeline_b")); assert.equal(third.data.next_cursor, null);
    const parent = uid("timeline_c");
    for (const [name, date] of [["a", "2026-10-18T01:00:00.000Z"], ["b", "2026-10-18T01:00:00.000Z"]]) {
      const id = uid(`timeline_comment_${name}`);
      await ctx.db.collection("interactions").doc(id).set({id, type: "COMMENT", status: "PUBLISHED", user_id: uid("reader"), content_id: parent, body: name, created_at: date});
    }
    const a = await request(null, "GET", `/posts/${parent}/comments?limit=1`);
    const b = await request(null, "GET", `/posts/${parent}/comments?limit=1&cursor=${a.data.next_cursor}`);
    assert.equal(a.data.items[0].body, "a"); assert.equal(b.data.items[0].body, "b"); assert.equal(b.data.next_cursor, null);
  });
  it("serves three-item feed pages with stable cursors and per-viewer reactions", async () => {
    for (let index = 0; index < 4; index++) {
      const id = uid(`feed_post_${index}`);
      await ctx.db.collection("content_entries").doc(id).set({
        id, kind: "POST", status: "PUBLISHED", author_id: uid("other"),
        title: `Feed ${index}`, body: `Feed ${index}`,
        created_at: `2026-10-17T0${index}:00:00.000Z`,
      });
    }
    const latest = uid("timeline_c");
    assert.equal((await request(uid("reader"), "PUT", `/posts/${latest}/reactions/LIKE`, {active: true})).status, 200);
    assert.equal((await request(uid("reader"), "PUT", `/posts/${latest}/reactions/SAVE`, {active: true})).status, 200);
    const expected = [latest, uid("timeline_a"), uid("timeline_b"), ...Array.from({length: 4}, (_, i) => uid(`feed_post_${3 - i}`))];
    let cursor: string | null = null;
    const seen: string[] = [];
    for (const pageSize of [3, 3, 1]) {
      const result = await request(uid("reader"), "GET", `/posts?author_id=${uid("other")}&limit=3${cursor ? `&cursor=${cursor}` : ""}`);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.items.length, pageSize);
      assert.ok(result.data.items.every((row: any) => row.kind === "POST" && row.author.email === undefined));
      seen.push(...result.data.items.map((row: any) => row.id));
      if (pageSize === 3) assert.equal(result.data.next_cursor, seen.at(-1));
      cursor = result.data.next_cursor;
    }
    assert.deepEqual(seen, expected);
    assert.equal(cursor, null);
    const first = await request(uid("reader"), "GET", `/posts?author_id=${uid("other")}&limit=3`);
    assert.equal(first.data.items[0].liked, true);
    assert.equal(first.data.items[0].saved, true);
    assert.ok(first.data.items.slice(1).every((row: any) => !row.liked && !row.saved));

    for (let index = 0; index < 4; index++) {
      const id = uid(`feed_tip_${index}`);
      await ctx.db.collection("content_entries").doc(id).set({
        id, kind: "TIP", status: "PUBLISHED", author_id: uid("other"),
        title: `Tip ${index}`, body: `Tip ${index}`,
        created_at: `2026-10-16T0${index}:00:00.000Z`,
      });
    }
    const tips = await request(null, "GET", `/tips?author_id=${uid("other")}&limit=3`);
    assert.equal(tips.status, 200);
    assert.equal(tips.data.items.length, 3);
    assert.ok(tips.data.next_cursor);
    const lastTip = await request(null, "GET", `/tips?author_id=${uid("other")}&limit=3&cursor=${tips.data.next_cursor}`);
    assert.equal(lastTip.data.items.length, 1);
    assert.equal(lastTip.data.next_cursor, null);
    assert.equal((await request(null, "GET", "/posts?limit=0")).status, 400);
  });
  it("keeps SCAN records private to their owner and admin, even if malformed status says PUBLISHED", async () => {
    const scan = await request(uid("reader"), "POST", "/scans", {note: "Ảnh chai nhựa của tôi"});
    assert.equal(scan.status, 201, JSON.stringify(scan.data));
    assert.equal(scan.data.kind, "SCAN"); assert.equal(scan.data.status, "PRIVATE");
    assert.equal((await request(uid("other"), "GET", `/scans/${scan.data.id}`)).status, 403);
    assert.equal((await request(uid("moderator"), "GET", `/scans/${scan.data.id}`)).status, 403);
    assert.equal((await request(null, "GET", `/scans/${scan.data.id}`)).status, 401);
    assert.equal((await request(uid("admin"), "GET", `/scans/${scan.data.id}`)).status, 200);
    assert.ok((await request(uid("reader"), "GET", "/scans")).data.items.some((row: any) => row.id === scan.data.id));
    assert.ok(!(await request(uid("other"), "GET", "/scans")).data.items.some((row: any) => row.id === scan.data.id));
    assert.equal((await request(uid("other"), "DELETE", `/scans/${scan.data.id}`)).status, 403);
    assert.equal((await request(uid("reader"), "DELETE", `/scans/${scan.data.id}`)).status, 204);
    assert.ok(!(await request(uid("reader"), "GET", "/scans")).data.items.some((row: any) => row.id === scan.data.id));
    assert.equal((await ctx.db.collection("content_entries").doc(scan.data.id).get()).data()!.status, "ARCHIVED");
    await ctx.db.collection("content_entries").doc(scan.data.id).update({status: "PUBLISHED"});
    assert.equal((await request(uid("other"), "GET", `/scans/${scan.data.id}`)).status, 403);
    assert.ok(!(await request(null, "GET", "/posts")).data.items.some((row: any) => row.id === scan.data.id));
  });
  it("honors moderation visibility and live suspended-account permissions", async () => {
    await ctx.db.collection("content_entries").doc(postId).update({status: "ARCHIVED"});
    assert.equal((await request(null, "GET", `/posts/${postId}`)).status, 404);
    assert.equal((await request(uid("reader"), "PUT", `/posts/${postId}/reactions/LIKE`, {active: true})).status, 404);
    assert.equal((await request(uid("reader"), "POST", `/posts/${postId}/comments`, {body: "No"})).status, 404);
    assert.equal((await request(uid("author"), "PATCH", `/posts/${postId}`, {body: "Reopen"})).status, 409);
    await ctx.db.collection("users").doc(uid("other")).update({status: "SUSPENDED"});
    assert.equal((await request(uid("other"), "POST", "/posts", {body: "Forbidden"})).status, 403);
    assert.equal((await request(uid("reader"), "POST", "/friends/requests", {user_id: uid("other")})).status, 404);
  });
});
