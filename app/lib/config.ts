import { address, type Address } from "@solana/kit";
import { ANGPAO_PROGRAM_ADDRESS } from "../generated/angpao";

export type Network = "devnet" | "mainnet" | "localnet";

const requested = (process.env.NEXT_PUBLIC_NETWORK ?? "devnet") as Network;
const mainnetAllowed = process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true";

/**
 * Devnet by default. Mainnet needs BOTH `NEXT_PUBLIC_NETWORK=mainnet` and
 * `NEXT_PUBLIC_ENABLE_MAINNET=true`; otherwise we silently stay on devnet.
 */
export const NETWORK: Network =
  requested === "mainnet" && !mainnetAllowed ? "devnet" : requested;

const DEFAULT_RPC: Record<Network, string> = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

/** Browser RPC. Public endpoints are rate-limited; use a free Helius/Triton key for demos. */
export const PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[NETWORK];

export const PUBLIC_WS_URL =
  process.env.NEXT_PUBLIC_RPC_WS_URL ||
  (NETWORK === "localnet"
    ? "ws://127.0.0.1:8900"
    : PUBLIC_RPC_URL.replace(/^http/, "ws"));

/** Server-side RPC (may hold a private key in the URL; never exposed to the browser). */
export function serverRpcUrl() {
  return process.env.RPC_URL || PUBLIC_RPC_URL;
}

/** Forks deploy their own program; the generated client defaults to the IDL address. */
export const PROGRAM_ADDRESS: Address = process.env.NEXT_PUBLIC_PROGRAM_ID
  ? address(process.env.NEXT_PUBLIC_PROGRAM_ID)
  : ANGPAO_PROGRAM_ADDRESS;

export const CHAIN = `solana:${NETWORK}` as const;

export const DEFAULT_FIAT = (
  process.env.NEXT_PUBLIC_DEFAULT_FIAT ?? "usd"
).toLowerCase();
