"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { PropsWithChildren } from "react";
import { ClusterProvider } from "./cluster-context";
import { WalletProvider } from "../lib/wallet/context";
import { InstantWalletProvider } from "../lib/wallet/instant";
import { SolanaClientProvider } from "../lib/solana-client-context";
import { MwaRegister } from "./mwa-register";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <ClusterProvider>
        <SolanaClientProvider>
          <WalletProvider>
            <InstantWalletProvider>{children}</InstantWalletProvider>
          </WalletProvider>
        </SolanaClientProvider>
        <MwaRegister />
        <Toaster position="top-center" richColors />
      </ClusterProvider>
    </ThemeProvider>
  );
}
