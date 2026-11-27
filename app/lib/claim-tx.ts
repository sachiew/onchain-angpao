import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { getClaimInstruction } from "../generated/angpao";

/** A claim uses ~8k CU; 30k leaves headroom. Keep the cap low: it bounds the priority fee. */
export const CLAIM_CU_LIMIT = 30_000;
/** Priority fee in micro-lamports per CU → 30_000 × 10_000 / 1e6 = 300 lamports. */
export const CLAIM_CU_PRICE = 10_000n;

export type ClaimTxParams = {
  programAddress: Address;
  relayer: Address;
  angpao: Address;
  claimer: Address;
  gatekeeper: Address | null;
  blockhash: Blockhash;
};

/**
 * The ONE claim transaction shape the relayer will ever sign:
 *   [SetComputeUnitLimit, SetComputeUnitPrice, angpao::claim]
 * with fee payer = relayer. It's deterministic: the same inputs give the same message
 * bytes, which is how `submit` checks that a transaction is exactly what `build` produced.
 */
export function compileClaimTx(p: ClaimTxParams) {
  const claimIx = getClaimInstruction(
    {
      angpao: p.angpao,
      claimer: createNoopSigner(p.claimer),
      gatekeeper: p.gatekeeper ? createNoopSigner(p.gatekeeper) : undefined,
    },
    { programAddress: p.programAddress },
  );
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(p.relayer, m),
    // lastValidBlockHeight isn't part of the wire format; it's only used for confirmation.
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: p.blockhash, lastValidBlockHeight: 0n }, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: CLAIM_CU_LIMIT }),
          getSetComputeUnitPriceInstruction({ microLamports: CLAIM_CU_PRICE }),
          claimIx,
        ],
        m,
      ),
  );
  return compileTransaction(message);
}

/** Worst-case fee the relayer pays for one claim: 5000 lamports per signature + priority fee. */
export function claimFeeLamports(numSignatures: number): bigint {
  return 5000n * BigInt(numSignatures) + (BigInt(CLAIM_CU_LIMIT) * CLAIM_CU_PRICE + 999_999n) / 1_000_000n;
}
