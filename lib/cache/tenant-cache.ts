import { getRedisClient, redisKeyPrefix } from "@/lib/redis/client";

function fullKey(tenantId: string, key: string): string {
  return `${redisKeyPrefix()}tenant:${tenantId}:${key}`;
}

function logCacheWarn(op: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[tenant-cache] ${op} ignorado (${msg}) — segue sem cache.`);
}

export async function getTenantCache<T>(tenantId: string, key: string): Promise<T | null> {
  try {
    const raw = await getRedisClient().get(fullKey(tenantId, key));
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  } catch (err) {
    logCacheWarn("get", err);
    return null;
  }
}

export async function setTenantCache(
  tenantId: string,
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    await getRedisClient().setEx(fullKey(tenantId, key), JSON.stringify(value), ttl);
  } catch (err) {
    logCacheWarn("set", err);
  }
}

/** Invalidate one key, or all keys for the tenant when `key` is omitted. */
export async function invalidateTenantCache(tenantId: string, key?: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (key != null) {
      await client.del(fullKey(tenantId, key));
      return;
    }
    await client.delByPrefix(`${redisKeyPrefix()}tenant:${tenantId}:`);
  } catch (err) {
    logCacheWarn("invalidate", err);
  }
}

/** Invalidate all cache entries for a tenant whose logical key starts with `logicalPrefix` (e.g. `cargos:`). */
export async function invalidateTenantCachePrefix(
  tenantId: string,
  logicalPrefix: string
): Promise<void> {
  try {
    await getRedisClient().delByPrefix(fullKey(tenantId, logicalPrefix));
  } catch (err) {
    logCacheWarn("invalidatePrefix", err);
  }
}
