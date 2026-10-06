import type { NextFunction, Request, Response } from "express";
import { errors } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    next(errors.unauthorized("Missing bearer access token"));
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.length === 0) {
    next(errors.unauthorized("Missing bearer access token"));
    return;
  }
  req.userId = verifyAccessToken(token);
  next();
}

export function authenticatedUserId(req: Request): string {
  if (!req.userId) throw errors.unauthorized();
  return req.userId;
}