import { createHash, randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import {
  getFirestore,
  type Firestore,
  type Transaction,
  type DocumentSnapshot,
  type Query,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;
export interface Context {
  db: Firestore;
  auth: Auth;
  bucket: Bucket;
  now: () => string;
  emulator: boolean;
}
export interface Actor {
  uid: string;
  role: "MEMBER" | "COLLECTOR" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  email?: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
export function requireThat(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) fail(status, code, message);
}
export const sha = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "Mã không hợp lệ.");
export const reasonSchema = z.string().trim().min(5).max(1000);
export const textSchema = z.string().trim().min(1).max(2000);
export const moneySchema = z.number().int().positive().max(1_000_000_000);
export function pathId(value: unknown): string {
  return idSchema.parse(value);
}
export function docData(snapshot: DocumentSnapshot): Record<string, any> {
  requireThat(snapshot.exists, 404, "NOT_FOUND", "Không tìm thấy dữ liệu.");
  return { ...snapshot.data(), id: snapshot.id };
}
export function actor(res: Response, roles?: string[]): Actor {
  const current = res.locals.actor as Actor | undefined;
  requireThat(
    current,
    401,
    "UNAUTHENTICATED",
    "Vui lòng đăng nhập bằng Firebase Authentication.",
  );
  requireThat(
    current.status === "ACTIVE",
    403,
    "ACCOUNT_SUSPENDED",
    "Tài khoản đang bị khóa.",
  );
  if (roles)
    requireThat(
      roles.includes(current.role),
      403,
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác.",
    );
  return current;
}
export function asyncRoute(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
export function audit(
  tx: Transaction,
  ctx: Context,
  who: Actor,
  action: string,
  entityType: string,
  id: string,
  reason: string,
): void {
  const ref = ctx.db.collection("audit_logs").doc();
  tx.create(ref, {
    id: ref.id,
    actor_id: who.uid,
    action,
    entity_type: entityType,
    entity_id: id,
    reason,
    created_at: ctx.now(),
  });
}
export async function assertActiveVerified(
  tx: Transaction,
  ctx: Context,
  uid: string,
): Promise<Record<string, any>> {
  const user = docData(
    await tx.get(ctx.db.collection("users").doc(pathId(uid))),
  );
  requireThat(
    user.status === "ACTIVE",
    403,
    "ACCOUNT_SUSPENDED",
    "Tài khoản giao dịch đang bị khóa.",
  );
  requireThat(
    typeof user._verification_id === "string",
    403,
    "VERIFICATION_REQUIRED",
    "Cả người mua và người bán phải được xác minh.",
  );
  const verification = docData(
    await tx.get(
      ctx.db.collection("verifications").doc(pathId(user._verification_id)),
    ),
  );
  requireThat(
    verification.user_id === uid &&
      verification.status === "VERIFIED" &&
      (!verification.expires_at || verification.expires_at > ctx.now()),
    403,
    "VERIFICATION_REQUIRED",
    "Hồ sơ xác minh chưa hợp lệ hoặc đã hết hạn.",
  );
  return user;
}
export async function assertTransactionRole(
  tx: Transaction,
  ctx: Context,
  who: Actor,
  roles: string[],
): Promise<Record<string, any>> {
  const current = docData(
    await tx.get(ctx.db.collection("users").doc(who.uid)),
  );
  requireThat(
    current.status === "ACTIVE" && roles.includes(current.role),
    403,
    "FORBIDDEN",
    "Quyền tài khoản đã thay đổi.",
  );
  return current;
}
export function idempotency(req: Request): string {
  const key = req.get("Idempotency-Key");
  requireThat(
    key && /^[A-Za-z0-9_-]{8,128}$/.test(key),
    400,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Gửi Idempotency-Key gồm 8–128 ký tự chữ, số, gạch ngang hoặc gạch dưới.",
  );
  return key;
}
/** Request-derived filters are bounded. Cursor is the last Firestore document ID. */
export async function page(
  query: Query,
  req: Request,
): Promise<{ items: Record<string, any>[]; next_cursor: string | null }> {
  const limit = Number(req.query.limit ?? 25);
  requireThat(
    Number.isInteger(limit) && limit >= 1 && limit <= 100,
    400,
    "INVALID_LIMIT",
    "limit từ 1 đến 100.",
  );
  let bounded = query.orderBy("__name__");
  if (req.query.cursor) bounded = bounded.startAfter(pathId(req.query.cursor));
  const snapshot = await bounded.limit(limit + 1).get();
  const visible = snapshot.docs.slice(0, limit);
  return {
    items: visible.map(docData),
    next_cursor: snapshot.docs.length > limit ? visible.at(-1)!.id : null,
  };
}
export function createContext(): Context {
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  requireThat(
    projectId,
    500,
    "PROJECT_NOT_CONFIGURED",
    "Chưa cấu hình Firebase projectId.",
  );
  const hosts = [
    process.env.FIRESTORE_EMULATOR_HOST,
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  ];
  const emulator = hosts.every(Boolean);
  requireThat(
    !hosts.some(Boolean) || emulator,
    500,
    "INCOMPLETE_EMULATOR_CONFIG",
    "Cần cấu hình cùng lúc Auth, Firestore và Storage emulator.",
  );
  let firebaseConfig: Record<string, any> = {};
  try {
    if (process.env.FIREBASE_CONFIG?.startsWith("{"))
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  } catch {
    /* Validate the explicit bucket below if used. */
  }
  const bucketName =
    process.env.ECOSHARE_STORAGE_BUCKET ??
    firebaseConfig.storageBucket ??
    (emulator ? `${projectId}.appspot.com` : undefined);
  requireThat(
    bucketName,
    500,
    "BUCKET_NOT_CONFIGURED",
    "Đặt ECOSHARE_STORAGE_BUCKET theo bucket của Firebase project.",
  );
  const app =
    getApps()[0] ?? initializeApp({ projectId, storageBucket: bucketName });
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    bucket: getStorage(app).bucket(bucketName),
    emulator,
    now: () => new Date().toISOString(),
  };
}

/** A verified Firebase token identifies the user; only the live Firestore role authorizes them. */
export function optionalAuthentication(ctx: Context): RequestHandler {
  return (req, res, next) => {
    const authorization = req.get("Authorization");
    if (!authorization) {
      next();
      return;
    }
    void (async () => {
      requireThat(
        authorization.startsWith("Bearer "),
        401,
        "INVALID_TOKEN",
        "Authorization phải dùng Bearer Firebase ID token.",
      );
      const rawToken = authorization.slice(7);
      const verifyToken = async (checkRevoked = false) => {
        try { return await ctx.auth.verifyIdToken(rawToken, checkRevoked); }
        catch { fail(401, "INVALID_TOKEN", "Phiên đăng nhập hết hạn hoặc không hợp lệ."); }
      };
      // Validate the signature before deriving any Firestore document path.
      // Revocation still has to be checked on every request, but its Auth RPC
      // and the independent live role/status read need not be sequential.
      const signedToken = await verifyToken();
      const uid = pathId(signedToken.uid);
      const ref = ctx.db.collection("users").doc(uid);
      const [token, snapshot] = await Promise.all([verifyToken(true), ref.get()]);
      // Existing profiles only need a fresh read. Keep the transaction for the
      // first request so simultaneous sign-ins cannot create competing profiles.
      const current = snapshot.exists ? docData(snapshot) : await ctx.db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (snapshot.exists) return docData(snapshot);
        const created = {
          id: uid,
          display_name: String(token.name ?? "Thành viên EcoShare").slice(
            0,
            100,
          ),
          email: typeof token.email === "string" ? token.email : null,
          role: "MEMBER",
          status: "ACTIVE",
          bio: "",
          city: "",
          created_at: ctx.now(),
          points_balance: 0,
          _verification_id: null,
          _pending_verification_id: null,
        };
        tx.create(ref, created);
        return created;
      });
      requireThat(
        current.status === "ACTIVE",
        403,
        "ACCOUNT_SUSPENDED",
        "Tài khoản đang bị khóa.",
      );
      res.locals.actor = {
        uid,
        role: current.role,
        status: current.status,
        email: current.email,
      } satisfies Actor;
      // This snapshot belongs to this request only; never cache permissions
      // across requests. Profile routes can reuse it instead of reading twice.
      res.locals.authenticated_user = current;
      res.locals.request_id = randomUUID();
      next();
    })().catch(next);
  };
}
