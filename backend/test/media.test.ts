import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ZodError } from "zod";
import { ApiError, type Context } from "../src/core.js";
import { registerMediaRoutes } from "../src/media.js";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const enabled = Boolean(firestoreHost && storageHost);
const projectId = "demo-recycling-share";
const prefix = `media_${randomUUID().replaceAll("-", "")}`;
const uid = (name: string) => `${prefix}_${name}`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNCsAAAAASUVORK5CYII=",
  "base64",
);

function loopback(address: string): { host: string; port: number } {
  const parsed = new URL(`http://${address}`);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname),
    "Media tests require loopback emulators",
  );
  assert.ok(Number(parsed.port) > 0);
  return { host: parsed.hostname, port: Number(parsed.port) };
}

describe(
  "Media backend and real Storage authorization",
  { skip: !enabled, concurrency: false },
  () => {
    let firebase: App,
      env: RulesTestEnvironment,
      ctx: Context,
      server: Server,
      base: string;
    const originalMediaBackend = process.env.ECOSHARE_MEDIA_BACKEND;

    async function seed(
      collection: string,
      id: string,
      data: Record<string, unknown>,
    ): Promise<void> {
      await ctx.db
        .collection(collection)
        .doc(id)
        .set({ id, ...data });
    }
    async function request(
      who: string | null,
      method: string,
      path: string,
      body?: unknown,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(who ? { "X-Test-User": who } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const data: any =
        response.headers.get("Content-Type")?.includes("application/json") &&
        bytes.length
          ? JSON.parse(bytes.toString("utf8"))
          : null;
      return {
        status: response.status,
        data,
        bytes,
        headers: response.headers,
      };
    }
    async function slot(
      kind: "VERIFICATION" | "REPORT" | "LISTING" | "CONTENT" | "SCAN",
      parentId: string,
    ) {
      const response = await request(uid("owner"), "POST", "/media", {
        parent_kind: kind,
        parent_id: parentId,
        content_type: "image/png",
      });
      assert.equal(response.status, 201, JSON.stringify(response.data));
      return response.data as {
        id: string;
        storage_key: string;
        bucket: string;
      };
    }
    function file(storageKey: string) {
      const storage = env
        .authenticatedContext(uid("owner"))
        .storage(`gs://${projectId}.appspot.com`);
      storage.setMaxUploadRetryTime(1000);
      return storage.ref(storageKey);
    }
    async function complete(id: string) {
      return request(uid("owner"), "POST", `/media/${id}/complete`, {});
    }
    async function ready(
      kind: "VERIFICATION" | "REPORT" | "LISTING" | "CONTENT" | "SCAN",
      parentId: string,
    ) {
      const result = await slot(kind, parentId);
      await file(result.storage_key).put(png, { contentType: "image/png" });
      const completed = await complete(result.id);
      assert.equal(completed.status, 200, JSON.stringify(completed.data));
      return result;
    }

    before(async () => {
      process.env.ECOSHARE_MEDIA_BACKEND = "storage";
      assert.ok(firestoreHost && storageHost);
      const firestore = loopback(firestoreHost),
        storage = loopback(storageHost);
      firebase = initializeApp(
        { projectId, storageBucket: `${projectId}.appspot.com` },
        prefix,
      );
      ctx = {
        db: getFirestore(firebase),
        auth: getAuth(firebase),
        bucket: getStorage(firebase).bucket(),
        now: () => new Date().toISOString(),
        emulator: true,
      };
      // Reuse deployed local rules; never clear shared Firestore or Storage data.
      env = await initializeTestEnvironment({ projectId, firestore, storage });
      for (const [name, role] of [
        ["owner", "MEMBER"],
        ["outsider", "MEMBER"],
        ["moderator", "MODERATOR"],
        ["admin", "ADMIN"],
      ] as const) {
        await seed("users", uid(name), {
          role,
          status: "ACTIVE",
          display_name: name,
          email: `${name}@example.test`,
        });
      }
      await seed("verifications", uid("kyc"), {
        user_id: uid("owner"),
        status: "PENDING",
      });
      await seed("reports", uid("financial-report"), {
        reporter_id: uid("owner"),
        order_id: uid("private-order"),
        status: "OPEN",
      });
      await seed("reports", uid("content-report"), {
        reporter_id: uid("owner"),
        order_id: null,
        status: "OPEN",
      });
      await seed("listings", uid("approved-listing"), {
        seller_id: uid("owner"),
        status: "APPROVED",
        kind: "SALE",
        title: "Test listing",
      });
      for (const kind of ["POST", "TIP", "ARTICLE", "SCAN"]) {
        await seed("content_entries", uid(kind), {
          author_id: uid("owner"), kind, title: kind,
          status: kind === "SCAN" ? "PRIVATE" : "PUBLISHED",
        });
      }

      const app = express();
      app.use(express.json());
      // Auth token validation is covered in the main application integration suite.
      // This harness isolates media permissions and still reads roles live.
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
          .then((snapshot) => {
            if (snapshot.exists)
              res.locals.actor = {
                uid: userId,
                role: snapshot.data()!.role,
                status: snapshot.data()!.status,
              };
            next();
          })
          .catch(next);
      });
      registerMediaRoutes(app, ctx);
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
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      base = `http://127.0.0.1:${address.port}`;
    });

    after(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      // Delete only this run's objects; other emulator suites can keep running.
      if (ctx)
        await ctx.bucket.deleteFiles({ prefix: `uploads/${uid("owner")}/` });
      if (env) await env.cleanup();
      if (firebase) await deleteApp(firebase);
      if (originalMediaBackend === undefined) delete process.env.ECOSHARE_MEDIA_BACKEND;
      else process.env.ECOSHARE_MEDIA_BACKEND = originalMediaBackend;
    });

    it("uploads and finalizes genuine PNG evidence through a backend-issued KYC slot", async () => {
      const asset = await ready("VERIFICATION", uid("kyc"));
      const row = (
        await ctx.db.collection("media_assets").doc(asset.id).get()
      ).data()!;
      assert.equal(row._status, "READY");
      assert.equal(row.visibility, "PRIVATE");
      assert.equal(row.verification_id, uid("kyc"));
      assert.equal(row.size_bytes, png.length);
      const listing = await request(
        uid("owner"),
        "GET",
        `/media?parent_kind=VERIFICATION&parent_id=${uid("kyc")}`,
      );
      assert.equal(listing.status, 200);
      assert.ok(
        listing.data.items.some((item: { id: string }) => item.id === asset.id),
      );
      assert.equal(
        (
          await request(
            uid("outsider"),
            "GET",
            `/media?parent_kind=VERIFICATION&parent_id=${uid("kyc")}`,
          )
        ).status,
        403,
      );
      const download = await request(
        uid("owner"),
        "GET",
        `/media/${asset.id}/download`,
      );
      assert.equal(download.status, 200);
      assert.deepEqual(download.bytes, png);
      assert.equal(download.headers.get("X-Content-Type-Options"), "nosniff");
      assert.match(download.headers.get("Cache-Control") ?? "", /no-store/);
      assert.equal(
        (await complete(asset.id)).status,
        200,
        "Finalization is idempotent",
      );
    });

    it("blocks private outsiders and financial-report moderators while allowing authorized reviewers", async () => {
      const kyc = await ready("VERIFICATION", uid("kyc"));
      assert.equal(
        (await request(null, "GET", `/media/${kyc.id}/download`)).status,
        401,
      );
      assert.equal(
        (await request(uid("outsider"), "GET", `/media/${kyc.id}/download`))
          .status,
        403,
      );
      assert.equal(
        (await request(uid("moderator"), "GET", `/media/${kyc.id}/download`))
          .status,
        403,
      );
      assert.equal(
        (await request(uid("admin"), "GET", `/media/${kyc.id}/download`))
          .status,
        200,
      );
      const financial = await ready("REPORT", uid("financial-report"));
      assert.equal(
        (
          await request(
            uid("moderator"),
            "GET",
            `/media/${financial.id}/download`,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            uid("outsider"),
            "GET",
            `/media/${financial.id}/download`,
          )
        ).status,
        403,
      );
      assert.equal(
        (await request(uid("admin"), "GET", `/media/${financial.id}/download`))
          .status,
        200,
      );
      const content = await ready("REPORT", uid("content-report"));
      assert.equal(
        (
          await request(
            uid("moderator"),
            "GET",
            `/media/${content.id}/download`,
          )
        ).status,
        200,
      );
    });

    it("revokes uploader-supplied download tokens on completion and forbids object overwrite", async () => {
      const asset = await slot("VERIFICATION", uid("kyc"));
      await file(asset.storage_key).put(png, {
        contentType: "image/png",
        customMetadata: {
          firebaseStorageDownloadTokens: `${prefix}-known-token`,
        },
      });
      const [beforeMetadata] = await ctx.bucket
        .file(asset.storage_key)
        .getMetadata();
      assert.equal(
        beforeMetadata.metadata?.firebaseStorageDownloadTokens,
        `${prefix}-known-token`,
      );
      const result = await complete(asset.id);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const [metadata] = await ctx.bucket.file(asset.storage_key).getMetadata();
      // The emulator always retains a new random token after revoking its last
      // token; the important boundary is invalidating the uploader-known token.
      assert.equal(
        String(metadata.metadata?.firebaseStorageDownloadTokens ?? "")
          .split(",")
          .includes(`${prefix}-known-token`),
        false,
      );
      const oldTokenUrl = `http://${storageHost}/v0/b/${encodeURIComponent(asset.bucket)}/o/${encodeURIComponent(asset.storage_key)}?alt=media&token=${encodeURIComponent(`${prefix}-known-token`)}`;
      assert.equal((await fetch(oldTokenUrl)).status, 403);
      await assertFails(
        file(asset.storage_key)
          .put(png, { contentType: "image/png" })
          .then(() => undefined),
      );
      await assertFails(file(asset.storage_key).getDownloadURL());
      assert.deepEqual(
        (await ctx.bucket.file(asset.storage_key).download())[0],
        png,
      );
    });

    it("queues an approved listing for moderation when its owner finalizes a new image", async () => {
      const asset = await slot("LISTING", uid("approved-listing"));
      await file(asset.storage_key).put(png, { contentType: "image/png" });
      assert.equal(
        (
          await ctx.db.collection("listings").doc(uid("approved-listing")).get()
        ).data()!.status,
        "APPROVED",
      );
      const result = await complete(asset.id);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(
        (
          await ctx.db.collection("listings").doc(uid("approved-listing")).get()
        ).data()!.status,
        "PENDING",
      );
      assert.equal(
        (await request(null, "GET", `/media/${asset.id}/download`)).status,
        403,
      );
      assert.equal(
        (await request(uid("owner"), "GET", `/media/${asset.id}/download`))
          .status,
        200,
      );
      await ctx.db
        .collection("listings")
        .doc(uid("approved-listing"))
        .update({ status: "APPROVED" });
      assert.equal(
        (await request(null, "GET", `/media/${asset.id}/download`)).status,
        200,
      );
      assert.equal((await complete(asset.id)).status, 200);
      assert.equal(
        (
          await ctx.db.collection("listings").doc(uid("approved-listing")).get()
        ).data()!.status,
        "APPROVED",
      );
      const hidden = uid("hidden-listing");
      await seed("listings", hidden, {
        seller_id: uid("owner"),
        status: "HIDDEN",
      });
      assert.equal(
        (
          await request(uid("owner"), "POST", "/media", {
            parent_kind: "LISTING",
            parent_id: hidden,
            content_type: "image/png",
          })
        ).status,
        409,
      );
    });

    it("stores SCAN images privately and allows only their owner and admin to download", async () => {
      const asset = await ready("SCAN", uid("SCAN"));
      const row = (await ctx.db.collection("media_assets").doc(asset.id).get()).data()!;
      assert.equal(row.content_id, uid("SCAN"));
      assert.equal(row.visibility, "PRIVATE");
      assert.equal(row._parent_type, "SCAN");
      assert.equal((await request(null, "GET", `/media/${asset.id}/download`)).status, 401);
      assert.equal((await request(uid("outsider"), "GET", `/media/${asset.id}/download`)).status, 403);
      assert.equal((await request(uid("moderator"), "GET", `/media/${asset.id}/download`)).status, 403);
      const owner = await request(uid("owner"), "GET", `/media/${asset.id}/download`);
      assert.equal(owner.status, 200); assert.deepEqual(owner.bytes, png);
      assert.equal((await request(uid("admin"), "GET", `/media/${asset.id}/download`)).status, 200);
      assert.equal((await request(uid("owner"), "POST", "/media", {
        parent_kind: "CONTENT", parent_id: uid("SCAN"), content_type: "image/png",
      })).status, 409);
      await ctx.db.collection("content_entries").doc(uid("SCAN")).update({status: "PUBLISHED"});
      assert.equal((await request(uid("outsider"), "GET", `/media/${asset.id}/download`)).status, 403);
      assert.equal((await complete(asset.id)).status, 409);
    });

    it("keeps user posts and tips published after photo upload, and protects hidden-parent images", async () => {
      for (const kind of ["POST", "TIP"] as const) {
        const asset = await ready("CONTENT", uid(kind));
        assert.equal((await ctx.db.collection("content_entries").doc(uid(kind)).get()).data()!.status, "PUBLISHED");
        assert.equal((await request(null, "GET", `/media/${asset.id}/download`)).status, 200);
        await ctx.db.collection("content_entries").doc(uid(kind)).update({status: "HIDDEN"});
        assert.equal((await request(null, "GET", `/media/${asset.id}/download`)).status, 403);
        assert.equal((await request(uid("owner"), "POST", "/media", {
          parent_kind: "CONTENT", parent_id: uid(kind), content_type: "image/png",
        })).status, 409);
      }
      await ready("CONTENT", uid("ARTICLE"));
      assert.equal((await ctx.db.collection("content_entries").doc(uid("ARTICLE")).get()).data()!.status, "DRAFT");
    });

    it("accepts Android's authenticated multipart Storage upload and finalizes the private scan", {skip: !process.env.FIREBASE_AUTH_EMULATOR_HOST}, async () => {
      const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
      loopback(authHost);
      const email = `${prefix}@example.test`, password = "LocalMediaTest123!";
      await ctx.auth.createUser({uid: uid("owner"), email, password});
      try {
        const signIn = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
          method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password, returnSecureToken: true}),
        });
        const account = await signIn.json() as {idToken: string};
        assert.equal(signIn.status, 200, JSON.stringify(account));
        assert.ok(account.idToken);
        const parent = uid("http-scan");
        await seed("content_entries", parent, {kind: "SCAN", author_id: uid("owner"), status: "PRIVATE", title: "Real HTTP scan"});
        const ticket = await slot("SCAN", parent);
        const boundary = `ecoshare-${randomUUID()}`;
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify({name: ticket.storage_key, contentType: "image/png"})}\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);
        const upload = await fetch(`http://${storageHost}/v0/b/${encodeURIComponent(ticket.bucket)}/o?name=${encodeURIComponent(ticket.storage_key)}`, {
          method: "POST", headers: {Authorization: `Firebase ${account.idToken}`, "X-Goog-Upload-Protocol": "multipart", "Content-Type": `multipart/related; boundary=${boundary}`}, body,
        });
        const raw = await upload.text();
        assert.equal(upload.status, 200, raw);
        assert.equal((await complete(ticket.id)).status, 200);
        const stored = (await ctx.db.collection("media_assets").doc(ticket.id).get()).data()!;
        assert.equal(stored._status, "READY"); assert.equal(stored.visibility, "PRIVATE");
        assert.deepEqual((await ctx.bucket.file(ticket.storage_key).download())[0], png);
        assert.deepEqual((await request(uid("owner"), "GET", `/media/${ticket.id}/download`)).bytes, png);
        assert.equal((await request(uid("outsider"), "GET", `/media/${ticket.id}/download`)).status, 403);
        const metadata = JSON.parse(raw) as {downloadTokens?: string};
        if (metadata.downloadTokens) {
          const leaked = await fetch(`http://${storageHost}/v0/b/${encodeURIComponent(ticket.bucket)}/o/${encodeURIComponent(ticket.storage_key)}?alt=media&token=${encodeURIComponent(metadata.downloadTokens.split(",")[0]!)}`);
          assert.equal(leaked.status, 403, "Finalization must revoke an upload response's persistent token");
          await leaked.arrayBuffer();
        }
      } finally {
        await ctx.auth.deleteUser(uid("owner"));
      }
    });

    it("rejects MIME spoofing and prevents evidence changes after verification closes", async () => {
      const spoofed = await slot("VERIFICATION", uid("kyc"));
      await assertFails(
        file(spoofed.storage_key)
          .put(png, { contentType: "text/html" })
          .then(() => undefined),
      );
      await file(spoofed.storage_key).put(
        Buffer.from("<html>not a PNG image</html>"),
        { contentType: "image/png" },
      );
      const failed = await complete(spoofed.id);
      assert.equal(failed.status, 409);
      assert.equal(failed.data.error, "INVALID_FILE_SIGNATURE");
      assert.equal(
        (await ctx.db.collection("media_assets").doc(spoofed.id).get()).data()!
          ._status,
        "UPLOADING",
      );

      const closedKyc = uid("closed-kyc");
      await seed("verifications", closedKyc, {
        user_id: uid("owner"),
        status: "PENDING",
      });
      const closed = await slot("VERIFICATION", closedKyc);
      await file(closed.storage_key).put(png, { contentType: "image/png" });
      await ctx.db
        .collection("verifications")
        .doc(closedKyc)
        .update({ status: "VERIFIED" });
      const denied = await complete(closed.id);
      assert.equal(denied.status, 409);
      assert.equal(denied.data.error, "VERIFICATION_CLOSED");
      assert.equal(
        (await ctx.db.collection("media_assets").doc(closed.id).get()).data()!
          ._status,
        "UPLOADING",
      );
    });
  },
);
