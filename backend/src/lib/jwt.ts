import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { ApiError, ErrorCode } from "./errors.js";

export const JWT_ISSUER = "messaging-backend";

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.accessTtlSeconds,
    issuer: JWT_ISSUER,
  });
}

/** Returns the authenticated user id, or throws ApiError (UNAUTHORIZED / TOKEN_EXPIRED). */
export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
    });
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.sub === "string" &&
      payload.sub.length > 0
    ) {
      return payload.sub;
    }
    throw new ApiError(ErrorCode.UNAUTHORIZED, 401, "Invalid access token");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 401, "Access token expired");
    }
    throw new ApiError(ErrorCode.UNAUTHORIZED, 401, "Invalid access token");
  }
}