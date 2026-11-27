import "server-only";
import {
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  type Address,
  type Blockhash,
  type RpcTransport,
} from "@solana/kit";
import { serverRpcUrl } from "../config";

/**
 * Server RPC with retry on 429 / transient errors. Public devnet RPC rate-limits hard when a
 * group claims at once; set RPC_URL to a free Helius/Triton endpoint for demos.
 */
function retryingTransport(inner: RpcTransport): RpcTransport {
  return (async (config: Parameters<RpcTransport>[0]) => {
    let delay = 250;
    for (let attempt = 0; ; attempt++) {
      try {
        return await inner(config);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const retryable = /429|Too Many Requests|502|503|504|fetch failed|ECONNRESET/i.test(msg);
        if (!retryable || attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, delay + Math.random() * 150));
        delay *= 2;
      }
    }
  }) as RpcTransport;
}

export const serverRpc = createSolanaRpcFromTransport(
  retryingTransport(createDefaultRpcTransport({ url: serverRpcUrl() })),
);

/** Recent blockhash, reused for up to 20 s (it stays valid ~60–90 s). */
let bh: { value: { blockhash: Blockhash; lastValidBlockHeight: bigint }; at: number } | null = null;
let bhInflight: Promise<{ blockhash: Blockhash; lastValidBlockHeight: bigint }> | null = null;
export async function recentBlockhash() {
  if (bh && Date.now() - bh.at < 20_000) return bh.value;
  bhInflight ??= serverRpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send()
    .then(({ value }) => {
      bh = { value, at: Date.now() };
      return value;
    })
    .finally(() => (bhInflight = null));
  return bhInflight;
}

/** An angpao's gatekeeper is fixed at creation, so it's safe to cache per instance. */
const gatekeeperCache = new Map<Address, Address | null>();
export function cacheGatekeeper(angpao: Address, gk: Address | null) {
  if (gatekeeperCache.size > 5000) gatekeeperCache.clear();
  gatekeeperCache.set(angpao, gk);
}
export function cachedGatekeeper(angpao: Address): Address | null | undefined {
  return gatekeeperCache.get(angpao);
}

export function isRateLimitError(e: unknown) {
  return /429|Too Many Requests/i.test(e instanceof Error ? e.message : String(e));
}
