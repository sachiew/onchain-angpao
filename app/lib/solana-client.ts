import { createEmptyClient } from "@solana/kit";
import { rpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { PUBLIC_RPC_URL, PUBLIC_WS_URL, type Network } from "./config";

/**
 * The network is fixed per deployment by NEXT_PUBLIC_NETWORK (devnet by default), since the
 * angpao program only exists on the network it was deployed to.
 */
export type ClusterMoniker = Network;

export function getClusterUrl() {
  return PUBLIC_RPC_URL;
}

export function getClusterWsConfig() {
  return { url: PUBLIC_WS_URL };
}

export function createSolanaClient() {
  return createEmptyClient()
    .use(rpc(PUBLIC_RPC_URL, { url: PUBLIC_WS_URL }))
    .use(rpcAirdrop());
}

export type SolanaClient = ReturnType<typeof createSolanaClient>;
