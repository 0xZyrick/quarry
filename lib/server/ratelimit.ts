/**
 * Rate limiter.
 *
 * - Production / multi-instance: Upstash Redis (INCR + EXPIRE fixed window).
 * - Local / missing keys: in-memory sliding window (same process only).
 *
 * All call sites are in async route handlers, so the public API is async.
 * Returns true when the request is allowed, false when it should be rejected (429).
 */
import { Redis } from "@upstash/redis";

// ─── In-memory fallback (dev / no Upstash keys) ─────────────────────────────
const g = globalThis as any;
const buckets: Map<string, number[]> = (g.__guildRL ??= new Map());

function memoryLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const window = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (window.length >= max) {
    buckets.set(key, window);
    return false;
  }
  window.push(now);
  buckets.set(key, window);
  // occasional cleanup so the map cannot grow forever
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return true;
}

// ─── Upstash Redis (shared across all serverless instances) ─────────────────
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/**
 * Fixed-window rate limit using Redis INCR + EXPIRE.
 * One command on the hot path after the first hit (INCR).
 * Window starts when the first request in the window arrives.
 */
async function redisLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) return memoryLimit(key, max, windowMs);

  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    // Pipeline: INCR then EXPIRE only on the first hit of the window
    const count = await r.incr(redisKey);
    if (count === 1) {
      await r.expire(redisKey, windowSec);
    }
    return count <= max;
  } catch (err) {
    // Never hard-fail the request because Redis is down — fall back to memory
    console.error("[ratelimit] Redis error, falling back to memory:", err);
    return memoryLimit(key, max, windowMs);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * @param key     Unique bucket key (e.g. "session:1.2.3.4" or "appeal:u-abc")
 * @param max     Max allowed requests inside the window
 * @param windowMs Window length in milliseconds
 * @returns true if the request is allowed
 */
export async function limit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return redisLimit(key, max, windowMs);
}

/** Best-effort client IP from common proxy headers. */
export const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
