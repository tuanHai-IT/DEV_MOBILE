import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { capturePasswordCode, createPasswordSetup } = await import(new URL("../../../admin-web/setup-password.js", import.meta.url).href);
const config = { projectId: "recycling-share-app", apiKey: "public-test-key", apiBase: "http://127.0.0.1:5002/v1", emulator: false, localCloudProxy: true };
const page = "http://127.0.0.1:5173/setup-password.html";
const code = "fake-local-password-action-code";

test("setup captures only fragment action codes and removes them from the address immediately", () => {
  const replacements: string[] = [];
  const history = { replaceState: (_state: unknown, _title: string, url: string) => replacements.push(url) };
  assert.equal(capturePasswordCode(page + "#oobCode=" + code, history), code);
  assert.deepEqual(replacements, ["/setup-password.html"]);
  assert.throws(() => capturePasswordCode(page + "?oobCode=" + code, history));
  assert.equal(replacements.at(-1), "/setup-password.html");
});

test("setup rejects remote hosts and Emulator configuration before calling Firebase", () => {
  const unusedFetch = async () => { throw new Error("must not make a request"); };
  assert.throws(() => createPasswordSetup(config, "https://recycling-share-app.web.app/setup-password.html", code, unusedFetch));
  assert.throws(() => createPasswordSetup({ ...config, localCloudProxy: false }, page, code, unusedFetch));
  assert.throws(() => createPasswordSetup({ ...config, emulator: true }, page, code, unusedFetch));
});

test("verify and confirm send only fixed Google HTTPS reset calls and never send email", async () => {
  const calls: { url: string; body: any; options: any }[] = [];
  const fetcher = async (url: string, options: any) => {
    calls.push({ url, body: JSON.parse(options.body), options });
    return Response.json({ email: "owner@example.test", requestType: "PASSWORD_RESET" });
  };
  const setup = createPasswordSetup(config, page, code, fetcher);
  assert.equal(await setup.verify(), "owner@example.test");
  const password = "  User-chosen password 123!  ";
  assert.equal(await setup.confirm(password, password), "owner@example.test");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { oobCode: code });
  assert.deepEqual(calls[1].body, { oobCode: code, newPassword: password });
  for (const call of calls) {
    assert.equal(call.url, "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=public-test-key");
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.referrerPolicy, "no-referrer");
    assert.equal(call.options.credentials, "omit");
    assert.equal(call.options.cache, "no-store");
    assert.ok(!call.url.includes("sendOobCode") && !call.url.includes("127.0.0.1"));
  }
  await assert.rejects(setup.confirm(password, password));
  assert.equal(calls.length, 2, "a used code is never submitted a second time");
});

test("unverified codes and invalid or mismatching passwords never dispatch a password change", async () => {
  let requests = 0;
  const setup = createPasswordSetup(config, page, code, async () => { requests++; return Response.json({ email: "owner@example.test", requestType: "PASSWORD_RESET" }); });
  await assert.rejects(setup.confirm("A-valid-password", "A-valid-password"));
  assert.equal(requests, 0);
  await setup.verify();
  await assert.rejects(setup.confirm("short", "short"));
  await assert.rejects(setup.confirm("A-valid-password", "Different-password"));
  assert.equal(requests, 1);
  const expired = createPasswordSetup(config, page, code, async () => Response.json({ error: { message: "EXPIRED_OOB_CODE" } }, { status: 400 }));
  await assert.rejects(expired.verify(), /hết hạn/);
});

test("password page is excluded from Hosting and cannot fallback-submit passwords to Node", async () => {
  const firebase = JSON.parse(await readFile(new URL("../../../firebase.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../../../admin-web/setup-password.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../../../admin-web/setup-password.js", import.meta.url), "utf8");
  assert.ok(firebase.hosting.ignore.includes("setup-password*"));
  assert.ok(html.includes("form-action 'none'"));
  assert.ok(html.includes("connect-src https://identitytoolkit.googleapis.com"));
  assert.ok(!/<input[^>]*\bname\s*=/.test(html));
  assert.ok(!/localStorage|sessionStorage|console\./.test(js));
});
