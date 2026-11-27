"use client";

import { useEffect } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
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

function Bridge({ onApi }: { onApi: (api: PrivyApi) => void }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const embedded = wallets.find((w) => w.standardWallet.name === "Privy") ?? null;

  useEffect(() => {
    onApi({
      ready,
      authenticated,
      login: () => login(),
      logout,
      signer: embedded
        ? {
            address: embedded.address as ClaimSigner["address"],
            kind: "privy",
            label: "Privy wallet",
            async signWire(bytes) {
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
  }, [ready, authenticated, login, logout, embedded, signTransaction, onApi]);

  return null;
}

/** Mounted only when NEXT_PUBLIC_PRIVY_APP_ID is set (lazy-loaded). */
export default function PrivyLayer({ appId, onApi }: { appId: string; onApi: (api: PrivyApi) => void }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
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
      }}
    >
      <Bridge onApi={onApi} />
    </PrivyProvider>
  );
}
