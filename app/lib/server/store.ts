import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Counters for rate limits and the relayer's daily budget.
 * Upstash Redis when configured (required in production, since serverless instances don't
 * share memory); an in-memory map otherwise (local dev only).
 */
export interface CounterStore {
  /** Atomically add `by` to `key` (creating it with `ttlSec` expiry) and return the new value. */
  incr(key: string, by: number, ttlSec: number): Promise<number>;
  get(key: string): Promise<number>;
  readonly durable: boolean;
}

class MemoryStore implements CounterStore {
  durable = false;
  private m = new Map<string, { v: number; exp: number }>();
  async incr(key: string, by: number, ttlSec: number) {
    const now = Date.now();
    const cur = this.m.get(key);
    const entry = cur && cur.exp > now ? cur : { v: 0, exp: now + ttlSec * 1000 };
    entry.v += by;
    this.m.set(key, entry);
    return entry.v;
  }
  async get(key: string) {
    const cur = this.m.get(key);
    return cur && cur.exp > Date.now() ? cur.v : 0;
  }
}

class UpstashStore implements CounterStore {
  durable = true;
  constructor(private r: Redis) {}
  async incr(key: string, by: number, ttlSec: number) {
    const [v] = await this.r.multi().incrby(key, by).expire(key, ttlSec, "NX").exec<[number, number]>();
    return v;
  }
  async get(key: string) {
    return Number((await this.r.get<number>(key)) ?? 0);
  }
}

let store: CounterStore | undefined;
export function getStore(): CounterStore {
  if (!store) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    store = url && token ? new UpstashStore(new Redis({ url, token })) : new MemoryStore();
  }
  return store;
}

/** On a deployed Vercel environment, refuse to run the relayer without a durable store. */
export function storeMisconfigured(): boolean {
  return !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development" && !getStore().durable;
}

/** Fixed-window limiter. Returns true if the call is allowed. */
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const n = await getStore().incr(`rl:${key}:${window}`, 1, windowSec + 5);
  return n <= limit;
}
