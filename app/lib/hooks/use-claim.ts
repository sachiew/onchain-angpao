"use client";

import { useCallback, useState } from "react";
import type { Address } from "@solana/kit";
import { getClaimInstruction } from "../../generated/angpao";
import { PROGRAM_ADDRESS } from "../config";
import { useWallet } from "../wallet/context";
import { useSendTransaction } from "./use-send-transaction";

/**
 * Claim with the connected wallet.
 *
 * M3: the connected wallet pays its own fee (~0.000005 SOL).
 * M4: this switches to the gasless relayer path (relayer = fee payer, claimer only signs).
 */
export function useClaim(angpao: Address | null) {
  const { signer } = useWallet();
  const { send } = useSendTransaction();
  const [isClaiming, setIsClaiming] = useState(false);

  const claim = useCallback(async () => {
    if (!signer || !angpao) throw new Error("Connect a wallet first");
    setIsClaiming(true);
    try {
      const ix = getClaimInstruction(
        { angpao, claimer: signer },
        { programAddress: PROGRAM_ADDRESS },
      );
      return await send({ instructions: [ix] });
    } finally {
      setIsClaiming(false);
    }
  }, [signer, angpao, send]);

  return { claim, isClaiming, canClaim: !!signer };
}
