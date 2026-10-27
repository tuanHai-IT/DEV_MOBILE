import type { Request, Router } from "express";
import type { DocumentData, Query, Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import {
  actor, assertTransactionRole, asyncRoute, docData, idempotency, page,
  pathId, requireThat, sha, type Actor, type Context,
} from "./core.js";
import { listingPreviews } from "./marketplace.js";

const roles = ["MEMBER", "COLLECTOR", "MODERATOR", "ADMIN"];
const materials = z.array(z.string().trim().min(1).max(60)).max(12);
const tags = z.array(z.string().trim().min(1).max(40)).max(12);
const entryBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(500),
  materials: materials.default([]),
  weight_kg: z.number().min(0).max(100000).nullable().default(null),
  tags: tags.default([]),
}).strict();
// Create defaults must not run on PATCH: Zod 4 applies a nested default even
// inside optional(), which would erase omitted material/weight/tag metadata.
const entryPatch = z.object({
  title: entryBody.shape.title,
  body: entryBody.shape.body.optional(),
  materials: materials.optional(),
  weight_kg: z.number().min(0).max(100000).nullable().optional(),
  tags: tags.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const scanBody = z.object({
  title: z.string().trim().min(1).max(120).default("Ảnh SCAN"),
  note: z.string().trim().max(500).default(""),
}).strict();
const commentBody = z.object({body: z.string().trim().min(1).max(2000), parent_comment_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable().optional()}).strict();

export function socialReactionId(uid: string, type: "LIKE" | "SAVE", contentId: string): string {
  return sha(JSON.stringify([uid, type, "content", contentId, ""]));
}
async function requireChallengeAction(
  tx: Transaction,
  ctx: Context,
  uid: string,
  challenge: DocumentData,
  user: DocumentData,
): Promise<void> {
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(String(challenge.metadata_json ?? "{}")); } catch { /* invalid legacy content stays self-attested */ }
  const requirement = typeof metadata.requirement_type === "string" ? metadata.requirement_type : "SELF_ATTESTED";
  if (requirement === "VERIFIED_ACCOUNT") {
    if (typeof user._verification_id === "string") {
      const verification = (await tx.get(ctx.db.collection("verifications").doc(user._verification_id))).data();
      if (verification && verification.user_id === uid && verification.status === "VERIFIED" &&
        (!verification.expires_at || verification.expires_at > ctx.now())) return;
      requireThat(false, 409, "CHALLENGE_REQUIREMENT_NOT_MET", "Tài khoản cần được xác minh và còn hiệu lực để nhận điểm.");
    }
    requireThat(false, 409, "CHALLENGE_REQUIREMENT_NOT_MET", "Tài khoản cần được xác minh để nhận điểm.");
  }
  if (requirement === "LIKE_AND_COMMENT") {
    const [likes, comments] = await Promise.all([
      tx.get(ctx.db.collection("interactions").where("user_id", "==", uid).where("type", "==", "LIKE").limit(200)),
      tx.get(ctx.db.collection("interactions").where("user_id", "==", uid).where("type", "==", "COMMENT")
        .where("status", "==", "PUBLISHED").limit(200)),
    ]);
    const likedPosts = new Set(likes.docs.map(row => String(row.data().content_id ?? "")));
    const commentPosts = new Set(comments.docs.map(row => String(row.data().content_id ?? "")));
    const shared = [...likedPosts].filter(id => id && commentPosts.has(id));
    if (shared.length) {
      const posts = await tx.getAll(...shared.map(id => ctx.db.collection("content_entries").doc(id)));
      requireThat(posts.some(row => row.exists && row.data()?.kind === "POST" && row.data()?.status === "PUBLISHED"),
        409, "CHALLENGE_REQUIREMENT_NOT_MET", "Hãy thả tim và bình luận cùng một bài chia sẻ đang công khai.");
      return;
    }
    requireThat(false, 409, "CHALLENGE_REQUIREMENT_NOT_MET", "Hãy thả tim và bình luận cùng một bài chia sẻ đang công khai.");
  }
  if (requirement === "POST_WITH_LIKE") {
    const posts = await tx.get(ctx.db.collection("content_entries").where("author_id", "==", uid).where("kind", "==", "POST")
      .where("status", "==", "PUBLISHED").limit(100));
    const authoredPostIds = new Set(posts.docs.map(row => row.id));
    requireThat(authoredPostIds.size > 0, 409, "CHALLENGE_REQUIREMENT_NOT_MET",
      "Hãy đăng một bài chia sẻ tái chế công khai và thả tim bài viết công khai của thành viên khác để nhận điểm.");
    const likes = await tx.get(ctx.db.collection("interactions").where("user_id", "==", uid).where("type", "==", "LIKE").limit(200));
    const likedPostIds = [...new Set(likes.docs.map(row => String(row.data().content_id ?? "")))]
      .filter(id => id && !authoredPostIds.has(id));
    if (likedPostIds.length) {
      const targets = await tx.getAll(...likedPostIds.map(id => ctx.db.collection("content_entries").doc(id)));
      requireThat(targets.some(row => row.exists && row.data()?.kind === "POST" && row.data()?.status === "PUBLISHED" &&
        row.data()?.author_id !== uid), 409, "CHALLENGE_REQUIREMENT_NOT_MET",
      "Hãy đăng một bài chia sẻ tái chế công khai và thả tim bài viết công khai của thành viên khác để nhận điểm.");
      return;
    }
    requireThat(false, 409, "CHALLENGE_REQUIREMENT_NOT_MET",
      "Hãy đăng một bài chia sẻ tái chế công khai và thả tim một bài cộng đồng để nhận điểm.");
  }
}
function friendshipId(a: string, b: string): string {
  return sha(`friend:${[a, b].sort().join(":")}`);
}
function publicUser(row: DocumentData | undefined, uid: string) {
  return {
    id: uid,
    display_name: row?.status === "ACTIVE" ? row.display_name || "Thành viên EcoShare" : "Thành viên EcoShare",
    avatar_key: row?.status === "ACTIVE" ? row.avatar_key ?? null : null,
  };
}
function notification(tx: Transaction, ctx: Context, source: string, recipient: string,
  sender: string, subtype: string, body: string, contentId: string | null = null): void {
  if (recipient === sender) return;
  const ref = ctx.db.collection("interactions").doc(sha(`social:notification:${source}:${recipient}`));
  tx.set(ref, {
    id: ref.id, user_id: recipient, type: "NOTIFICATION", subtype,
    target_user_id: sender, content_id: contentId, listing_id: null,
    body, read_at: null, created_at: ctx.now(), _social: true,
  });
}
async function ensureReadable(ctx: Context, id: string, who: Actor | undefined, kind: string) {
  const row = docData(await ctx.db.collection("content_entries").doc(id).get());
  requireThat(row.kind === kind, 404, "NOT_FOUND", "Không tìm thấy nội dung.");
  const privateScan = kind === "SCAN";
  requireThat(
    privateScan
      ? who && (row.author_id === who.uid || who.role === "ADMIN")
      : row.status === "PUBLISHED" || (who && (row.author_id === who.uid || ["ADMIN", "MODERATOR"].includes(who.role))),
    privateScan ? 403 : 404, privateScan ? "SCAN_FORBIDDEN" : "NOT_FOUND", "Bạn không có quyền xem nội dung này.",
  );
  return row;
}
async function enrich(ctx: Context, rows: DocumentData[], who: Actor | undefined) {
  if (!rows.length) return [];
  const authorIds = [...new Set(rows.map((row) => row.author_id as string))];
  const reactionRefs = who ? rows.flatMap((row) => [
    ctx.db.collection("interactions").doc(socialReactionId(who.uid, "LIKE", row.id)),
    ctx.db.collection("interactions").doc(socialReactionId(who.uid, "SAVE", row.id)),
  ]) : [];
  // Every feed page is bounded by timeline(). Fetch independent author, media,
  // and reaction data in parallel instead of adding a second Firestore round trip.
  const [authors, assetsByRow, reactions] = await Promise.all([
    ctx.db.getAll(...authorIds.map((id) => ctx.db.collection("users").doc(id))),
    Promise.all(rows.map((row) => ctx.db.collection("media_assets")
      .where("content_id", "==", row.id).where("_status", "==", "READY")
      .limit(12).select("mime_type").get())),
    reactionRefs.length ? ctx.db.getAll(...reactionRefs) : Promise.resolve([]),
  ]);
  const authorMap = new Map(authors.map((row) => [row.id, row.data()]));
  return rows.map((row, index) => {
    const assets = assetsByRow[index], like = reactions[index * 2], save = reactions[index * 2 + 1];
    return {
      id: row.id, kind: row.kind, title: row.title, body: row.body, status: row.status,
      author_id: row.author_id, author: publicUser(authorMap.get(row.author_id), row.author_id),
      materials: row.materials ?? [], weight_kg: row.weight_kg ?? null, tags: row.tags ?? [],
      created_at: row.created_at, updated_at: row.updated_at ?? row.created_at,
      like_count: row.like_count ?? 0, saved_count: row.saved_count ?? 0, comment_count: row.comment_count ?? 0,
      liked: Boolean(like?.exists), saved: Boolean(save?.exists),
      media: assets.docs.map((doc) => ({id: doc.id, mime_type: doc.data().mime_type, download_path: `/v1/media/${doc.id}/download`})),
    };
  });
}
async function enrichComments(ctx: Context, rows: DocumentData[], who?: Actor) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((row) => row.user_id as string))];
  const [users, likes] = await Promise.all([
    ctx.db.getAll(...ids.map((id) => ctx.db.collection("users").doc(id))),
    who ? ctx.db.getAll(...rows.map((row) => ctx.db.collection("interactions")
      .doc(sha(`social:comment-like:${who.uid}:${row.id}`)))) : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((row) => [row.id, row.data()]));
  return rows.map((row, index) => ({id: row.id, content_id: row.content_id,
    parent_comment_id: row.parent_comment_id ?? null, body: row.body,
    author: publicUser(userMap.get(row.user_id), row.user_id), created_at: row.created_at,
    like_count: row.like_count ?? 0, liked: Boolean(likes[index]?.exists)}));
}
function count(row: DocumentData, name: string, delta: number): number {
  return Math.max(0, (Number.isSafeInteger(row[name]) ? row[name] : 0) + delta);
}
function search(req: Request) {
  return z.string().trim().max(100).parse(req.query.q ?? "").toLocaleLowerCase("vi");
}
async function timeline(ctx: Context, collection: string, query: Query, req: Request, ascending = false) {
  const limit = z.coerce.number().int().min(1).max(100).parse(req.query.limit ?? 25);
  let ordered = query.orderBy("created_at", ascending ? "asc" : "desc").orderBy("__name__", "asc");
  if (req.query.cursor) {
    const cursor = await ctx.db.collection(collection).doc(pathId(req.query.cursor)).get();
    requireThat(cursor.exists && typeof cursor.data()!.created_at === "string", 400, "INVALID_CURSOR", "Trang dữ liệu không hợp lệ.");
    ordered = ordered.startAfter(cursor);
  }
  const snapshot = await ordered.limit(limit + 1).get(), rows = snapshot.docs.slice(0, limit);
  return {items: rows.map(docData), next_cursor: snapshot.size > limit ? rows.at(-1)!.id : null};
}

/** Community data uses ContentEntry and Interaction; it does not introduce extra domain collections. */
export function registerSocialRoutes(router: Router, ctx: Context): void {
  for (const [path, kind] of [["posts", "POST"], ["tips", "TIP"]] as const) {
    router.get(`/${path}`, asyncRoute(async (req, res) => {
      const author = req.query.author_id === undefined ? undefined : pathId(req.query.author_id);
      const saved = req.query.saved === undefined ? false : z.enum(["true", "false"]).parse(req.query.saved) === "true";
      if (saved) {
        const who = actor(res);
        const result = await timeline(ctx, "interactions", ctx.db.collection("interactions").where("user_id", "==", who.uid).where("type", "==", "SAVE"), req);
        const ids = result.items.map((row) => row.content_id).filter((id): id is string => typeof id === "string");
        const entries = ids.length ? await ctx.db.getAll(...ids.map((id) => ctx.db.collection("content_entries").doc(id))) : [];
        const rows = entries.filter((doc) => doc.exists).map(docData)
          .filter((row) => row.kind === kind && row.status === "PUBLISHED" && (!author || row.author_id === author));
        res.json({...result, items: await enrich(ctx, rows, who)});
        return;
      }
      let query: Query = ctx.db.collection("content_entries").where("kind", "==", kind).where("status", "==", "PUBLISHED");
      if (author) query = query.where("author_id", "==", author);
      const result = await timeline(ctx, "content_entries", query, req);
      res.json({...result, items: await enrich(ctx, result.items, res.locals.actor)});
    }));
    router.post(`/${path}`, asyncRoute(async (req, res) => {
      const who = actor(res), input = entryBody.parse(req.body), key = idempotency(req);
      const hash = sha(JSON.stringify(input));
      const ref = ctx.db.collection("content_entries").doc(sha(`social:${kind}:${who.uid}:${key}`));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, roles);
        const previous = await tx.get(ref);
        if (previous.exists) {
          requireThat(previous.data()!._request_hash === hash, 409, "IDEMPOTENCY_CONFLICT", "Khóa gửi bài đã dùng với nội dung khác.");
          return {row: docData(previous), created: false};
        }
        const row = {
          id: ref.id, author_id: who.uid, parent_id: null, kind, title: input.title ?? input.body.slice(0, 80),
          body: input.body, materials: [...new Set(input.materials)], weight_kg: input.weight_kg,
          tags: [...new Set(input.tags)], status: "PUBLISHED", created_at: ctx.now(), updated_at: ctx.now(),
          like_count: 0, saved_count: 0, comment_count: 0, starts_at: null, ends_at: null,
          points_cost: 0, metadata_json: "{}", _social: true, _request_hash: hash,
        };
        tx.create(ref, row);
        return {row, created: true};
      });
      res.status(result.created ? 201 : 200).json((await enrich(ctx, [result.row], who))[0]);
    }));
    router.get(`/${path}/:id`, asyncRoute(async (req, res) => {
      const who = res.locals.actor as Actor | undefined;
      res.json((await enrich(ctx, [await ensureReadable(ctx, pathId(req.params.id), who, kind)], who))[0]);
    }));
    router.patch(`/${path}/:id`, asyncRoute(async (req, res) => {
      const who = actor(res), input = entryPatch.parse(req.body);
      const ref = ctx.db.collection("content_entries").doc(pathId(req.params.id));
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, roles);
        const row = docData(await tx.get(ref));
        requireThat(row.kind === kind && row.author_id === who.uid, 403, "FORBIDDEN", "Chỉ tác giả được sửa bài.");
        requireThat(row.status !== "ARCHIVED", 409, "CONTENT_ARCHIVED", "Bài đã ẩn; liên hệ quản trị viên.");
        tx.update(ref, {...input, updated_at: ctx.now()});
      });
      res.json((await enrich(ctx, [docData(await ref.get())], who))[0]);
    }));
    router.delete(`/${path}/:id`, asyncRoute(async (req, res) => {
      const who = actor(res), ref = ctx.db.collection("content_entries").doc(pathId(req.params.id));
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, roles);
        const row = docData(await tx.get(ref));
        requireThat(row.kind === kind && row.author_id === who.uid, 403, "FORBIDDEN", "Chỉ tác giả được xóa bài.");
        tx.update(ref, {status: "ARCHIVED", updated_at: ctx.now()});
      });
      res.status(204).end();
    }));
    router.get(`/${path}/:id/comments`, asyncRoute(async (req, res) => {
      const contentId = pathId(req.params.id);
      await ensureReadable(ctx, contentId, res.locals.actor, kind);
      const result = await timeline(ctx, "interactions", ctx.db.collection("interactions").where("content_id", "==", contentId)
        .where("type", "==", "COMMENT").where("status", "==", "PUBLISHED"), req, true);
      const parentIds = [...new Set(result.items.map((row) => row.parent_comment_id).filter((id): id is string => typeof id === "string"))];
      const parents = parentIds.length ? await ctx.db.getAll(...parentIds.map((id) => ctx.db.collection("interactions").doc(id))) : [];
      const visibleParents = new Set(parents.filter((parent) => parent.exists && parent.data()?.type === "COMMENT" && parent.data()?.status === "PUBLISHED").map((parent) => parent.id));
      const visible = result.items.filter((row) => !row.parent_comment_id || visibleParents.has(row.parent_comment_id));
      res.json({...result, items: await enrichComments(ctx, visible, res.locals.actor as Actor | undefined)});
    }));
    router.post(`/${path}/:id/comments`, asyncRoute(async (req, res) => {
      const who = actor(res), contentId = pathId(req.params.id), input = commentBody.parse(req.body);
      const key = idempotency(req), hash = sha(JSON.stringify(input));
      const ref = ctx.db.collection("interactions").doc(sha(`social:comment:${who.uid}:${contentId}:${key}`));
      const parent = ctx.db.collection("content_entries").doc(contentId);
      const result = await ctx.db.runTransaction(async (tx) => {
        const currentUser = await assertTransactionRole(tx, ctx, who, roles);
        const parentCommentRef = input.parent_comment_id ? ctx.db.collection("interactions").doc(input.parent_comment_id) : null;
        const [parentSnap, previous, parentCommentSnap] = await Promise.all([
          tx.get(parent), tx.get(ref), parentCommentRef ? tx.get(parentCommentRef) : Promise.resolve(null),
        ]);
        const row = docData(parentSnap);
        requireThat(row.kind === kind && row.status === "PUBLISHED", 404, "NOT_FOUND", "Bài viết không còn công khai.");
        if (previous.exists) {
          requireThat(previous.data()!._request_hash === hash, 409, "IDEMPOTENCY_CONFLICT", "Khóa gửi bình luận đã dùng.");
          return {row: docData(previous), created: false};
        }
        const parentComment = parentCommentSnap?.exists ? parentCommentSnap.data() : undefined;
        requireThat(!parentCommentRef || (parentComment && parentComment.content_id === contentId && parentComment.type === "COMMENT" && parentComment.status === "PUBLISHED" && !parentComment.parent_comment_id),
          404, "COMMENT_NOT_FOUND", "Bình luận cần trả lời không còn tồn tại.");
        const comment = {id: ref.id, user_id: who.uid, type: "COMMENT", content_id: contentId,
          listing_id: null, target_user_id: null, parent_comment_id: input.parent_comment_id ?? null, body: input.body, status: "PUBLISHED", read_at: null,
          created_at: ctx.now(), like_count: 0, _request_hash: hash, _social: true};
        tx.create(ref, comment);
        tx.update(parent, {comment_count: count(row, "comment_count", 1)});
        const recipient = parentComment?.user_id ?? row.author_id;
        notification(tx, ctx, `comment:${ref.id}`, recipient, who.uid, input.parent_comment_id ? "COMMENT_REPLY" : "COMMENT",
          `${currentUser.display_name || "Một thành viên"} đã bình luận: ${input.body.slice(0, 140)}`, contentId);
        return {row: comment, created: true};
      });
      res.status(result.created ? 201 : 200).json((await enrichComments(ctx, [result.row], who))[0]);
    }));
    router.put(`/${path}/:id/comments/:commentId/reactions/LIKE`, asyncRoute(async (req, res) => {
      const who = actor(res), contentId = pathId(req.params.id), commentId = pathId(req.params.commentId);
      const input = z.object({active: z.boolean()}).strict().parse(req.body);
      const postRef = ctx.db.collection("content_entries").doc(contentId);
      const commentRef = ctx.db.collection("interactions").doc(commentId);
      const likeRef = ctx.db.collection("interactions").doc(sha(`social:comment-like:${who.uid}:${commentId}`));
      const result = await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, roles);
        const [postSnap, commentSnap, existing] = await Promise.all([
          tx.get(postRef), tx.get(commentRef), tx.get(likeRef),
        ]);
        const post = postSnap.data(), comment = commentSnap.data();
        requireThat(post?.kind === kind && post.status === "PUBLISHED" &&
          comment?.type === "COMMENT" && comment.status === "PUBLISHED" &&
          comment.content_id === contentId, 404, "COMMENT_NOT_FOUND", "Bình luận không còn tồn tại.");
        const changed = existing.exists !== input.active;
        const likeCount = count(comment, "like_count", changed ? (input.active ? 1 : -1) : 0);
        if (changed) {
          if (input.active) tx.create(likeRef, {id: likeRef.id, user_id: who.uid,
            type: "COMMENT_LIKE", content_id: contentId, parent_comment_id: commentId,
            listing_id: null, target_user_id: null, body: null, created_at: ctx.now(), _social: true});
          else tx.delete(likeRef);
          tx.update(commentRef, {like_count: likeCount});
        }
        return {active: input.active, like_count: likeCount};
      });
      res.json(result);
    }));
    router.put(`/${path}/:id/reactions/:type`, asyncRoute(async (req, res) => {
      const who = actor(res), contentId = pathId(req.params.id), type = z.enum(["LIKE", "SAVE"]).parse(req.params.type);
      const input = z.object({active: z.boolean()}).strict().parse(req.body);
      const ref = ctx.db.collection("interactions").doc(socialReactionId(who.uid, type, contentId));
      const parent = ctx.db.collection("content_entries").doc(contentId);
      const result = await ctx.db.runTransaction(async (tx) => {
        const currentUser = await assertTransactionRole(tx, ctx, who, roles);
        const [parentSnap, existing] = await Promise.all([tx.get(parent), tx.get(ref)]);
        const row = docData(parentSnap);
        requireThat(row.kind === kind && row.status === "PUBLISHED", 404, "NOT_FOUND", "Bài viết không còn công khai.");
        const changed = existing.exists !== input.active;
        const field = type === "LIKE" ? "like_count" : "saved_count";
        const value = count(row, field, changed ? (input.active ? 1 : -1) : 0);
        if (changed) {
          if (input.active) tx.create(ref, {id: ref.id, user_id: who.uid, type, content_id: contentId,
            listing_id: null, target_user_id: null, body: null, read_at: null, created_at: ctx.now(), _social: true});
          else tx.delete(ref);
          tx.update(parent, {[field]: value});
          if (type === "LIKE" && input.active) notification(tx, ctx, `like:${ref.id}`, row.author_id, who.uid,
            "LIKE", `${currentUser.display_name || "Một thành viên"} đã thích bài viết của bạn.`, contentId);
        }
        return {active: input.active, like_count: field === "like_count" ? value : row.like_count ?? 0,
          saved_count: field === "saved_count" ? value : row.saved_count ?? 0};
      });
      res.json(result);
    }));
  }
  router.get("/challenges", asyncRoute(async (req, res) => {
    const who = res.locals.actor as Actor | undefined;
    const result = await timeline(ctx, "content_entries", ctx.db.collection("content_entries")
      .where("kind", "==", "CHALLENGE").where("status", "==", "PUBLISHED"), req);
    const completions = who && result.items.length
      ? await ctx.db.getAll(...result.items.map(row => ctx.db.collection("interactions").doc(sha(`challenge:${who.uid}:${row.id}`))))
      : [];
    const items = result.items.map((row, index) => {
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(String(row.metadata_json ?? "{}")); } catch { /* legacy content */ }
      return {id: row.id, kind: row.kind, title: row.title, body: row.body, status: row.status,
        author_id: row.author_id, starts_at: row.starts_at ?? null, ends_at: row.ends_at ?? null,
        created_at: row.created_at, updated_at: row.updated_at ?? row.created_at,
        target: metadata.target ?? null, unit: metadata.unit ?? null,
        reward_points: typeof metadata.reward_points === "number" && Number.isSafeInteger(metadata.reward_points) ? metadata.reward_points : 0,
        completed: Boolean(completions[index]?.exists)};
    });
    res.json({...result, items});
  }));
  router.get("/stories", asyncRoute(async (req, res) => {
    const who = res.locals.actor as Actor | undefined;
    const result = await timeline(ctx, "content_entries", ctx.db.collection("content_entries")
      .where("kind", "==", "STORY").where("status", "==", "PUBLISHED"), req);
    const active = result.items.filter(row => typeof row.expires_at === "string" && row.expires_at > ctx.now());
    const authorIds = [...new Set(active.map(row => String(row.author_id)))];
    const [authors, media] = await Promise.all([
      authorIds.length ? ctx.db.getAll(...authorIds.map(id => ctx.db.collection("users").doc(id))) : Promise.resolve([]),
      Promise.all(active.map(row => ctx.db.collection("media_assets").where("content_id", "==", row.id).where("_status", "==", "READY").limit(1).get())),
    ]);
    const authorMap = new Map(authors.map(author => [author.id, author.data()]));
    res.json({...result, items: active.map((row, index) => {
      const assets = media[index];
      return {id: row.id, kind: "STORY", body: row.body, author_id: row.author_id,
        author: publicUser(authorMap.get(row.author_id), row.author_id), created_at: row.created_at, expires_at: row.expires_at,
        duration_ms: row.duration_ms ?? null,
        media: assets.docs.map(doc => ({id: doc.id, mime_type: doc.data().mime_type, download_path: `/v1/media/${doc.id}/download`}))};
    })});
  }));
  router.post("/stories", asyncRoute(async (req, res) => {
    const who = actor(res), input = z.object({body: z.string().trim().max(300).default(""), duration_ms: z.number().int().min(0).max(10000).default(0)}).strict().parse(req.body);
    const key = idempotency(req), ref = ctx.db.collection("content_entries").doc(sha(`story:${who.uid}:${key}`));
    const hash = sha(JSON.stringify(input));
    const result = await ctx.db.runTransaction(async tx => {
      await assertTransactionRole(tx, ctx, who, roles);
      const previous = await tx.get(ref);
      if (previous.exists) {
        requireThat(previous.data()!._request_hash === hash, 409, "IDEMPOTENCY_CONFLICT", "Khóa tạo story đã dùng.");
        return {row: docData(previous), created: false};
      }
      const now = ctx.now();
      const row = {id: ref.id, kind: "STORY", author_id: who.uid, title: "Story", body: input.body,
        status: "PUBLISHED", parent_id: null, materials: [], tags: [], weight_kg: null, points_cost: 0,
        created_at: now, updated_at: now, expires_at: new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString(),
        duration_ms: input.duration_ms || null, metadata_json: "{}", _social: true, _request_hash: hash};
      tx.create(ref, row); return {row, created: true};
    });
    res.status(result.created ? 201 : 200).json({id: result.row.id, kind: "STORY", expires_at: result.row.expires_at,
      duration_ms: result.row.duration_ms, body: result.row.body});
  }));
  router.get("/stories/:id", asyncRoute(async (req, res) => {
    const row = docData(await ctx.db.collection("content_entries").doc(pathId(req.params.id)).get());
    requireThat(row.kind === "STORY" && row.status === "PUBLISHED" && row.expires_at > ctx.now(), 404, "STORY_EXPIRED", "Story đã hết hạn.");
    const [author, media] = await Promise.all([ctx.db.collection("users").doc(row.author_id).get(),
      ctx.db.collection("media_assets").where("content_id", "==", row.id).where("_status", "==", "READY").limit(1).get()]);
    res.json({id: row.id, body: row.body, author: publicUser(author.data(), row.author_id), expires_at: row.expires_at,
      duration_ms: row.duration_ms, media: media.docs.map(doc => ({id: doc.id, mime_type: doc.data().mime_type, download_path: `/v1/media/${doc.id}/download`}))});
  }));
  router.post("/challenges/:id/complete", asyncRoute(async (req, res) => {
    const who = actor(res), challengeId = pathId(req.params.id), key = idempotency(req);
    const ref = ctx.db.collection("interactions").doc(sha(`challenge:${who.uid}:${challengeId}`));
    const challengeRef = ctx.db.collection("content_entries").doc(challengeId), userRef = ctx.db.collection("users").doc(who.uid);
    const result = await ctx.db.runTransaction(async (tx) => {
      await assertTransactionRole(tx, ctx, who, roles);
      const [challengeSnap, userSnap, completionSnap] = await Promise.all([tx.get(challengeRef), tx.get(userRef), tx.get(ref)]);
      const challenge = docData(challengeSnap), user = docData(userSnap);
      requireThat(challenge.kind === "CHALLENGE" && challenge.status === "PUBLISHED", 404, "CHALLENGE_NOT_FOUND", "Thử thách không còn khả dụng.");
      requireThat(!challenge.starts_at || challenge.starts_at <= ctx.now(), 409, "CHALLENGE_NOT_STARTED", "Thử thách chưa bắt đầu.");
      requireThat(!challenge.ends_at || challenge.ends_at >= ctx.now(), 409, "CHALLENGE_ENDED", "Thử thách đã kết thúc.");
      if (completionSnap.exists) return {created: false, balance: Number(user.points_balance ?? 0), points: Number(completionSnap.data()!.points ?? 0)};
      await requireChallengeAction(tx, ctx, who.uid, challenge, user);
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(String(challenge.metadata_json ?? "{}")); } catch { /* invalid legacy content earns zero */ }
      const points = typeof metadata.reward_points === "number" && Number.isSafeInteger(metadata.reward_points) && metadata.reward_points > 0 ? metadata.reward_points : 0;
      const previous = Number(user.points_balance ?? 0), balance = previous + points;
      requireThat(Number.isSafeInteger(previous) && previous >= 0 && Number.isSafeInteger(balance) && balance <= 1_000_000_000,
        409, "INVALID_POINTS_BALANCE", "Số dư điểm hiện tại không hợp lệ.");
      tx.create(ref, {id: ref.id, user_id: who.uid, content_id: challengeId, type: "CHALLENGE_COMPLETION",
        points, completed_at: ctx.now(), idempotency_key: key ?? null, _social: true});
      if (points > 0) {
        const ledger = ctx.db.collection("green_ledger").doc(sha(`challenge:${who.uid}:${challengeId}`));
        tx.create(ledger, {id: ledger.id, user_id: who.uid, order_id: null, content_id: challengeId, points,
          reason: `Hoàn thành thử thách: ${challenge.title}`, dedupe_key: `challenge:${who.uid}:${challengeId}`, created_at: ctx.now()});
        tx.update(userRef, {points_balance: balance, updated_at: ctx.now()});
      }
      return {created: true, balance, points};
    });
    res.status(result.created ? 201 : 200).json({...result, challenge_id: challengeId});
  }));
  router.get("/explore/search", asyncRoute(async (req, res) => {
    const who = res.locals.actor as Actor | undefined;
    const q = search(req), limit = z.coerce.number().int().min(1).max(100).parse(req.query.limit ?? 50);
    if (!q) { res.json({items: [], next_cursor: null}); return; }
    const [contents, listings] = await Promise.all([
      ctx.db.collection("content_entries").where("status", "==", "PUBLISHED").where("kind", "in", ["TIP", "CHALLENGE"]).orderBy("created_at", "desc").limit(100).get(),
      ctx.db.collection("listings").where("status", "==", "APPROVED").orderBy("created_at", "desc").limit(100).get(),
    ]);
    const matches = [
      ...contents.docs.map(docData).filter(row => `${row.title ?? ""} ${row.body ?? ""}`.toLocaleLowerCase("vi").includes(q)),
      ...listings.docs.map(docData).filter(row => `${row.title ?? ""} ${row.description ?? ""} ${row.city ?? ""}`.toLocaleLowerCase("vi").includes(q)),
    ].sort((a,b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(a.id).localeCompare(String(b.id)))
      .slice(0, limit);
    const challengeRows = matches.filter(row => row.kind === "CHALLENGE");
    const completions = who && challengeRows.length
      ? await ctx.db.getAll(...challengeRows.map(row => ctx.db.collection("interactions").doc(sha(`challenge:${who.uid}:${row.id}`))))
      : [];
    const completedIds = new Set(challengeRows.filter((_, index) => completions[index]?.exists).map(row => row.id));
    const tips = matches.filter(row => ["TIP", "CHALLENGE"].includes(row.kind)).map(row => {
      let metadata: Record<string, any> = {};
      try { metadata = JSON.parse(String(row.metadata_json ?? "{}")); } catch { /* legacy content */ }
      return row.kind === "CHALLENGE"
        ? {...row, metadata, target: metadata.target ?? null, unit: metadata.unit ?? null,
          reward_points: typeof metadata.reward_points === "number" && Number.isSafeInteger(metadata.reward_points) ? metadata.reward_points : 0,
          completed: completedIds.has(row.id)}
        : {...row, metadata};
    });
    const byId = new Map<string, Record<string, any>>();
    for (const row of tips as Array<Record<string, any>>) byId.set(String(row.id), row);
    const listingRows = await listingPreviews(ctx, matches.filter(row => !["TIP", "CHALLENGE"].includes(row.kind))
      .map(row => ({...row, kind: "LISTING"})));
    const listingsById = new Map(listingRows.map(row => [row.id, row]));
    const items = matches.map(row => row.kind === "TIP" || row.kind === "CHALLENGE" ? byId.get(row.id) : listingsById.get(row.id));
    res.json({items, next_cursor: null});
  }));
  router.get("/scans", asyncRoute(async (req, res) => {
    const who = actor(res), result = await timeline(ctx, "content_entries", ctx.db.collection("content_entries").where("kind", "==", "SCAN").where("author_id", "==", who.uid).where("status", "==", "PRIVATE"), req);
    res.json({...result, items: await enrich(ctx, result.items, who)});
  }));
  router.post("/scans", asyncRoute(async (req, res) => {
    const who = actor(res), input = scanBody.parse(req.body), key = idempotency(req);
    const ref = ctx.db.collection("content_entries").doc(sha(`social:SCAN:${who.uid}:${key}`));
    const hash = sha(JSON.stringify(input));
    const result = await ctx.db.runTransaction(async (tx) => {
      await assertTransactionRole(tx, ctx, who, roles);
      const existing = await tx.get(ref);
      if (existing.exists) {
        requireThat(existing.data()!._request_hash === hash, 409, "IDEMPOTENCY_CONFLICT", "Khóa ảnh SCAN đã dùng.");
        return {row: docData(existing), created: false};
      }
      const row = {id: ref.id, kind: "SCAN", author_id: who.uid, title: input.title, body: input.note,
        status: "PRIVATE", parent_id: null, materials: [], tags: [], weight_kg: null,
        created_at: ctx.now(), updated_at: ctx.now(), metadata_json: "{}", _social: true, _request_hash: hash};
      tx.create(ref, row);
      return {row, created: true};
    });
    res.status(result.created ? 201 : 200).json((await enrich(ctx, [result.row], who))[0]);
  }));
  router.get("/scans/:id", asyncRoute(async (req, res) => {
    const who = actor(res), row = await ensureReadable(ctx, pathId(req.params.id), who, "SCAN");
    res.json((await enrich(ctx, [row], who))[0]);
  }));
  router.delete("/scans/:id", asyncRoute(async (req, res) => {
    const who = actor(res), ref = ctx.db.collection("content_entries").doc(pathId(req.params.id));
    await ctx.db.runTransaction(async (tx) => {
      await assertTransactionRole(tx, ctx, who, roles);
      const row = docData(await tx.get(ref));
      requireThat(row.kind === "SCAN" && row.author_id === who.uid, 403, "FORBIDDEN", "Chỉ người chụp được xóa ảnh SCAN.");
      tx.update(ref, {status: "ARCHIVED", updated_at: ctx.now()});
    });
    res.status(204).end();
  }));

  router.get("/friends", asyncRoute(async (req, res) => {
    const who = actor(res), tab = z.enum(["requests", "friends", "suggestions"]).parse(req.query.tab ?? "friends"), q = search(req);
    if (tab === "suggestions") {
      // Suggestions deliberately scan a bounded candidate page; private profile fields never leave the API.
      const candidates = await page(ctx.db.collection("users").where("status", "==", "ACTIVE"), req);
      const docs = candidates.items.filter((row) => row.id !== who.uid && !["ADMIN", "MODERATOR"].includes(row.role));
      const links = docs.length ? await ctx.db.getAll(...docs.map((row) => ctx.db.collection("interactions").doc(friendshipId(who.uid, row.id)))) : [];
      const items = docs.filter((row, i) => !links[i]!.exists || links[i]!.data()!.status === "DECLINED")
        .filter((row) => !q || `${row.display_name ?? ""} ${row.city ?? ""}`.toLocaleLowerCase("vi").includes(q))
        .map((row) => ({...publicUser(row, row.id), bio: row.bio ?? "", city: row.city ?? "", status: "NONE", relationship_id: null, request_id: null}));
      res.json({...candidates, items});
      return;
    }
    let query: Query = ctx.db.collection("interactions").where("type", "==", "FRIEND_REQUEST");
    if (tab === "requests") query = query.where("target_user_id", "==", who.uid).where("status", "==", "PENDING");
    else query = query.where("_member_ids", "array-contains", who.uid).where("status", "==", "ACCEPTED");
    const result = await timeline(ctx, "interactions", query, req);
    const ids = result.items.map((row) => row.user_id === who.uid ? row.target_user_id : row.user_id);
    const users = ids.length ? await ctx.db.getAll(...ids.map((id) => ctx.db.collection("users").doc(id))) : [];
    const items = result.items.map((row, index) => {
      const user = users[index]!.data(), id = ids[index];
      return {...publicUser(user, id), bio: user?.status === "ACTIVE" ? user.bio ?? "" : "", city: user?.status === "ACTIVE" ? user.city ?? "" : "",
        status: row.status, relationship_id: row.id, request_id: row.id};
    }).filter((row) => !q || `${row.display_name} ${row.city}`.toLocaleLowerCase("vi").includes(q));
    res.json({...result, items});
  }));
  router.get("/friends/relationship/:id", asyncRoute(async (req, res) => {
    const who = actor(res), targetId = pathId(req.params.id);
    requireThat(targetId !== who.uid, 400, "SELF_RELATIONSHIP", "Đây là tài khoản của bạn.");
    const ref = ctx.db.collection("interactions").doc(friendshipId(who.uid, targetId));
    const row = await ref.get();
    const value = row.data();
    res.json({status: value?.status ?? "NONE", request_id: value?.id ?? null,
      is_sender: value?.user_id === who.uid, is_friend: value?.status === "ACCEPTED"});
  }));
  router.post("/friends/requests", asyncRoute(async (req, res) => {
    const who = actor(res), input = z.object({user_id: z.string()}).strict().parse(req.body), targetId = pathId(input.user_id);
    requireThat(targetId !== who.uid, 400, "SELF_FRIEND_REQUEST", "Chọn một người dùng khác.");
    const ref = ctx.db.collection("interactions").doc(friendshipId(who.uid, targetId));
    const result = await ctx.db.runTransaction(async (tx) => {
      const currentUser = await assertTransactionRole(tx, ctx, who, roles);
      const [targetSnap, existing] = await Promise.all([tx.get(ctx.db.collection("users").doc(targetId)), tx.get(ref)]);
      const target = targetSnap.data();
      requireThat(target?.status === "ACTIVE", 404, "NOT_FOUND", "Không tìm thấy người dùng.");
      if (existing.exists && ["PENDING", "ACCEPTED"].includes(existing.data()!.status)) {
        requireThat(existing.data()!.status !== "PENDING" || existing.data()!.user_id === who.uid,
          409, "RECEIVED_REQUEST", "Bạn đã nhận lời mời từ người này. Hãy chấp nhận trong mục lời mời.");
        return {row: docData(existing), created: false};
      }
      const row = {id: ref.id, user_id: who.uid, target_user_id: targetId, _member_ids: [who.uid, targetId].sort(),
        type: "FRIEND_REQUEST", status: "PENDING", content_id: null, listing_id: null, body: null,
        created_at: ctx.now(), updated_at: ctx.now(), _social: true};
      tx.set(ref, row);
      notification(tx, ctx, `friend:${ref.id}`, targetId, who.uid, "FRIEND_REQUEST", `${currentUser.display_name || "Một thành viên"} đã gửi lời mời kết bạn.`);
      return {row, created: true};
    });
    res.status(result.created ? 201 : 200).json(result.row);
  }));
  router.post("/friends/requests/:id/respond", asyncRoute(async (req, res) => {
    const who = actor(res), input = z.object({accept: z.boolean()}).strict().parse(req.body);
    const ref = ctx.db.collection("interactions").doc(pathId(req.params.id));
    const row = await ctx.db.runTransaction(async (tx) => {
      const currentUser = await assertTransactionRole(tx, ctx, who, roles);
      const current = docData(await tx.get(ref));
      requireThat(current.type === "FRIEND_REQUEST" && current.target_user_id === who.uid, 403, "FORBIDDEN", "Chỉ người nhận được phản hồi lời mời.");
      const sender = docData(await tx.get(ctx.db.collection("users").doc(current.user_id)));
      requireThat(sender.status === "ACTIVE", 409, "SENDER_INACTIVE", "Người gửi không còn hoạt động.");
      const status = input.accept ? "ACCEPTED" : "DECLINED";
      requireThat(current.status === "PENDING" || current.status === status, 409, "REQUEST_CLOSED", "Lời mời đã được xử lý.");
      if (current.status === status) return current;
      tx.update(ref, {status, updated_at: ctx.now()});
      if (input.accept) notification(tx, ctx, `friend-accepted:${ref.id}`, current.user_id, who.uid, "FRIEND_ACCEPTED", `${currentUser.display_name || "Một thành viên"} đã chấp nhận lời mời kết bạn.`);
      return {...current, status};
    });
    res.json(row);
  }));
  router.get("/notifications", asyncRoute(async (req, res) => {
    const who = actor(res);
    const query = ctx.db.collection("interactions").where("user_id", "==", who.uid).where("type", "==", "NOTIFICATION");
    const [result, unread] = await Promise.all([timeline(ctx, "interactions", query, req), query.where("read_at", "==", null).count().get()]);
    const ids = [...new Set(result.items.map((row) => row.target_user_id).filter((id): id is string => typeof id === "string"))];
    const senders = ids.length ? await ctx.db.getAll(...ids.map((id) => ctx.db.collection("users").doc(id))) : [];
    const users = new Map(senders.map((doc) => [doc.id, doc.data()]));
    const contentIds = [...new Set(result.items.map((row) => row.content_id).filter((id): id is string => typeof id === "string"))];
    const contents = contentIds.length ? await ctx.db.getAll(...contentIds.map((id) => ctx.db.collection("content_entries").doc(id))) : [];
    const contentKinds = new Map(contents.map((doc) => [doc.id, doc.data()?.kind]));
    res.json({...result, unread_count: unread.data().count, items: result.items.map((row) => ({
      id: row.id, subtype: row.subtype ?? "SYSTEM", body: row.body, content_id: row.content_id,
      content_kind: contentKinds.get(row.content_id) ?? null,
      target_user_id: row.target_user_id, read_at: row.read_at, created_at: row.created_at,
      author: row.target_user_id ? publicUser(users.get(row.target_user_id), row.target_user_id) : null,
    }))});
  }));
  router.post("/notifications/read-all", asyncRoute(async (_req, res) => {
    const who = actor(res);
    // Chunking is explicit so there is no hidden cap of 500 unread notifications.
    let changed = 0;
    for (;;) {
      const page = await ctx.db.collection("interactions").where("user_id", "==", who.uid)
        .where("type", "==", "NOTIFICATION").where("read_at", "==", null).limit(400).get();
      if (page.empty) break;
      await ctx.db.runTransaction(async (tx) => {
        await assertTransactionRole(tx, ctx, who, roles);
        const rows = await tx.getAll(...page.docs.map((row) => row.ref));
        for (const row of rows) if (row.exists && row.data()!.user_id === who.uid && row.data()!.read_at === null) tx.update(row.ref, {read_at: ctx.now()});
      });
      changed += page.size;
    }
    res.json({read_count: changed});
  }));
  router.post("/notifications/:id/read", asyncRoute(async (req, res) => {
    const who = actor(res), ref = ctx.db.collection("interactions").doc(pathId(req.params.id));
    await ctx.db.runTransaction(async (tx) => {
      await assertTransactionRole(tx, ctx, who, roles);
      const row = docData(await tx.get(ref));
      requireThat(row.type === "NOTIFICATION" && row.user_id === who.uid, 404, "NOT_FOUND", "Không tìm thấy thông báo.");
      if (!row.read_at) tx.update(ref, {read_at: ctx.now()});
    });
    res.json({id: ref.id, read: true});
  }));
}
