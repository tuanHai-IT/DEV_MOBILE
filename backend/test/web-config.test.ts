import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { configModuleForPage, validateWebConfig, loadFirebaseWebConfig } = await import(new URL("../../../admin-web/firebase-config-loader.js", import.meta.url).href);
const { productionConfigFromAndroid, localCloudConfigFromAndroid } = await import(new URL("../../../admin-web/scripts/configure-firebase.mjs", import.meta.url).href);
const production = { projectId: "recycling-share-app", apiKey: "test-public-web-key", apiBase: "/api/v1", emulator: false };
const local = { projectId: "demo-recycling-share", apiKey: "demo-key", apiBase: "http://127.0.0.1:5001/demo-recycling-share/asia-southeast1/api/v1", emulator: true, authEmulatorHost: "127.0.0.1:9099" };

test("cloud hosts only import production config and use the same-origin Hosting rewrite", async () => {
  for (const host of ["recycling-share-app.web.app", "recycling-share-app.firebaseapp.com", "admin.example.com"]) {
    const imports: string[] = [];
    const config = await loadFirebaseWebConfig(`https://${host}/`, async (path: string) => {
      imports.push(path);
      return { default: path.endsWith("production.js") ? production : local };
    });
    assert.deepEqual(imports, ["./firebase-config.production.js"]);
    assert.equal(config.emulator, false);
    assert.equal(new URL(config.apiBase, `https://${host}/`).origin, `https://${host}`);
  }
});

test("cloud refuses Emulator, demo projects, Auth emulator and foreign API origins", async () => {
  for (const config of [local, { ...production, emulator: true }, { ...production, projectId: "demo-recycling-share" }, { ...production, authEmulatorHost: "127.0.0.1:9099" }, { ...production, localCloudProxy: true }, { ...production, apiBase: "http://localhost:5001/v1" }, { ...production, apiBase: "https://other.example.com/api/v1" }]) {
    const imports: string[] = [];
    await assert.rejects(loadFirebaseWebConfig("https://recycling-share-app.web.app/", async (path: string) => {
      imports.push(path);
      return { default: config };
    }));
    assert.deepEqual(imports, ["./firebase-config.production.js"]);
  }
});

test("external HTTP and misleading localhost suffixes never become local preview", () => {
  assert.throws(() => configModuleForPage("http://admin.example.com/"));
  assert.equal(configModuleForPage("https://localhost.attacker.example/"), "./firebase-config.production.js");
  assert.throws(() => validateWebConfig(local, "https://localhost.attacker.example/"));
});

test("local previews on both ports keep loading the developer Emulator file", async () => {
  for (const url of ["http://localhost:5173/", "http://127.0.0.1:5174/"]) {
    const imports: string[] = [];
    const config = await loadFirebaseWebConfig(url, async (path: string) => {
      imports.push(path);
      assert.equal(path, "./firebase-config.local.js");
      return { default: local };
    });
    assert.deepEqual(imports, ["./firebase-config.local.js"]);
    assert.equal(config.projectId, "demo-recycling-share");
    assert.equal(config.emulator, true);
  }
});

test("production configuration derives only public fields from the matching Android app", () => {
  const android = { project_info: { project_id: "recycling-share-app", project_number: "not-used" }, client: [
    { client_info: { android_client_info: { package_name: "other.package" } }, api_key: [{ current_key: "wrong-key" }] },
    { client_info: { android_client_info: { package_name: "com.example.recyclingshareapp" } }, api_key: [{ current_key: production.apiKey }] },
  ] };
  assert.deepEqual(productionConfigFromAndroid(android, "recycling-share-app"), production);
  assert.throws(() => productionConfigFromAndroid(android, "other-project"));
  assert.throws(() => productionConfigFromAndroid({ ...android, client: [] }, "recycling-share-app"));
});

test("Hosting excludes local config and prepares a production file before deployment", async () => {
  const firebase = JSON.parse(await readFile(new URL("../../../firebase.json", import.meta.url), "utf8"));
  assert.ok(firebase.hosting.ignore.includes("firebase-config.local.js"));
  assert.ok(firebase.hosting.ignore.includes("scripts/**"));
  assert.ok(!firebase.hosting.ignore.includes("firebase-config.production.js"));
  assert.ok(firebase.hosting.predeploy.includes("node admin-web/scripts/configure-firebase.mjs"));
  assert.ok(firebase.hosting.rewrites.some((rewrite: any) => rewrite.source === "/api/**" && rewrite.function.functionId === "api"));
});

test("local cloud config derives real public Auth config without changing production mode", () => {
  const android = { project_info: { project_id: production.projectId }, client: [{
    client_info: { android_client_info: { package_name: "com.example.recyclingshareapp" } },
    api_key: [{ current_key: production.apiKey }],
  }] };
  const config = localCloudConfigFromAndroid(android, production.projectId);
  assert.deepEqual(config, { ...production, apiBase: "http://127.0.0.1:5002/v1", localCloudProxy: true });
  assert.equal(config.emulator, false);
  assert.ok(!("authEmulatorHost" in config));
  assert.deepEqual(productionConfigFromAndroid(android, production.projectId), production);
});

test("loader allows local Spark proxy only with real Auth on explicit loopback preview", async () => {
  const config = { ...production, apiBase: "http://127.0.0.1:5002/v1", localCloudProxy: true };
  const loaded = await loadFirebaseWebConfig("http://localhost:5173/", async (path: string) => {
    assert.equal(path, "./firebase-config.local.js");
    return { default: config };
  });
  assert.deepEqual(loaded, config);
  for (const invalid of [{ ...config, emulator: true }, { ...config, authEmulatorHost: "127.0.0.1:9099" }, { ...config, apiBase: "http://external.example/v1" }, { ...config, projectId: "demo-recycling-share" }])
    assert.throws(() => validateWebConfig(invalid, "http://localhost:5173/"));
  assert.throws(() => validateWebConfig(config, "https://recycling-share-app.web.app/"));
});
