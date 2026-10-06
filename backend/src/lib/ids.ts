import { randomBytes } from "node:crypto";

/**
 * Monotonic ULID generator (Crockford base32).
 * 48-bit millisecond timestamp + 80 bits randomness => 26-char,
 * lexicographically sortable IDs. No external dependency.
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const RANDOM_LEN = 16;
const TIME_LEN = 10;

let lastTime = -1;
let lastRandom: Uint8Array = new Uint8Array(RANDOM_LEN);

function encodeTime(now: number): string {
  let out = "";
  let t = now;
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = t % 32;
    out = ENCODING[mod]! + out;
    t = (t - mod) / 32;
  }
  return out;
}

function freshRandom(): Uint8Array {
  const bytes = randomBytes(RANDOM_LEN);
  const out = new Uint8Array(RANDOM_LEN);
  for (let i = 0; i < RANDOM_LEN; i++) out[i] = bytes[i]! % 32;
  return out;
}

function bumpRandom(prev: Uint8Array): Uint8Array {
  const next = Uint8Array.from(prev);
  for (let i = RANDOM_LEN - 1; i >= 0; i--) {
    if (next[i]! < 31) {
      next[i] = next[i]! + 1;
      return next;
    }
    next[i] = 0;
  }
  // Overflow within the same millisecond: extremely unlikely; reseed.
  return freshRandom();
}

export function newId(): string {
  const now = Date.now();
  if (now === lastTime) {
    lastRandom = bumpRandom(lastRandom);
  } else {
    lastTime = now;
    lastRandom = freshRandom();
  }
  let random = "";
  for (let i = 0; i < RANDOM_LEN; i++) random += ENCODING[lastRandom[i]!]!;
  return encodeTime(now) + random;
}

export function isIdLike(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}

/** Client-generated correlation IDs: canonical UUID (any version). */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;