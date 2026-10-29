import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApiError, optionalAuthentication, type Context } from "./core.js";
import { registerMarketplaceRoutes } from "./marketplace.js";
import { registerCommunityRoutes } from "./community.js";
import { registerPaymentRoutes } from "./payments.js";
import { registerMediaRoutes } from "./media.js";
import { registerAdminRoutes } from "./admin.js";
import { registerSocialRoutes } from "./social.js";
import { registerSocialAdminRoutes } from "./social-admin.js";

export function createApp(ctx: Context) {
  const app = express();
  app.disable("x-powered-by");
  const origins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, done) =>
        done(
          null,
          !origin ||
            origins.includes(origin) ||
            (ctx.emulator &&
              /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)),
        ),
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 3600,
    }),
  );
  app.use((req, res, next) => {
    res.locals.request_id = randomUUID();
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "X-Request-ID": res.locals.request_id,
    });
    next();
  });
  app.use(express.json({ limit: "128kb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  const router = express.Router();
  router.get("/health", (_req, res) =>
    res.json({ service: "ecoshare-api", status: "ok", emulator: ctx.emulator,
      ...(process.env.ECOSHARE_LOCAL_CLOUD === "true" ? {mode: "LOCAL_FIRESTORE_CLOUD", project_id: process.env.GCLOUD_PROJECT, media_backend: "firestore"} : {}) }),
  );
  router.use(optionalAuthentication(ctx));
  registerMarketplaceRoutes(router, ctx);
  registerCommunityRoutes(router, ctx);
  registerPaymentRoutes(router, ctx);
  registerMediaRoutes(router, ctx);
  registerAdminRoutes(router, ctx);
  registerSocialRoutes(router, ctx);
  registerSocialAdminRoutes(router, ctx);
  app.use(["/v1", "/api/v1"], router);
  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "API không tồn tại." } }),
  );
  const errors: ErrorRequestHandler = (error, req, res, _next) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            fields: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
            request_id: res.locals.request_id,
          },
        });
      return;
    }
    if (error instanceof ApiError) {
      res
        .status(error.status)
        .json({
          error: {
            code: error.code,
            message: error.message,
            request_id: res.locals.request_id,
          },
        });
      return;
    }
    if (
      error?.type === "entity.parse.failed" ||
      error?.type === "entity.too.large"
    ) {
      res
        .status(error.type === "entity.too.large" ? 413 : 400)
        .json({
          error: {
            code: "INVALID_BODY",
            message: "JSON không hợp lệ hoặc quá lớn.",
          },
        });
      return;
    }
    // Log identifiers and codes only; never tokens, document evidence or payment payloads.
    console.error(
      JSON.stringify({
        event: "request_failed",
        request_id: res.locals.request_id,
        code: String(error?.code ?? "INTERNAL"),
        name: String(error?.name ?? "Error"),
      }),
    );
    res
      .status(500)
      .json({
        error: {
          code: "INTERNAL",
          message: ["GET", "HEAD", "OPTIONS"].includes(req.method)
            ? "Không tải được dữ liệu. Vui lòng thử lại sau."
            : "Chưa xác nhận được kết quả. Vui lòng kiểm tra lại trước khi thử lại.",
          request_id: res.locals.request_id,
        },
      });
  };
  app.use(errors);
  return app;
}
