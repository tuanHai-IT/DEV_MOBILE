import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const url = new URL("../../../admin-web/firebase-client.js", import.meta.url)
  .href;
const { FirebaseBackendClient } = await import(url);
const originalFetch = globalThis.fetch;
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: new URL("http://localhost:5174"),
});
after(() => {
  globalThis.fetch = originalFetch;
});
test("web client requires HTTPS outside explicit loopback emulator", () => {
  assert.throws(
    () =>
      new FirebaseBackendClient({
        apiBase: "http://remote.example/api",
        emulator: false,
      }),
  );
  assert.throws(
    () =>
      new FirebaseBackendClient({
        apiBase: "http://remote.example/api",
        emulator: true,
      }),
  );
  assert.throws(
    () =>
      new FirebaseBackendClient({
        apiBase: "http://localhost/api",
        emulator: true,
        authEmulatorHost: "remote.example:9099",
      }),
  );
});
test("web client refreshes token and preserves idempotency key on one auth retry", async () => {
  const calls: { url: string; headers: any; body: any }[] = [];
  let apiCalls = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    calls.push({ url: String(input), headers: init.headers, body: init.body });
    if (String(input).includes("accounts:"))
      return Response.json({
        idToken: "first-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
      });
    if (String(input).includes("/token?"))
      return Response.json({
        id_token: "new-token",
        refresh_token: "new-refresh",
        expires_in: 3600,
      });
    apiCalls++;
    return apiCalls === 1
      ? Response.json({ error: { message: "Expired" } }, { status: 401 })
      : Response.json({ id: "order-1" });
  }) as typeof fetch;
  const client = new FirebaseBackendClient({
    apiBase: "http://localhost:5050/v1",
    apiKey: "demo",
    emulator: true,
    authEmulatorHost: "127.0.0.1:9099",
  });
  await client.login("buyer@test.local", "test-password");
  assert.deepEqual(
    await client.request("/orders", {
      method: "POST",
      body: { items: [] },
      key: "stable-key-123",
    }),
    { id: "order-1" },
  );
  const requests = calls.filter((call) => call.url.endsWith("/orders"));
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].headers["Idempotency-Key"],
    requests[1].headers["Idempotency-Key"],
  );
  assert.equal(requests[1].headers.Authorization, "Bearer new-token");
  client.logout();
  assert.equal(client.session, null);
});

const emulatorConfig = () => ({ apiBase: "http://localhost:5050/v1", apiKey: "demo", emulator: true, authEmulatorHost: "127.0.0.1:9099" });
const authResponse = (token: string) => Response.json({ idToken: token, refreshToken: `refresh-${token}`, expiresIn: 3600 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const changedSession = (error: unknown) => (error as { code?: string }).code === "SESSION_CHANGED";

test("logout during refresh drops the token and never dispatches the waiting write", async () => {
  const refresh = deferred<Response>();
  let refreshCalls = 0, writes = 0;
  globalThis.fetch = (async (input: any) => {
    if (String(input).includes("accounts:")) return authResponse("old-token");
    if (String(input).includes("/token?")) { refreshCalls++; return refresh.promise; }
    writes++;
    return Response.json({ id: "must-not-create" });
  }) as typeof fetch;
  const client = new FirebaseBackendClient(emulatorConfig());
  await client.login("old@example.test", "test-password");
  client.session.expires = 0;
  const pending = client.request("/admin/community", { method: "POST", body: { body: "private draft" }, key: "stable-key-logout" });
  assert.equal(refreshCalls, 1);
  client.logout();
  refresh.resolve(Response.json({ id_token: "late-token", refresh_token: "late-refresh", expires_in: 3600 }));
  await assert.rejects(pending, changedSession);
  assert.equal(client.session, null);
  assert.equal(writes, 0);
});

test("an old refresh cannot overwrite a different account that has signed in", async () => {
  const refresh = deferred<Response>();
  let apiCalls = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input).includes("accounts:")) return authResponse(JSON.parse(init.body).email === "new@example.test" ? "new-account-token" : "old-account-token");
    if (String(input).includes("/token?")) return refresh.promise;
    apiCalls++;
    return Response.json({ private: true });
  }) as typeof fetch;
  const client = new FirebaseBackendClient(emulatorConfig());
  await client.login("old@example.test", "test-password");
  client.session.expires = 0;
  const oldRequest = client.request("/admin/users");
  await client.login("new@example.test", "another-password");
  refresh.resolve(Response.json({ id_token: "old-refreshed-token", refresh_token: "old-refresh", expires_in: 3600 }));
  await assert.rejects(oldRequest, changedSession);
  assert.equal(client.session.idToken, "new-account-token");
  assert.equal(apiCalls, 0);
  client.logout();
});

test("private responses started before logout are not delivered afterwards", async () => {
  const response = deferred<Response>();
  globalThis.fetch = (async (input: any) => String(input).includes("accounts:") ? authResponse("admin-token") : response.promise) as typeof fetch;
  const client = new FirebaseBackendClient(emulatorConfig());
  await client.login("admin@example.test", "test-password");
  const pending = client.request("/admin/users");
  client.logout();
  response.resolve(Response.json({ items: [{ email: "private@example.test" }] }));
  await assert.rejects(pending, changedSession);
  assert.equal(client.session, null);
});

test("parallel requests share a single refresh and continue with the new token", async () => {
  const refresh = deferred<Response>();
  let refreshCalls = 0;
  const authorizations: string[] = [];
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input).includes("accounts:")) return authResponse("expired-token");
    if (String(input).includes("/token?")) { refreshCalls++; return refresh.promise; }
    authorizations.push(init.headers.Authorization);
    return Response.json({ path: new URL(String(input)).pathname });
  }) as typeof fetch;
  const client = new FirebaseBackendClient(emulatorConfig());
  await client.login("admin@example.test", "test-password");
  client.session.expires = 0;
  const first = client.request("/admin/users"), second = client.request("/admin/community");
  assert.equal(refreshCalls, 1);
  refresh.resolve(Response.json({ id_token: "shared-new-token", refresh_token: "next-refresh", expires_in: 3600 }));
  await Promise.all([first, second]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizations, ["Bearer shared-new-token", "Bearer shared-new-token"]);
  client.logout();
});

test("actual editor form renders unchecked boolean settings as valid optional fields", async () => {
  // Exercise the shipped form builder in isolation with a minimal DOM. No Auth,
  // browser, or database is needed to check the browser validation attributes.
  const source = await readFile(new URL("../../../admin-web/backend.js", import.meta.url), "utf8");
  const start = source.indexOf("\nfunction form("), end = source.indexOf('\n$("edit").onsubmit', start);
  assert.ok(start >= 0 && end > start, "The actual shipped form builder must be present");
  const element = (tag: string, text?: string): any => ({ tagName: tag.toUpperCase(), textContent: text ?? "", dataset: {}, children: [], append(child: any) { this.children.push(child); }, replaceChildren() { this.children = []; }, querySelector() { return null; }, querySelectorAll() { return []; } });
  const fields = element("div"), submit = element("button"), editor = { open: false, showModal() { this.open = true; } };
  const ids: Record<string, any> = { "edit-title": element("h2"), fields, "edit-error": element("p"), edit: { querySelector: () => submit }, editor };
  const render = runInNewContext(`(${source.slice(start, end).trim()})`, { $: (id: string) => ids[id], node: element, labels: {}, crypto: { randomUUID: () => "form-test-key" }, editAction: null, pendingKey: null, editorVersion: 0 });
  render("Settings", [
    { name: "active", type: "checkbox", value: false },
    { name: "enabled", type: "checkbox", value: true },
    { name: "title", value: "A required title" },
    { name: "description", required: false },
  ], () => {});
  const inputs = fields.children.map((label: any) => label.children[0]);
  assert.equal(editor.open, true);
  assert.equal(inputs[0].checked, false);
  assert.equal(inputs[0].required, false, "inactive categories must be submittable");
  assert.equal(inputs[1].checked, true);
  assert.equal(inputs[1].required, false, "maintenance can be disabled without validation blocking submission");
  assert.equal(inputs[2].required, true);
  assert.equal(inputs[3].required, false);
});

test("local cloud proxy requires explicit opt-in and loopback on both the page and API", () => {
  const cloud = { apiBase: "http://127.0.0.1:5002/v1", apiKey: "public-test-key", emulator: false, localCloudProxy: true };
  assert.doesNotThrow(() => new FirebaseBackendClient(cloud));
  assert.throws(() => new FirebaseBackendClient({ ...cloud, localCloudProxy: false }));
  assert.throws(() => new FirebaseBackendClient({ ...cloud, emulator: true }));
  assert.throws(() => new FirebaseBackendClient({ ...cloud, authEmulatorHost: "127.0.0.1:9099" }));
  assert.throws(() => new FirebaseBackendClient({ ...cloud, apiBase: "http://remote.example/v1" }));
  assert.throws(() => new FirebaseBackendClient({ ...cloud, apiBase: "http://localhost.attacker.example/v1" }));
  const previous = globalThis.location;
  Object.defineProperty(globalThis, "location", { configurable: true, value: new URL("https://recycling-share-app.web.app") });
  try {
    assert.throws(() => new FirebaseBackendClient(cloud));
    assert.throws(() => new FirebaseBackendClient({ ...cloud, localCloudProxy: false, emulator: true, authEmulatorHost: "127.0.0.1:9099" }));
  } finally {
    Object.defineProperty(globalThis, "location", { configurable: true, value: previous });
  }
});

test("local cloud proxy uses real HTTPS Firebase Auth and refresh with HTTP only for loopback API", async () => {
  const calls: { url: string; headers: any }[] = [];
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    calls.push({ url, headers: init.headers });
    if (url.startsWith("https://identitytoolkit.googleapis.com/")) return authResponse("cloud-first-token");
    if (url.startsWith("https://securetoken.googleapis.com/")) return Response.json({ id_token: "cloud-refreshed-token", refresh_token: "cloud-refresh", expires_in: 3600 });
    assert.ok(url.startsWith("http://127.0.0.1:5002/v1/"));
    return Response.json({ project: "recycling-share-app" });
  }) as typeof fetch;
  const client = new FirebaseBackendClient({ apiBase: "http://127.0.0.1:5002/v1", apiKey: "public-test-key", emulator: false, localCloudProxy: true });
  await client.login("admin@example.test", "a-test-password");
  client.session.expires = 0;
  await client.request("/admin/dashboard");
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?"));
  assert.ok(calls[1].url.startsWith("https://securetoken.googleapis.com/v1/token?"));
  assert.equal(calls[2].url, "http://127.0.0.1:5002/v1/admin/dashboard");
  assert.equal(calls[2].headers.Authorization, "Bearer cloud-refreshed-token");
  assert.ok(calls.every(call => !call.url.includes("9099") && !call.url.includes("demo-recycling-share")));
  client.logout();
});
