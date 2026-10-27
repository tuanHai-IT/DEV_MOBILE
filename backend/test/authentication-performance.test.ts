import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import type { Request, Response } from "express";
import { ApiError, optionalAuthentication, type Context } from "../src/core.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function runAuthentication(context: Context) {
  const response = { locals: {} } as Response;
  const completed = new Promise<unknown>(resolve => {
    optionalAuthentication(context)(
      { get: (name: string) => name === "Authorization" ? "Bearer signed-token" : undefined } as Request,
      response,
      error => resolve(error),
    );
  });
  return { response, completed };
}

function fixture() {
  const revocation = deferred<any>();
  const profile = deferred<any>();
  const checks: boolean[] = [];
  let reads = 0, transactions = 0;
  const row = { id: "member", role: "MEMBER", status: "ACTIVE", points_balance: 100 };
  const context = {
    auth: {
      verifyIdToken: async (_token: string, checkRevoked: boolean) => {
        checks.push(checkRevoked);
        return checkRevoked ? revocation.promise : { uid: row.id };
      },
    },
    db: {
      collection: (name: string) => {
        assert.equal(name, "users");
        return { doc: (uid: string) => {
          assert.equal(uid, row.id);
          return { get: () => { reads++; return profile.promise; } };
        } };
      },
      runTransaction: () => { transactions++; throw new Error("Existing profiles must not start a transaction"); },
    },
  } as unknown as Context;
  return { context, revocation, profile, checks, row, counters: () => ({reads, transactions}) };
}

test("authentication overlaps revocation with one fresh role read and waits for both", async () => {
  const setup = fixture();
  const request = runAuthentication(setup.context);
  await setImmediate();
  assert.deepEqual(setup.checks, [false, true]);
  assert.deepEqual(setup.counters(), { reads: 1, transactions: 0 });
  assert.equal(request.response.locals.actor, undefined);
  setup.profile.resolve({ exists: true, id: "member", data: () => setup.row });
  await setImmediate();
  assert.equal(request.response.locals.actor, undefined, "A live profile must not bypass the revocation check");
  setup.revocation.resolve({ uid: "member" });
  assert.equal(await request.completed, undefined);
  assert.deepEqual(request.response.locals.actor, { uid: "member", role: "MEMBER", status: "ACTIVE", email: undefined });
  assert.equal(request.response.locals.authenticated_user.points_balance, 100);
});

test("a revoked token is rejected even when the concurrent live profile read succeeds", async () => {
  const setup = fixture();
  const request = runAuthentication(setup.context);
  await setImmediate();
  setup.profile.resolve({ exists: true, id: "member", data: () => setup.row });
  setup.revocation.reject(new Error("auth/id-token-revoked"));
  const error = await request.completed;
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 401);
  assert.equal(error.code, "INVALID_TOKEN");
  assert.equal(request.response.locals.actor, undefined);
});

test("a suspended fresh profile is denied and database failures remain server failures", async () => {
  const suspended = fixture();
  const request = runAuthentication(suspended.context);
  await setImmediate();
  suspended.revocation.resolve({ uid: "member" });
  suspended.profile.resolve({ exists: true, id: "member", data: () => ({ ...suspended.row, status: "SUSPENDED" }) });
  const denied = await request.completed;
  assert.ok(denied instanceof ApiError);
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "ACCOUNT_SUSPENDED");

  const unavailable = fixture();
  const failed = runAuthentication(unavailable.context);
  await setImmediate();
  unavailable.revocation.resolve({ uid: "member" });
  const databaseError = new Error("Firestore unavailable");
  unavailable.profile.reject(databaseError);
  assert.equal(await failed.completed, databaseError);
  assert.equal(failed.response.locals.actor, undefined);
});
