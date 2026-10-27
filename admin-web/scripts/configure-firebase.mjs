import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateWebConfig } from "../firebase-config-loader.js";

export function productionConfigFromAndroid(android, targetProject) {
  const projectId = android?.project_info?.project_id;
  if (targetProject && targetProject !== projectId)
    throw new Error("Hosting deployment project does not match app/google-services.json.");
  const client = android?.client?.find((entry) =>
    entry.client_info?.android_client_info?.package_name === "com.example.recyclingshareapp");
  const apiKey = client?.api_key?.find((entry) => typeof entry.current_key === "string")?.current_key;
  return validateWebConfig({ projectId, apiKey, apiBase: "/api/v1", emulator: false }, `https://${projectId}.web.app`);
}

export function localCloudConfigFromAndroid(android, targetProject) {
  const production = productionConfigFromAndroid(android, targetProject);
  return validateWebConfig({ ...production, apiBase: "http://127.0.0.1:5002/v1", localCloudProxy: true }, "http://127.0.0.1:5173/");
}

async function readAndroidConfig() {
  let android;
  try {
    android = JSON.parse(await readFile(new URL("../../app/google-services.json", import.meta.url), "utf8"));
  } catch {
    // JSON parse errors can include excerpts; do not echo client config values.
    throw new Error("Cannot read valid app/google-services.json before preparing Firebase client configuration.");
  }
  return android;
}

export async function prepareProductionConfig() {
  const config = productionConfigFromAndroid(await readAndroidConfig(), process.env.GCLOUD_PROJECT);
  await writeFile(new URL("../firebase-config.production.js", import.meta.url),
    "// Generated public Firebase client configuration; never add merchant/service-account secrets.\nexport default " + JSON.stringify(config, null, 2) + ";\n", "utf8");
  console.log(`Prepared Firebase Hosting public configuration for ${config.projectId}.`);
}

export async function prepareLocalCloudConfig() {
  const config = localCloudConfigFromAndroid(await readAndroidConfig(), process.env.GCLOUD_PROJECT);
  await writeFile(new URL("../firebase-config.local.js", import.meta.url),
    "// Local-only cloud proxy. Real Firebase Auth/Firestore; API runs on this computer.\nexport default " + JSON.stringify(config, null, 2) + ";\n", "utf8");
  console.log(`Prepared local cloud proxy configuration for ${config.projectId}; API http://127.0.0.1:5002/v1.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const prepare = args.length === 0 ? prepareProductionConfig
    : args.length === 1 && args[0] === "--local-cloud" ? prepareLocalCloudConfig
    : async () => { throw new Error("Use no arguments for Hosting or --local-cloud for the local Spark proxy."); };
  prepare().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
