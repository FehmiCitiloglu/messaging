import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Opaque refresh token: 256 bits of CSPRNG entropy, base64url encoded. */
export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 digest of a refresh token is ever persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison for hex-encoded secrets. */
export function hexSecretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison to reduce trivially observable timing skew.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}