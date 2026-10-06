import { config as loadEnv } from "dotenv";

loadEnv();

function requireJwtSecret(): string {
  const raw = process.env["JWT_SECRET"];
  const secret = raw ?? "";
  const normalized = secret.trim().toLowerCase();
  const forbidden = new Set([
    "",
    "changeme",
    "change-me",
    "secret",
    "jwt_secret",
    "change-me-to-a-long-random-secret-min-32-chars",
  ]);
  if (secret.length < 32 || forbidden.has(normalized)) {
    console.error(
      "[fatal] JWT_SECRET is missing, a placeholder, or shorter than 32 characters. " +
        "Set a strong random secret in .env (see .env.example). Refusing to start.",
    );
    process.exit(1);
  }
  return secret;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num("PORT", 3001),
  jwtSecret: requireJwtSecret(),
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
  databasePath: process.env["DATABASE_PATH"] ?? "./data/app.db",

  accessTtlSeconds: num("ACCESS_TOKEN_TTL_SECONDS", 900),
  refreshTtlDays: num("REFRESH_TOKEN_TTL_DAYS", 30),

  maxMessageLength: num("MAX_MESSAGE_LENGTH", 4000),
  maxGroupSize: num("MAX_GROUP_SIZE", 50),
  jsonBodyLimit: process.env["JSON_BODY_LIMIT"] ?? "64kb",
  socketMaxHttpBufferSize: num("SOCKET_MAX_HTTP_BUFFER_SIZE", 65536),

  rateLimitIpPerMin: num("RATE_LIMIT_IP_PER_MIN", 300),
  rateLimitUserPerMin: num("RATE_LIMIT_USER_PER_MIN", 600),
  authRateLimitPerMin: num("AUTH_RATE_LIMIT_PER_MIN", 5),

  messageRateLimitCount: num("MESSAGE_RATE_LIMIT_COUNT", 10),
  messageRateLimitWindowMs: num("MESSAGE_RATE_LIMIT_WINDOW_MS", 5000),

  typingMinIntervalMs: num("TYPING_MIN_INTERVAL_MS", 1000),
  typingRateLimitPerMin: num("TYPING_RATE_LIMIT_PER_MIN", 20),
} as const;