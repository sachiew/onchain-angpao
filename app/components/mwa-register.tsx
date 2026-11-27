"use client";

import { useEffect } from "react";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { CHAIN } from "../lib/config";

/**
 * Mobile Wallet Adapter: on Android Chrome, registers a wallet-standard wallet that hands
 * off to installed wallet apps (Phantom, Solflare…). It's a no-op on other platforms.
 */
export function MwaRegister() {
  useEffect(() => {
    try {
      registerMwa({
        appIdentity: { name: "Onchain Angpao", uri: window.location.origin, icon: "/icon.svg" },
        authorizationCache: createDefaultAuthorizationCache(),
        chains: [CHAIN],
        chainSelector: createDefaultChainSelector(),
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
    } catch {
      /* unsupported environment */
    }
  }, []);
  return null;
}
