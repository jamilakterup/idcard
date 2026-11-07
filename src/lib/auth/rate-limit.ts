/**
 * Simple in-memory rate limiter for auth endpoints.
 * For production at scale, replace with Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterMs: 0,
  };
}

/** Clean old buckets periodically */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
}
