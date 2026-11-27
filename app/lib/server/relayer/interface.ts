import type { Address, Signature, Transaction } from "@solana/kit";

/**
 * Minimal fee-payer interface. Deliberately mirrors Kora's RPC (`signTransaction`,
 * `signAndSendTransaction`) so the custom relayer can be swapped for Kora later:
 * see README → "Swapping in Kora".
 *
 * Callers MUST only pass transactions produced by `compileClaimTx` (checked by
 * `verifyClaimTx`). The relayer never signs arbitrary transactions.
 */
export interface Relayer {
  readonly address: Address;
  /** Add the fee payer's signature to a transaction we built. */
  sign(tx: Transaction): Promise<Transaction>;
  /**
   * Broadcast a fully signed transaction (after preflight simulation) and return its
   * signature without waiting for confirmation; the client confirms on its own.
   */
  send(tx: Transaction): Promise<Signature>;
}
