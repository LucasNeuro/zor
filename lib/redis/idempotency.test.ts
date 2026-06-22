import { beforeEach, describe, expect, it } from "vitest";
import { checkAndSetWebhookIdempotency } from "@/lib/redis/idempotency";
import { resetRedisClientForTests, useMemoryRedisForTests } from "@/lib/redis/client";

describe("checkAndSetWebhookIdempotency", () => {
  beforeEach(() => {
    useMemoryRedisForTests();
    resetRedisClientForTests();
  });

  it("returns false on first message (not duplicate)", async () => {
    const dup = await checkAndSetWebhookIdempotency("tenant-1", "msg-abc", 60);
    expect(dup).toBe(false);
  });

  it("returns true on second message with same tenant+messageId", async () => {
    await checkAndSetWebhookIdempotency("tenant-1", "msg-abc", 60);
    const dup = await checkAndSetWebhookIdempotency("tenant-1", "msg-abc", 60);
    expect(dup).toBe(true);
  });

  it("treats different tenants independently", async () => {
    await checkAndSetWebhookIdempotency("tenant-a", "msg-1", 60);
    const dup = await checkAndSetWebhookIdempotency("tenant-b", "msg-1", 60);
    expect(dup).toBe(false);
  });

  it("ignores empty ids", async () => {
    expect(await checkAndSetWebhookIdempotency("", "msg", 60)).toBe(false);
    expect(await checkAndSetWebhookIdempotency("tenant", "", 60)).toBe(false);
  });
});
