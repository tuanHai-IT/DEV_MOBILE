import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { createApp } from "./app.js";
import { createContext } from "./core.js";
import { expireOrders } from "./marketplace.js";

setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });
const providers = (process.env.ENABLED_PAYMENT_PROVIDERS ?? "")
  .split(",")
  .map((value) => value.trim());
const secrets = [
  ...(providers.includes("MOMO") ? ["MOMO_SECRET_KEY", "MOMO_ACCESS_KEY"] : []),
  ...(providers.includes("VNPAY") ? ["VNPAY_HASH_SECRET"] : []),
];
let application: ReturnType<typeof createApp> | undefined;
export const api = onRequest(
  { memory: "512MiB", timeoutSeconds: 60, secrets },
  (req, res) => {
    application ??= createApp(createContext());
    application(req, res);
  },
);
export const expireReservations = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Ho_Chi_Minh",
    timeoutSeconds: 300,
  },
  async () => {
    await expireOrders(createContext());
  },
);
