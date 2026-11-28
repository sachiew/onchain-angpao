"use client";

import { useEffect, useRef } from "react";
import { PrivyProvider, usePrivy, type PrivyClientConfig } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { CHAIN, PUBLIC_RPC_URL, PUBLIC_WS_URL } from "../config";
import type { ClaimSigner } from "../gasless";

export type PrivyApi = {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  signer: ClaimSigner | null;
};

type SolanaChainId = "solana:mainnet" | "solana:devnet" | "solana:testnet";

/**
 * Reports Privy's state up to InstantWalletProvider. Only re-reports when ready /
 * authenticated / the wallet address change: Privy's hook functions can change identity on
 * every render, and reporting a fresh object each time would loop forever (React #185).
 * The latest functions are read through a ref instead.
 */
function Bridge({ onApi }: { onApi: (api: PrivyApi) => void }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const embedded = wallets.find((w) => w.standardWallet.name === "Privy") ?? null;
  const address = embedded?.address ?? null;

  const latest = useRef({ login, logout, signTransaction, embedded });
  useEffect(() => {
    latest.current = { login, logout, signTransaction, embedded };
  });

  useEffect(() => {
    onApi({
      ready,
      authenticated,
      login: () => latest.current.login(),
      logout: () => latest.current.logout(),
      signer: address
        ? {
            address: address as ClaimSigner["address"],
            kind: "privy",
            label: "Privy wallet",
            async signWire(bytes) {
              const { signTransaction, embedded } = latest.current;
              if (!embedded) throw new Error("Privy wallet not available");
              // Signs as the claimer only; the relayer already signed as fee payer.
              const { signedTransaction } = await signTransaction({
                transaction: bytes,
                wallet: embedded,
                chain: CHAIN as SolanaChainId,
              });
              return signedTransaction;
            },
          }
        : null,
    });
  }, [ready, authenticated, address, onApi]);

  return null;
}

/** Built once: a new config object on every render makes PrivyProvider re-initialise. */
const PRIVY_CONFIG: PrivyClientConfig = {
  loginMethods: ["email", "google"],
  appearance: { walletChainType: "solana-only", theme: "light", accentColor: "#c8102e" },
  embeddedWallets: { solana: { createOnLogin: "all-users" } },
  solana: {
    rpcs: {
      [CHAIN as SolanaChainId]: {
        rpc: createSolanaRpc(PUBLIC_RPC_URL),
        rpcSubscriptions: createSolanaRpcSubscriptions(PUBLIC_WS_URL),
      },
    },
  },
};

/** Mounted only when NEXT_PUBLIC_PRIVY_APP_ID is set (lazy-loaded). */
export default function PrivyLayer({ appId, onApi }: { appId: string; onApi: (api: PrivyApi) => void }) {
  return (
    <PrivyProvider appId={appId} config={PRIVY_CONFIG}>
      <Bridge onApi={onApi} />
    </PrivyProvider>
  );
}
