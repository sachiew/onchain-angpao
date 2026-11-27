"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "@solana/kit";
import { getClaimInstruction } from "../../generated/angpao";
import { CHAIN, PROGRAM_ADDRESS } from "../config";
import { gaslessClaim, relayerInfo, type ClaimSigner } from "../gasless";
import { useWallet } from "../wallet/context";
import { useInstantWallet } from "../wallet/instant";
import { useSendTransaction } from "./use-send-transaction";

/**
 * Who would claim right now: a connected wallet takes priority, then an instant wallet
 * (Privy or the burner) if one exists on this device.
 */
export function useClaimer(): { active: ClaimSigner | null; walletCanSign: boolean } {
  const { wallet } = useWallet();
  const instant = useInstantWallet();
  const walletSigner = useMemo<ClaimSigner | null>(() => {
    if (!wallet?.signTransaction) return null;
    const sign = wallet.signTransaction;
    return {
      address: wallet.account.address,
      kind: "wallet",
      label: wallet.connector.name,
      signWire: (bytes) => sign(bytes, CHAIN),
    };
  }, [wallet]);
  return { active: walletSigner ?? instant.signer, walletCanSign: !!walletSigner };
}

let gaslessCache: Promise<boolean> | null = null;
function useGaslessAvailable() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    gaslessCache ??= relayerInfo()
      .then((i) => i.gasless)
      .catch(() => false);
    gaslessCache.then(setOn);
  }, []);
  return on;
}

/**
 * Claim a packet. Gasless by default: the relayer pays the fee, so a 0-SOL wallet works.
 * If the server has no relayer configured, a connected wallet pays its own (tiny) fee.
 */
export function useClaim(angpao: Address | null) {
  const { signer: walletTxSigner } = useWallet();
  const { send } = useSendTransaction();
  const gasless = useGaslessAvailable();
  const [isClaiming, setIsClaiming] = useState(false);

  const claim = useCallback(
    async (claimer: ClaimSigner, passphrase?: string) => {
      if (!angpao) throw new Error("No angpao");
      setIsClaiming(true);
      try {
        if (gasless !== false) return await gaslessClaim(angpao, claimer, passphrase);
        if (claimer.kind !== "wallet" || !walletTxSigner)
          throw new Error("Gasless claims are off on this server. Connect a funded wallet to claim.");
        const ix = getClaimInstruction({ angpao, claimer: walletTxSigner }, { programAddress: PROGRAM_ADDRESS });
        return await send({ instructions: [ix] });
      } finally {
        setIsClaiming(false);
      }
    },
    [angpao, gasless, walletTxSigner, send],
  );

  return { claim, isClaiming, gasless };
}
