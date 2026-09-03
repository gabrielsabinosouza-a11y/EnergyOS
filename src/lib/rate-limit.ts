import { AppError } from "./errors";

/**
 * Simple in-memory fixed-window rate limiter.
 *
 * NOTE: this protects a single server instance. On serverless/multi-instance
 * deployments it limits per-instance (which still blunts abusive loops but is
 * not a global guarantee). For a global limit, back this with Redis/Upstash.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

function pruneIfNeeded(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Consumes one unit from the bucket for `key`. Throws a 429 AppError when the
 * limit is exceeded, so it can be dropped into any route guarded by
 * `handleRoute` or an AppError-mapped try/catch.
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  pruneIfNeeded(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new AppError(
      `Muitas requisições. Tente novamente em ${retryAfterSec}s.`,
      429,
    );
  }
}

/** Scope a limit per profile to avoid one user exhausting another's budget. */
export function rateLimitForProfile(
  profileId: string,
  scope: string,
  limit: number,
  windowMs: number,
): void {
  enforceRateLimit(`${scope}:${profileId}`, limit, windowMs);
}
