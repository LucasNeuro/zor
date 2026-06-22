import { beforeEach, describe, expect, it } from "vitest";
import { checkTenantRateLimit } from "@/lib/redis/rate-limit";
import { resetRedisClientForTests, useMemoryRedisForTests } from "@/lib/redis/client";

describe("checkTenantRateLimit", () => {
  beforeEach(() => {
    useMemoryRedisForTests();
    resetRedisClientForTests();
  });

  it("allows requests under the cap", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkTenantRateLimit("tenant-1", "webhook", 5, 60);
      expect(r.limited).toBe(false);
      expect(r.count).toBe(i + 1);
    }
  });

  it("blocks after exceeding maxPerWindow", async () => {
    for (let i = 0; i < 3; i++) {
      await checkTenantRateLimit("tenant-2", "webhook", 3, 60);
    }
    const last = await checkTenantRateLimit("tenant-2", "webhook", 3, 60);
    expect(last.limited).toBe(true);
    if (last.limited) {
      expect(last.count).toBe(4);
      expect(last.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("uses separate buckets per tenant", async () => {
    await checkTenantRateLimit("tenant-a", "webhook", 1, 60);
    await checkTenantRateLimit("tenant-a", "webhook", 1, 60);
    const other = await checkTenantRateLimit("tenant-b", "webhook", 1, 60);
    expect(other.limited).toBe(false);
    expect(other.count).toBe(1);
  });
});
