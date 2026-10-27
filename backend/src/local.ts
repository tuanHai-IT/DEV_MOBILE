import { createApp } from "./app.js";
import { createContext, requireThat } from "./core.js";
const ctx = createContext();
requireThat(
  ctx.emulator,
  400,
  "EMULATOR_ONLY",
  "Local server chỉ chạy với đủ Auth/Firestore/Storage emulator.",
);
const port = Number(process.env.PORT ?? 5050);
createApp(ctx).listen(port, "127.0.0.1", () =>
  console.log(`EcoShare API http://127.0.0.1:${port}/v1 (Firebase Emulator)`),
);
