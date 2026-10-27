import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import "firebase/compat/firestore";
import "firebase/compat/storage";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const projectId = "demo-recycling-share";

function emulatorAddress(address: string): { host: string; port: number } {
  const url = new URL(`http://${address}`);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Rules tests require a loopback emulator",
  );
  assert.ok(Number(url.port) > 0, "An explicit emulator port is required");
  return { host: url.hostname, port: Number(url.port) };
}

async function ruleSource(file: string): Promise<string> {
  // npm --prefix backend executes in backend; direct node can execute at repo root.
  for (const path of [
    resolve(process.cwd(), "..", file),
    resolve(process.cwd(), file),
  ]) {
    try {
      return await readFile(path, "utf8");
    } catch {
      /* Try the other supported cwd. */
    }
  }
  throw new Error(`Cannot find ${file}`);
}

describe(
  "Firestore and Storage security rules",
  { skip: !firestoreHost, concurrency: false },
  () => {
    let env: RulesTestEnvironment;
    const db = (uid: string) => env.authenticatedContext(uid).firestore();
    const read = (uid: string, path: string) => db(uid).doc(path).get();

    before(async () => {
      assert.ok(firestoreHost, "FIRESTORE_EMULATOR_HOST is required");
      env = await initializeTestEnvironment({
        projectId,
        firestore: {
          ...emulatorAddress(firestoreHost),
          rules: await ruleSource("firestore.rules"),
        },
        ...(storageHost
          ? {
              storage: {
                ...emulatorAddress(storageHost),
                rules: await ruleSource("storage.rules"),
              },
            }
          : {}),
      });
      await env.clearFirestore();
      if (storageHost) {
        // clearStorage() only deletes root-level objects in this SDK version.
        // Walk nested upload folders so repeated local runs stay deterministic.
        await env.withSecurityRulesDisabled(async (ctx) => {
          const bucket = ctx.storage(`gs://${projectId}.appspot.com`);
          const clearFolder = async (path: string): Promise<void> => {
            const result = await bucket.ref(path).listAll();
            await Promise.all(result.items.map((item) => item.delete()));
            for (const prefix of result.prefixes)
              await clearFolder(prefix.fullPath);
          };
          await clearFolder("uploads");
        });
      }
      const documents: Record<string, Record<string, unknown>> = {
        "users/buyer": {
          id: "buyer",
          display_name: "Buyer",
          email: "buyer@example.test",
          role: "MEMBER",
          status: "ACTIVE",
        },
        "users/seller": {
          id: "seller",
          display_name: "Seller",
          email: "seller@example.test",
          role: "MEMBER",
          status: "ACTIVE",
        },
        "users/outsider": { id: "outsider", role: "MEMBER", status: "ACTIVE" },
        "users/admin": { id: "admin", role: "ADMIN", status: "ACTIVE" },
        "users/moderator": {
          id: "moderator",
          role: "MODERATOR",
          status: "ACTIVE",
        },
        "users/suspended": {
          id: "suspended",
          role: "ADMIN",
          status: "SUSPENDED",
        },
        "verifications/kyc": { id: "kyc", user_id: "buyer", status: "PENDING" },
        "verifications/suspended-kyc": {
          id: "suspended-kyc",
          user_id: "suspended",
          status: "PENDING",
        },
        "addresses/home": {
          user_id: "buyer",
          recipient: "Buyer",
          phone: "0900000000",
          line: "Private home",
        },
        "categories/public": { name: "Furniture", active: true },
        "categories/hidden": { name: "Hidden", active: false },
        "listings/public": {
          seller_id: "seller",
          title: "Public chair",
          status: "APPROVED",
        },
        "listings/draft": {
          seller_id: "seller",
          title: "Private draft",
          status: "PENDING",
        },
        "listing_items/public": { listing_id: "public", price_vnd: 50000 },
        "listing_items/draft": { listing_id: "draft", price_vnd: 50000 },
        "content_entries/public": {
          author_id: "seller",
          status: "PUBLISHED",
          title: "Reuse",
        },
        "content_entries/draft": {
          author_id: "seller",
          status: "DRAFT",
          title: "Unpublished",
        },
        "content_entries/private-scan": {
          author_id: "buyer", status: "PRIVATE", kind: "SCAN", title: "Private photo",
        },
        "content_entries/malformed-scan": {
          author_id: "buyer", status: "PUBLISHED", kind: "SCAN", title: "Must remain private",
        },
        "interactions/friend-request": {
          user_id: "buyer", target_user_id: "seller", _member_ids: ["buyer", "seller"], type: "FRIEND_REQUEST", status: "PENDING",
        },
        "interactions/like": {user_id: "buyer", type: "LIKE", content_id: "public"},
        "interactions/save": {user_id: "buyer", type: "SAVE", content_id: "public"},
        "collection_points/public": {
          name: "Recycling center",
          status: "ACTIVE",
        },
        "collection_points/hidden": {
          name: "Closed center",
          status: "INACTIVE",
        },
        "orders/private": {
          buyer_id: "buyer",
          seller_id: "seller",
          _member_ids: ["buyer", "seller"],
          status: "PAID",
          total_vnd: 50000,
        },
        "orders/completed": {
          buyer_id: "buyer",
          seller_id: "seller",
          _member_ids: ["buyer", "seller"],
          status: "COMPLETED",
        },
        "order_items/private": {
          order_id: "private",
          _member_ids: ["buyer", "seller"],
          quantity: 1,
        },
        "order_items/legacy": { order_id: "private", quantity: 1 },
        "payments/private": {
          order_id: "private",
          _member_ids: ["buyer", "seller"],
          status: "SUCCEEDED",
          amount_vnd: 50000,
        },
        "payments/legacy": {
          order_id: "private",
          status: "SUCCEEDED",
          amount_vnd: 50000,
        },
        "conversations/private": {
          member_a_id: "buyer",
          member_b_id: "seller",
          _member_ids: ["buyer", "seller"],
        },
        "messages/private": {
          conversation_id: "private",
          sender_id: "buyer",
          body: "Private conversation",
          _member_ids: ["buyer", "seller"],
        },
        "messages/legacy": {
          conversation_id: "private",
          sender_id: "buyer",
          body: "Private legacy conversation",
        },
        "reviews/public": {
          id: "public",
          order_id: "completed",
          author_id: "buyer",
          target_user_id: "seller",
          rating: 5,
          body: "Good",
          created_at: "2026-10-18T00:00:00.000Z",
        },
        "reviews/pending": {
          order_id: "private",
          author_id: "buyer",
          target_user_id: "seller",
          rating: 5,
          body: "Not completed",
        },
        "reviews/sensitive": {
          order_id: "completed",
          author_id: "buyer",
          target_user_id: "seller",
          rating: 5,
          body: "Good",
          email: "must-not-leak@example.test",
        },
        "reports/content": {
          reporter_id: "buyer",
          order_id: null,
          listing_id: "draft",
          reason: "Spam",
        },
        "reports/financial": {
          reporter_id: "buyer",
          order_id: "private",
          reason: "Dispute",
        },
        "interactions/private": {
          user_id: "buyer",
          type: "NOTIFICATION",
          body: "Private",
        },
        "green_ledger/private": {
          user_id: "buyer",
          points: 10,
          reason: "Order",
        },
        "audit_logs/private": {
          actor_id: "admin",
          action: "MODERATE_LISTING",
          entity_type: "Listing",
        },
        "system_settings/private": {
          key: "shipping",
          value_json: '{"shipping_vnd":15000}',
        },
        "media_assets/kyc": {
          uploader_id: "buyer",
          visibility: "PRIVATE",
          verification_id: "kyc",
          storage_key: "uploads/buyer/kyc/original",
          mime_type: "application/pdf",
          _status: "READY",
        },
        "media_assets/public": {
          uploader_id: "seller",
          visibility: "PUBLIC",
          listing_id: "public",
          storage_key: "uploads/seller/public/original",
          mime_type: "image/png",
          _status: "READY",
        },
        "media_assets/draft": {
          uploader_id: "seller",
          visibility: "PUBLIC",
          listing_id: "draft",
          storage_key: "uploads/seller/draft/original",
          mime_type: "image/png",
          _status: "READY",
        },
        "media_assets/malformed-scan": {
          uploader_id: "buyer", visibility: "PUBLIC", content_id: "malformed-scan", _parent_type: "SCAN", _status: "READY", mime_type: "image/png",
        },
      };
      for (const id of [
        "allowed",
        "mime",
        "metadata",
        "path",
        "zero",
        "large",
        "pdf",
        "public-pdf",
        "suspended",
        "ready",
        "scan-public",
        "scan-private",
      ]) {
        const uid = id === "suspended" ? "suspended" : "buyer";
        documents[`media_assets/upload-${id}`] = {
          id: `upload-${id}`,
          uploader_id: uid,
          visibility: ["public-pdf", "scan-public"].includes(id) ? "PUBLIC" : "PRIVATE",
          ...(id.startsWith("scan-") ? {_parent_type: "SCAN"} : {}),
          verification_id: "kyc",
          storage_key: `uploads/${uid}/upload-${id}/original`,
          mime_type: id.includes("pdf") ? "application/pdf" : "image/png",
          _status: id === "ready" ? "READY" : "UPLOADING",
          _max_bytes: id === "large" ? 3 : 10485760,
        };
      }
      await env.withSecurityRulesDisabled(async (ctx) => {
        const batch = ctx.firestore().batch();
        for (const [path, data] of Object.entries(documents))
          batch.set(ctx.firestore().doc(path), data);
        await batch.commit();
      });
    });

    after(async () => {
      if (env) await env.cleanup();
    });

    it("rejects self-promotion, KYC approval, money, inventory and green point writes", async () => {
      for (const [path, data] of Object.entries({
        "users/buyer": { role: "ADMIN" },
        "verifications/kyc": { status: "VERIFIED" },
        "orders/private": { status: "PAID", total_vnd: 1 },
        "payments/fake": { order_id: "private", status: "SUCCEEDED" },
        "listing_items/public": { stock: 999 },
        "green_ledger/fake": { user_id: "buyer", points: 99999 },
      }))
        await assertFails(db("buyer").doc(path).set(data, { merge: true }));
    });

    it("requires backend mutations even for an administrator", async () => {
      await assertFails(
        db("admin").doc("users/buyer").update({ role: "ADMIN" }),
      );
      await assertFails(
        db("admin").doc("payments/private").update({ status: "SUCCEEDED" }),
      );
      await assertFails(db("admin").doc("audit_logs/private").delete());
      await assertFails(
        db("admin").doc("unrecognized/server-only").set({ anything: true }),
      );
    });

    it("exposes approved listings and their items to anonymous users", async () => {
      const anon = env.unauthenticatedContext().firestore();
      await assertSucceeds(anon.doc("listings/public").get());
      await assertSucceeds(anon.doc("listing_items/public").get());
      await assertFails(anon.doc("listings/draft").get());
      await assertFails(anon.doc("listing_items/draft").get());
    });

    it("requires a query to constrain public listings rather than treating rules as filters", async () => {
      const anon = env.unauthenticatedContext().firestore();
      await assertSucceeds(
        anon.collection("listings").where("status", "==", "APPROVED").get(),
      );
      await assertFails(anon.collection("listings").get());
    });

    it("keeps unpublished content private while allowing moderation and ownership", async () => {
      await assertSucceeds(read("seller", "listings/draft"));
      await assertSucceeds(read("moderator", "listings/draft"));
      await assertSucceeds(read("seller", "content_entries/draft"));
      await assertSucceeds(read("moderator", "content_entries/draft"));
      await assertFails(read("buyer", "content_entries/draft"));
      await assertFails(read("outsider", "listing_items/draft"));
    });

    it("exposes only active reference data and published community content", async () => {
      const anon = env.unauthenticatedContext().firestore();
      for (const path of [
        "categories/public",
        "collection_points/public",
        "content_entries/public",
      ]) {
        await assertSucceeds(anon.doc(path).get());
      }
      for (const path of [
        "categories/hidden",
        "collection_points/hidden",
        "content_entries/draft",
      ]) {
        await assertFails(anon.doc(path).get());
        await assertSucceeds(read("admin", path));
      }
    });

    it("protects user profiles, verification documents and home addresses", async () => {
      for (const path of [
        "users/buyer",
        "verifications/kyc",
        "addresses/home",
      ]) {
        await assertSucceeds(read("buyer", path));
        await assertSucceeds(read("admin", path));
        await assertFails(read("seller", path));
        await assertFails(read("moderator", path));
        await assertFails(
          env.unauthenticatedContext().firestore().doc(path).get(),
        );
      }
    });

    it("limits orders and financial records to their participants or an administrator", async () => {
      for (const path of [
        "orders/private",
        "order_items/private",
        "order_items/legacy",
        "payments/private",
        "payments/legacy",
      ]) {
        await assertSucceeds(read("buyer", path));
        await assertSucceeds(read("seller", path));
        await assertSucceeds(read("admin", path));
        await assertFails(read("outsider", path));
        await assertFails(read("moderator", path));
      }
    });

    it("limits chat records to conversation participants and administrators", async () => {
      for (const path of [
        "conversations/private",
        "messages/private",
        "messages/legacy",
      ]) {
        await assertSucceeds(read("buyer", path));
        await assertSucceeds(read("seller", path));
        await assertSucceeds(read("admin", path));
        await assertFails(read("outsider", path));
        await assertFails(read("moderator", path));
      }
      await assertFails(
        db("outsider")
          .doc("messages/injected")
          .set({
            conversation_id: "private",
            sender_id: "buyer",
            _member_ids: ["outsider"],
            body: "Injected message",
          }),
      );
    });

    it("keeps notifications and green points private", async () => {
      for (const path of ["interactions/private", "green_ledger/private"]) {
        await assertSucceeds(read("buyer", path));
        await assertSucceeds(read("admin", path));
        await assertFails(read("outsider", path));
        await assertFails(read("moderator", path));
      }
    });

    it("separates content moderation reports from financial disputes", async () => {
      await assertSucceeds(read("buyer", "reports/financial"));
      await assertSucceeds(read("admin", "reports/financial"));
      await assertSucceeds(read("moderator", "reports/content"));
      await assertFails(read("moderator", "reports/financial"));
      await assertFails(read("seller", "reports/financial"));
      await assertFails(read("outsider", "reports/content"));
    });

    it("only publishes whitelisted reviews for completed orders", async () => {
      const anon = env.unauthenticatedContext().firestore();
      await assertSucceeds(anon.doc("reviews/public").get());
      await assertFails(anon.doc("reviews/pending").get());
      await assertFails(anon.doc("reviews/sensitive").get());
      await assertSucceeds(read("buyer", "reviews/pending"));
    });

    it("never publishes private verification media or media from unapproved parents", async () => {
      const anon = env.unauthenticatedContext().firestore();
      await assertSucceeds(anon.doc("media_assets/public").get());
      await assertFails(anon.doc("media_assets/draft").get());
      await assertFails(anon.doc("media_assets/kyc").get());
      await assertSucceeds(read("buyer", "media_assets/kyc"));
      await assertSucceeds(read("admin", "media_assets/kyc"));
      await assertFails(read("moderator", "media_assets/kyc"));
      await assertFails(read("seller", "media_assets/kyc"));
    });

    it("restricts system settings and sensitive audit logs to administrators", async () => {
      await assertSucceeds(read("admin", "system_settings/private"));
      await assertSucceeds(read("admin", "audit_logs/private"));
      await assertFails(read("moderator", "audit_logs/private"));
      await assertFails(read("moderator", "system_settings/private"));
      await assertFails(read("buyer", "audit_logs/private"));
      await assertFails(read("buyer", "system_settings/private"));
    });
    it("keeps scan documents and photos private even when a malformed scan says PUBLISHED", async () => {
      for (const path of ["content_entries/private-scan", "content_entries/malformed-scan", "media_assets/malformed-scan"]) {
        await assertFails(env.unauthenticatedContext().firestore().doc(path).get());
        await assertFails(read("outsider", path));
        await assertFails(read("moderator", path));
        await assertSucceeds(read("buyer", path));
        await assertSucceeds(read("admin", path));
      }
    });
    it("lets the recipient read a friend request while preserving reaction identities", async () => {
      await assertSucceeds(read("buyer", "interactions/friend-request"));
      await assertSucceeds(read("seller", "interactions/friend-request"));
      await assertFails(read("outsider", "interactions/friend-request"));
      for (const path of ["interactions/like", "interactions/save"]) {
        await assertSucceeds(read("buyer", path));
        await assertFails(read("seller", path));
        await assertFails(env.unauthenticatedContext().firestore().doc(path).get());
      }
    });

    it("rejects private reads for suspended users even with an admin role", async () => {
      for (const path of [
        "users/suspended",
        "verifications/suspended-kyc",
        "orders/private",
        "system_settings/private",
      ]) {
        await assertFails(read("suspended", path));
      }
      await assertSucceeds(read("suspended", "listings/public"));
    });

    it("ignores role claims supplied in an authentication token", async () => {
      const forgedAdmin = env
        .authenticatedContext("outsider", { role: "ADMIN", admin: true })
        .firestore();
      await assertFails(forgedAdmin.doc("users/buyer").get());
      await assertFails(forgedAdmin.doc("system_settings/private").get());
    });

    it("observes role revocation immediately in the user document", async () => {
      await assertSucceeds(read("admin", "system_settings/private"));
      try {
        await env.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc("users/admin").update({ role: "MEMBER" });
        });
        await assertFails(read("admin", "system_settings/private"));
      } finally {
        await env.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc("users/admin").update({ role: "ADMIN" });
        });
      }
    });

    describe(
      "Storage upload boundary",
      { skip: !storageHost, concurrency: false },
      () => {
        const storage = (uid: string) => {
          const instance = env
            .authenticatedContext(uid)
            .storage(`gs://${projectId}.appspot.com`);
          instance.setMaxUploadRetryTime(1000);
          return instance;
        };
        const bytes = new Uint8Array([137, 80, 78, 71]);

        it("allows the exact one-time upload slot then rejects overwrite and all direct reads", async () => {
          const file = storage("buyer").ref(
            "uploads/buyer/upload-allowed/original",
          );
          await assertSucceeds(
            file.put(bytes, { contentType: "image/png" }).then(() => undefined),
          );
          await assertFails(
            file.put(bytes, { contentType: "image/png" }).then(() => undefined),
          );
          await assertFails(file.getMetadata());
          await assertFails(file.getDownloadURL());
          await assertFails(
            storage("admin")
              .ref("uploads/buyer/upload-allowed/original")
              .getMetadata(),
          );
          await assertFails(file.delete());
        });

        it("rejects upload slots owned by another user, missing slots and altered paths", async () => {
          await assertFails(
            storage("seller")
              .ref("uploads/buyer/upload-path/original")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/not-created/original")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-path/other")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
        });

        it("rejects unapproved MIME types, mismatches, empty files and oversized slot uploads", async () => {
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-mime/original")
              .put(bytes, { contentType: "text/html" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-mime/original")
              .put(bytes, { contentType: "image/jpeg" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-zero/original")
              .put(new Uint8Array(), { contentType: "image/png" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-large/original")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
        });

        it("rejects custom metadata, completed slots and suspended accounts", async () => {
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-metadata/original")
              .put(bytes, {
                contentType: "image/png",
                customMetadata: { unapproved: "attacker-controlled" },
              })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-ready/original")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
          await assertFails(
            storage("suspended")
              .ref("uploads/suspended/upload-suspended/original")
              .put(bytes, { contentType: "image/png" })
              .then(() => undefined),
          );
        });

        it("allows a PDF exclusively within the backend-issued private evidence slot", async () => {
          await assertSucceeds(
            storage("buyer")
              .ref("uploads/buyer/upload-pdf/original")
              .put(bytes, { contentType: "application/pdf" })
              .then(() => undefined),
          );
          await assertFails(
            storage("buyer")
              .ref("uploads/buyer/upload-public-pdf/original")
              .put(bytes, { contentType: "application/pdf" })
              .then(() => undefined),
          );
        });
        it("requires private visibility for SCAN upload tickets", async () => {
          await assertFails(storage("buyer").ref("uploads/buyer/upload-scan-public/original").put(bytes, {contentType: "image/png"}).then(() => undefined));
          await assertSucceeds(storage("buyer").ref("uploads/buyer/upload-scan-private/original").put(bytes, {contentType: "image/png"}).then(() => undefined));
          await assertFails(storage("buyer").ref("uploads/buyer/upload-scan-private/original").getDownloadURL());
        });
      },
    );
  },
);
