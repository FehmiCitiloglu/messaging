import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import compression from "compression";
import cors from "cors";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import { config } from "./config.js";
import { ApiError, ErrorCode, errors } from "./lib/errors.js";
import { RateLimiter } from "./lib/rateLimit.js";
import { clientIp, rateLimit } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { usersRouter } from "./routes/users.js";
import { setupSocket } from "./socket.js";

export interface Backend {
  app: Express;
  server: HttpServer;
  io: Server;
}

export function buildBackend(): Backend {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
    // Cap frame size: message payloads are tiny; 64 KiB is plenty.
    maxHttpBufferSize: config.socketMaxHttpBufferSize,
  });
  setupSocket(io);

  // Security headers first.
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.disable("x-powered-by");

  // Per-IP rate limiting on the whole API surface.
  const ipLimiter = new RateLimiter(60_000, config.rateLimitIpPerMin);
  // Per-user rate limiting for authenticated routes (after auth, so keyed by userId).
  const userLimiter = new RateLimiter(60_000, config.rateLimitUserPerMin);
  const perUser = rateLimit(userLimiter, (req) => req.userId ?? clientIp(req));

  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  const api = express.Router();
  api.use(rateLimit(ipLimiter, (req) => clientIp(req)));

  api.use("/auth", authRouter);

  api.use("/users", requireAuth, perUser, usersRouter);
  api.use("/conversations", requireAuth, perUser, conversationsRouter(io));

  app.use("/api", api);

  // Unknown route -> structured 404.
  app.use((_req, _res, next) => {
    next(errors.notFound("Route not found"));
  });

  // Structured error handler: never leaks stack traces or internals.
  app.use(
    (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
      if (res.headersSent) {
        next(err);
        return;
      }
      if (err instanceof ApiError) {
        res.status(err.status).json(err.toJSON());
        return;
      }
      // Body-parser (express.json) errors -> VALIDATION_ERROR with fitting status.
      const anyErr = err as { type?: string; status?: number };
      if (typeof anyErr?.type === "string") {
        const status = anyErr.status === 413 ? 413 : 400;
        res
          .status(status)
          .json({
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message:
                status === 413
                  ? "Request body too large"
                  : "Malformed request body",
            },
          });
        return;
      }
      console.error("[unhandled]", err);
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    },
  );

  return { app, server, io };
}