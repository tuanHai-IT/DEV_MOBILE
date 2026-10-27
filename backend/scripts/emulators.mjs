import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const mode = process.argv[2] ?? "start";
if (!["start", "test"].includes(mode)) throw new Error("Use start or test");
const cli = path.join(
  root,
  "backend/node_modules/firebase-tools/lib/bin/firebase.js",
);
const args = [
  cli,
  mode === "test" ? "emulators:exec" : "emulators:start",
  "--config",
  path.join(root, "firebase.json"),
  "--project",
  "demo-recycling-share",
  "--only",
  mode === "test"
    ? "auth,firestore,storage"
    : "auth,firestore,functions,storage,hosting",
];
if (mode === "test") args.push("npm --prefix backend run test:integration");
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
