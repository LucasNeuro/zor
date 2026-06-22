type IoredisLike = {
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: string, ...args: unknown[]): Promise<[string, string[]]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
};

export type RedisBackend = "ioredis" | "memory";

type MemoryEntry = { value: string; expiresAt?: number };

/** Minimal Redis surface used by idempotency, rate-limit, learn-queue and tenant cache. */
export interface RedisCommandClient {
  set(key: string, value: string, exMode: "EX", ttlSec: number, nxMode: "NX"): Promise<"OK" | null>;
  get(key: string): Promise<string | null>;
  setEx(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPrefix(prefix: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  backend: RedisBackend;
}

class MemoryRedisClient implements RedisCommandClient {
  readonly backend: RedisBackend = "memory";
  private strings = new Map<string, MemoryEntry>();
  private lists = new Map<string, string[]>();

  private purgeExpired(key: string, entry: MemoryEntry): boolean {
    if (entry.expiresAt != null && Date.now() >= entry.expiresAt) {
      this.strings.delete(key);
      return true;
    }
    return false;
  }

  private getString(key: string): MemoryEntry | undefined {
    const entry = this.strings.get(key);
    if (!entry) return undefined;
    if (this.purgeExpired(key, entry)) return undefined;
    return entry;
  }

  async set(
    key: string,
    value: string,
    _exMode: "EX",
    ttlSec: number,
    nxMode: "NX"
  ): Promise<"OK" | null> {
    if (nxMode === "NX" && this.getString(key)) return null;
    this.strings.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.getString(key)?.value ?? null;
  }

  async setEx(key: string, value: string, ttlSec: number): Promise<void> {
    this.strings.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const k of this.strings.keys()) {
      if (k.startsWith(prefix)) this.strings.delete(k);
    }
  }

  async incr(key: string): Promise<number> {
    const current = this.getString(key);
    const next = (current ? Number.parseInt(current.value, 10) || 0 : 0) + 1;
    const expiresAt = current?.expiresAt;
    this.strings.set(key, { value: String(next), expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.strings.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.pop() ?? null;
  }

  resetForTests(): void {
    this.strings.clear();
    this.lists.clear();
  }
}

class IoredisCommandClient implements RedisCommandClient {
  readonly backend: RedisBackend = "ioredis";

  constructor(private readonly redis: IoredisLike) {}

  async set(
    key: string,
    value: string,
    _exMode: "EX",
    ttlSec: number,
    nxMode: "NX"
  ): Promise<"OK" | null> {
    const result = await this.redis.set(key, value, "EX", ttlSec, "NX");
    return result === "OK" ? "OK" : null;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setEx(key: string, value: string, ttlSec: number): Promise<void> {
    await this.redis.set(key, value, "EX", ttlSec);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) await this.redis.del(...keys);
    } while (cursor !== "0");
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async lpush(key: string, value: string): Promise<number> {
    return this.redis.lpush(key, value);
  }

  async rpop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }
}

let singleton: RedisCommandClient | null = null;
let ioredisInstance: IoredisLike | null = null;
const memorySingleton = new MemoryRedisClient();

export function redisKeyPrefix(): string {
  return process.env.REDIS_KEY_PREFIX?.trim() || "waje:";
}

export function prefixedRedisKey(part: string): string {
  const prefix = redisKeyPrefix();
  const normalized = part.startsWith(":") ? part.slice(1) : part;
  return `${prefix}${normalized}`;
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_HOST?.trim());
}

function loadIoredisConstructor(): (new (options: Record<string, unknown>) => IoredisLike) | null {
  try {
    // Optional runtime dependency — falls back to memory when not installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("ioredis") as { default?: new (options: Record<string, unknown>) => IoredisLike };
    return mod.default ?? (mod as unknown as new (options: Record<string, unknown>) => IoredisLike);
  } catch {
    return null;
  }
}

function buildIoredisClient(): IoredisLike | null {
  const RedisCtor = loadIoredisConstructor();
  if (!RedisCtor) {
    console.warn("[redis] ioredis não instalado; usando cache em memória.");
    return null;
  }

  const host = process.env.REDIS_HOST!.trim();
  const port = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();

  return new RedisCtor({
    host,
    port: Number.isFinite(port) ? port : 6379,
    username: username || undefined,
    password: password || undefined,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

/** Shared Redis client (ioredis when REDIS_HOST is set, otherwise in-memory fallback). */
export function getRedisClient(): RedisCommandClient {
  if (singleton) return singleton;

  if (isRedisConfigured()) {
    ioredisInstance = buildIoredisClient();
    if (ioredisInstance) {
      singleton = new IoredisCommandClient(ioredisInstance);
      return singleton;
    }
  }

  singleton = memorySingleton;
  return singleton;
}

/** Test helper — clears in-memory keys/lists. No-op when using real Redis. */
export function resetRedisClientForTests(): void {
  if (singleton?.backend === "memory") {
    memorySingleton.resetForTests();
  }
}

/** Test helper — force in-memory backend regardless of env. */
export function useMemoryRedisForTests(): void {
  singleton = memorySingleton;
}
