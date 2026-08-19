// In-memory sliding-window rate limiter with automatic eviction
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function evictExpired(now: number) {
  if (rateLimits.size > 500) {
    for (const [key, val] of rateLimits.entries()) {
      if (now > val.resetAt) {
        rateLimits.delete(key);
      }
    }
  }
}

/**
 * Returns true if request is ALLOWED under the rate limit, false if rate limited.
 * @param key unique identifier (e.g. employee token or IP)
 * @param maxRequests maximum allowed requests within window
 * @param windowMs sliding window in milliseconds (default 60s)
 */
export function checkRateLimit(key: string, maxRequests = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  evictExpired(now);

  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= maxRequests;
}
