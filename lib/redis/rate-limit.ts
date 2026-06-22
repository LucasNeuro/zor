import { getRedisClient, prefixedRedisKey } from "@/lib/redis/client";

export type TenantRateLimitResult =
  | { limited: false; count: number }
  | { limited: true; count: number; retryAfterSec: number };

/**
 * Sliding-window-ish counter per tenant bucket (INCR + EXPIRE on first hit).
 * @returns limited=true when count exceeds maxPerWindow within windowSec.
 */
export async function checkTenantRateLimit(
  tenantId: string,
  bucket: string,
  maxPerWindow: number,
  windowSec: number
): Promise<TenantRateLimitResult> {
  const tid = tenantId.trim();
  const b = bucket.trim();
  if (!tid || !b || maxPerWindow <= 0 || windowSec <= 0) {
    return { limited: false, count: 0 };
  }

  const key = prefixedRedisKey(`ratelimit:${tid}:${b}`);
  const redis = getRedisClient();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  if (count > maxPerWindow) {
    return { limited: true, count, retryAfterSec: windowSec };
  }
  return { limited: false, count };
}
