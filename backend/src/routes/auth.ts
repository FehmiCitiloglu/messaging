import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import {
  findUserById,
  findUserByUsername,
  findUserCredentials,
  sql,
} from "../db.js";
import { errors } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { RateLimiter } from "../lib/rateLimit.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { hashToken, hexSecretEquals, newRefreshToken } from "../lib/tokens.js";
import { validateBody, rateLimit, clientIp } from "../lib/http.js";
import { newId } from "../lib/ids.js";
import { toUser } from "../serializers.js";
import type { AuthResponse } from "../types.js";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const registerSchema = z.strictObject({
  username: z
    .string()
    .regex(USERNAME_RE, "username must match [a-z0-9_] and be 3-20 chars"),
  displayName: z.string().min(1).max(40),
  password: z.string().min(8).max(256),
});

const loginSchema = z.strictObject({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512),
});

const logoutSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512),
});

// Strict /auth abuse defense: 5 attempts per minute per (IP + action key).
const authActionLimiter = new RateLimiter(60_000, config.authRateLimitPerMin);
const registerLimiter = new RateLimiter(60_000, 10);
const authIpLimiter = new RateLimiter(60_000, config.rateLimitIpPerMin);

function authKey(req: Request, extra: string): string {
  return `${clientIp(req)}|${extra}`;
}

interface RefreshRow {
  id: string;
  family_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

function issueTokens(userId: string, familyId: string): {
  accessToken: string;
  refreshToken: string;
} {
  const refreshToken = newRefreshToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + config.refreshTtlDays * 24 * 60 * 60 * 1000,
  );
  sql(
    `INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    familyId,
    userId,
    hashToken(refreshToken),
    now.toISOString(),
    expiresAt.toISOString(),
  );
  return { accessToken: signAccessToken(userId), refreshToken };
}

function revokeFamily(familyId: string): void {
  sql(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`,
  ).run(new Date().toISOString(), familyId);
}

export const authRouter: Router = Router();

authRouter.post(
  "/register",
  rateLimit(authIpLimiter, (req) => authKey(req, "register")),
  rateLimit(registerLimiter, (req) => authKey(req, "register-count")),
  validateBody(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { username, displayName, password } = req.body as z.infer<
      typeof registerSchema
    >;
    if (findUserByUsername(username) !== undefined) {
      throw errors.conflict("Username is already taken");
    }
    const id = newId();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    try {
      sql(
        `INSERT INTO users (id, username, display_name, password_hash, avatar_url, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      ).run(id, username, displayName, passwordHash, now);
    } catch (err) {
      // UNIQUE violation races
      if (String(err).includes("UNIQUE")) {
        throw errors.conflict("Username is already taken");
      }
      throw err;
    }
    const user = findUserById(id)!;
    const familyId = newId();
    const tokens = issueTokens(id, familyId);
    const body: AuthResponse = {
      user: toUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    res.status(201).json(body);
  },
);

authRouter.post(
  "/login",
  rateLimit(authIpLimiter, (req) => authKey(req, "login-ip")),
  validateBody(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    const verdict = authActionLimiter.hit(
      authKey(req, `login|${username.toLowerCase()}`),
    );
    if (!verdict.allowed) {
      res.setHeader("Retry-After", String(verdict.retryAfterSeconds));
      throw errors.rateLimited("Too many login attempts, please slow down");
    }
    const creds = findUserCredentials(username);
    // Constant-ish work regardless of user existence to avoid user enumeration.
    const ok =
      creds !== undefined
        ? await verifyPassword(creds.password_hash, password)
        : await verifyPassword(
            "$argon2id$v=19$m=19456,t=2,p=1$bm90YXVzZXIwbm90YXVzZXIw$0000000000000000000000000000000000000000000",
            password,
          );
    if (!ok || creds === undefined) {
      throw errors.invalidCredentials();
    }
    const user = findUserById(creds.id)!;
    const tokens = issueTokens(creds.id, newId());
    const body: AuthResponse = {
      user: toUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    res.status(200).json(body);
  },
);

authRouter.post(
  "/refresh",
  rateLimit(authIpLimiter, (req) => authKey(req, "refresh")),
  validateBody(refreshSchema),
  (req: Request, res: Response): void => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const presentedHash = hashToken(refreshToken);
    const row = sql(
      `SELECT id, family_id, user_id, token_hash, expires_at, used_at, revoked_at
       FROM refresh_tokens WHERE token_hash = ?`,
    ).get(presentedHash) as RefreshRow | undefined;

    if (row === undefined || !hexSecretEquals(row.token_hash, presentedHash)) {
      throw errors.unauthorized("Invalid refresh token");
    }
    if (row.used_at !== null || row.revoked_at !== null) {
      // Reuse of a rotated/revoked token: assume theft, kill the whole family.
      revokeFamily(row.family_id);
      throw errors.unauthorized("Refresh token reuse detected; session revoked");
    }
    if (Date.parse(row.expires_at) <= Date.now()) {
      revokeFamily(row.family_id);
      throw errors.unauthorized("Refresh token expired");
    }

    const nowIso = new Date().toISOString();
    sql(`UPDATE refresh_tokens SET used_at = ? WHERE id = ?`).run(
      nowIso,
      row.id,
    );
    const tokens = issueTokens(row.user_id, row.family_id);
    res.status(200).json(tokens);
  },
);

authRouter.post(
  "/logout",
  rateLimit(authIpLimiter, (req) => authKey(req, "logout")),
  validateBody(logoutSchema),
  (req: Request, res: Response): void => {
    const { refreshToken } = req.body as z.infer<typeof logoutSchema>;
    const presentedHash = hashToken(refreshToken);
    const row = sql(
      `SELECT id, family_id, token_hash FROM refresh_tokens WHERE token_hash = ?`,
    ).get(presentedHash) as
      | Pick<RefreshRow, "id" | "family_id" | "token_hash">
      | undefined;
    if (row !== undefined && hexSecretEquals(row.token_hash, presentedHash)) {
      revokeFamily(row.family_id);
    }
    // Idempotent: always 204, never reveal token validity.
    res.status(204).end();
  },
);

// Exported for reuse/tests.
export const __testing = { registerSchema, loginSchema };