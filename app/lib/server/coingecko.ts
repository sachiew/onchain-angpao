import "server-only";
import Coingecko from "@coingecko/coingecko-typescript";
import { FIAT_CODES, type Prices } from "../fiat";

const IDS = ["solana", "usd-coin"] as const;
const TTL_MS = 60_000;

let client: Coingecko | null | undefined;
function getClient(): Coingecko | null {
  if (client !== undefined) return client;
  const pro = process.env.COINGECKO_PRO_API_KEY;
  const demo = process.env.COINGECKO_DEMO_API_KEY;
  client = pro
    ? new Coingecko({ proAPIKey: pro, environment: "pro" })
    : demo
      ? new Coingecko({ demoAPIKey: demo, environment: "demo" })
      : null;
  return client;
}

let cache: Prices | null = null;
let inflight: Promise<Prices> | null = null;

async function fetchPrices(): Promise<Prices> {
  const params = { ids: IDS.join(","), vs_currencies: FIAT_CODES.join(",") };
  const c = getClient();
  let data: Record<string, Record<string, number>>;
  if (c) {
    data = (await c.simple.price.get(params)) as Record<string, Record<string, number>>;
  } else {
    // No key: the public endpoint works with tight rate limits. Fine for local dev;
    // set COINGECKO_DEMO_API_KEY (free) for anything shared.
    const url = `https://api.coingecko.com/api/v3/simple/price?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    data = await res.json();
  }
  return { solana: data.solana ?? {}, "usd-coin": data["usd-coin"], fetchedAt: Date.now() };
}

/** Cached for 60 s per server instance; concurrent callers share one request. */
export async function getPrices(): Promise<Prices> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  inflight ??= fetchPrices()
    .then((p) => (cache = p))
    .finally(() => (inflight = null));
  try {
    return await inflight;
  } catch (e) {
    if (cache) return cache; // serve stale on upstream errors
    throw e;
  }
}
