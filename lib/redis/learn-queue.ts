import { getRedisClient, prefixedRedisKey } from "@/lib/redis/client";

export const LEARN_QUEUE_KEY = "learn:queue";

export type TenantLearnJob = {
  tenantId: string;
  agenteSlug: string;
  leadId: string;
  snippet: string;
  origem: string;
  enqueuedAt?: string;
};

function queueRedisKey(): string {
  return prefixedRedisKey(LEARN_QUEUE_KEY);
}

export async function enqueueTenantLearnJob(job: TenantLearnJob): Promise<void> {
  const payload: TenantLearnJob = {
    ...job,
    enqueuedAt: job.enqueuedAt ?? new Date().toISOString(),
  };
  const redis = getRedisClient();
  await redis.lpush(queueRedisKey(), JSON.stringify(payload));
}

/** Consumes one job from the tail (FIFO with LPUSH/RPOP). For future worker process. */
export async function dequeueLearnJob(): Promise<TenantLearnJob | null> {
  const redis = getRedisClient();
  const raw = await redis.rpop(queueRedisKey());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TenantLearnJob;
  } catch {
    return null;
  }
}
