import { getRedisClient, prefixedRedisKey } from "@/lib/redis/client";

/**
 * Distributed webhook dedupe via SET NX.
 * @returns true when the message was already seen (duplicate — skip processing).
 */
export async function checkAndSetWebhookIdempotency(
  tenantId: string,
  messageId: string,
  ttlSec = 86400
): Promise<boolean> {
  const tid = tenantId.trim();
  const mid = messageId.trim();
  if (!tid || !mid) return false;

  const key = prefixedRedisKey(`webhook:idem:${tid}:${mid}`);
  const redis = getRedisClient();
  const result = await redis.set(key, "1", "EX", ttlSec, "NX");
  return result === null;
}
