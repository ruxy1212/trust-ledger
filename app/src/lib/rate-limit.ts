// Durable rate limiting with Redis (Upstash REST API) support and in-memory fallback.
// This supports serverless deployments without requiring additional heavy packages.

type Bucket = { count: number; resetAt: number };
const inMemoryBuckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Checks rate limit for a key against a maximum limit within windowMs.
 * Uses Upstash Redis REST if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
 * otherwise falls back gracefully to in-memory tracking.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const sanitizedKey = `ratelimit:${key.replace(/[^a-zA-Z0-9_:-]/g, "_")}`;
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", sanitizedKey],
          ["PTTL", sanitizedKey],
        ]),
      });

      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: any }>;
        const count = typeof data[0]?.result === "number" ? data[0].result : 1;
        let ttl = typeof data[1]?.result === "number" ? data[1].result : -1;

        if (count === 1 || ttl < 0) {
          await fetch(
            `${redisUrl}/pexpire/${encodeURIComponent(sanitizedKey)}/${windowMs}`,
            {
              headers: { Authorization: `Bearer ${redisToken}` },
            }
          );
          ttl = windowMs;
        }

        const resetAt = Date.now() + Math.max(0, ttl);
        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetAt,
        };
      }
    } catch {
      // In case of Redis network outage, fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const now = Date.now();
  const existing = inMemoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    inMemoryBuckets.set(key, { count: 1, resetAt });
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
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  const fwd = req.headers.get("x-forwarded-for");
  return cfIp?.trim() || realIp?.trim() || fwd?.split(",")[0]?.trim() || "unknown";
}
