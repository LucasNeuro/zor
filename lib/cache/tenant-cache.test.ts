import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getTenantCache,
  invalidateTenantCache,
  invalidateTenantCachePrefix,
  setTenantCache,
} from "@/lib/cache/tenant-cache";
import { resetRedisClientForTests, useMemoryRedisForTests } from "@/lib/redis/client";

describe("tenant-cache", () => {
  beforeEach(() => {
    useMemoryRedisForTests();
  });

  afterEach(() => {
    delete process.env.REDIS_HOST;
    resetRedisClientForTests();
  });

  it("armazena e recupera valores em memória sem Redis", async () => {
    const tenantId = "tenant-test";
    await setTenantCache(tenantId, "demo:key", { ok: true }, 30);
    const hit = await getTenantCache<{ ok: boolean }>(tenantId, "demo:key");
    expect(hit).toEqual({ ok: true });
  });

  it("invalida por prefixo lógico", async () => {
    const tenantId = "tenant-test";
    await setTenantCache(tenantId, "cargos:list:active", [1], 30);
    await setTenantCache(tenantId, "cargos:list:all", [2], 30);
    await setTenantCache(tenantId, "agentes:list:x", [3], 30);

    await invalidateTenantCachePrefix(tenantId, "cargos:");

    expect(await getTenantCache(tenantId, "cargos:list:active")).toBeNull();
    expect(await getTenantCache(tenantId, "cargos:list:all")).toBeNull();
    expect(await getTenantCache(tenantId, "agentes:list:x")).toEqual([3]);
  });
});
