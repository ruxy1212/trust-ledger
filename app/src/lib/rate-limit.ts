// Simple fixed-window limiter, in memory. This resets on every server
// restart/redeploy and is per-instance (won't coordinate across multiple
// serverless function instances) — fine for a devnet capstone demo. If this
// goes anywhere with real traffic or multiple instances, swap the Map below
// for Upstash Redis (`@upstash/ratelimit`) and nothing else here changes.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * @param key       identifies the caller — IP address is the default choice
 * @param limit     max requests allowed within the window
 * @param windowMs  window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Best-effort caller identity from a Next.js Request in an API route. */
export function callerKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}
