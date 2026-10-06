import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError, ErrorCode } from "../lib/errors.js";
import { RateLimiter } from "../lib/rateLimit.js";

export function formatZodIssues(error: z.ZodError): string {
  const parts = error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return parts.length > 0 ? parts.join("; ") : "Invalid input";
}

/** Validates req.body against a STRICT schema (unknown fields are rejected). */
export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      next(
        new ApiError(
          ErrorCode.VALIDATION_ERROR,
          400,
          formatZodIssues(result.error),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Validates req.query (Express 5 query is read-only -> result in res.locals.query). */
export function validateQuery<T>(schema: z.ZodType<T>) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(res.req.query ?? {});
    if (!result.success) {
      next(
        new ApiError(
          ErrorCode.VALIDATION_ERROR,
          400,
          formatZodIssues(result.error),
        ),
      );
      return;
    }
    res.locals["query"] = result.data;
    next();
  };
}

/** Validates route params (result in res.locals.params). */
export function validateParams<T>(schema: z.ZodType<T>) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(res.req.params ?? {});
    if (!result.success) {
      next(
        new ApiError(ErrorCode.VALIDATION_ERROR, 400, "Invalid resource id"),
      );
      return;
    }
    res.locals["params"] = result.data;
    next();
  };
}

/** Express middleware factory: fixed-window limiter + structured 429. */
export function rateLimit(limiter: RateLimiter, keyFn: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const verdict = limiter.hit(keyFn(req));
    res.setHeader("X-RateLimit-Limit", String(limiter.max));
    res.setHeader("X-RateLimit-Remaining", String(verdict.remaining));
    if (!verdict.allowed) {
      res.setHeader("Retry-After", String(verdict.retryAfterSeconds));
      next(errors429());
      return;
    }
    next();
  };
}

function errors429(): ApiError {
  return new ApiError(
    ErrorCode.RATE_LIMITED,
    429,
    "Too many requests, please slow down",
  );
}

/** First unproxied-looking client IP (single-key trusting; behind no proxy here). */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}