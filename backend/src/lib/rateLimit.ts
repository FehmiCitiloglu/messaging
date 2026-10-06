interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * In-memory fixed-window rate limiter, keyed arbitrarily
 * (per IP, per user, per IP+username, ...).
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    /** Window size in milliseconds. */
    readonly windowMs: number,
    /** Max hits allowed per window. */
    readonly max: number,
  ) {}

  hit(key: string): RateVerdict {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (this.buckets.size > 50_000) this.prune(now);
    const allowed = bucket.count <= this.max;
    return {
      allowed,
      remaining: Math.max(0, this.max - bucket.count),
      retryAfterSeconds: allowed
        ? 0
        : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}