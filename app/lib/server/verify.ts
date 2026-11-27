// No "server-only" import here so the verifier can be unit-tested directly.
import {
  getCompiledTransactionMessageDecoder,
  getPublicKeyFromAddress,
  getTransactionDecoder,
  verifySignature,
  type Address,
  type Blockhash,
  type Transaction,
} from "@solana/kit";
import { bytesEqual } from "../gate";
import { compileClaimTx } from "../claim-tx";

export type VerifyContext = {
  relayer: Address;
  programAddress: Address;
  /** Onchain gatekeeper for this angpao (`undefined` if the angpao doesn't exist). */
  gatekeeperFor: (angpao: Address) => Promise<Address | null | undefined>;
};

export type VerifyResult =
  | { ok: true; transaction: Transaction; angpao: Address; claimer: Address }
  | { ok: false; reason: string };

/**
 * Before the relayer's signature goes out, prove this transaction is *exactly* one we would
 * build: rebuild the expected claim tx from the angpao/claimer/blockhash it names and
 * require byte-for-byte equality of the message. That rules out extra instructions, other
 * programs, different accounts, a higher fee, address lookup tables, and the relayer being
 * used anywhere except as fee payer (and as the read-only gatekeeper, if configured that way).
 * Then verify every signature that must be present.
 */
export async function verifyClaimTx(wire: Uint8Array, ctx: VerifyContext): Promise<VerifyResult> {
  let tx: Transaction;
  try {
    tx = getTransactionDecoder().decode(wire);
  } catch {
    return { ok: false, reason: "Malformed transaction" };
  }

  let compiled;
  try {
    compiled = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  } catch {
    return { ok: false, reason: "Malformed message" };
  }
  if (compiled.version !== 0) return { ok: false, reason: "Expected a v0 transaction" };
  if (compiled.staticAccounts[0] !== ctx.relayer) return { ok: false, reason: "Fee payer must be the relayer" };
  if (compiled.instructions.length !== 3) return { ok: false, reason: "Unexpected instructions" };

  const claimIx = compiled.instructions[2];
  if (compiled.staticAccounts[claimIx.programAddressIndex] !== ctx.programAddress)
    return { ok: false, reason: "Unexpected program" };
  const idx = claimIx.accountIndices ?? [];
  if (idx.length !== 3) return { ok: false, reason: "Unexpected accounts" };
  const angpao = compiled.staticAccounts[idx[0]];
  const claimer = compiled.staticAccounts[idx[1]];
  if (!angpao || !claimer) return { ok: false, reason: "Unexpected accounts" };
  if (claimer === ctx.relayer) return { ok: false, reason: "The relayer can't claim" };

  const gatekeeper = await ctx.gatekeeperFor(angpao);
  if (gatekeeper === undefined) return { ok: false, reason: "Angpao not found" };

  const expected = compileClaimTx({
    programAddress: ctx.programAddress,
    relayer: ctx.relayer,
    angpao,
    claimer,
    gatekeeper,
    blockhash: compiled.lifetimeToken as Blockhash,
  });
  if (!bytesEqual(expected.messageBytes, tx.messageBytes))
    return { ok: false, reason: "Transaction does not match the claim template" };

  // Signatures: the claimer must have signed; the relayer (and gatekeeper) signed at build.
  const required = new Set<Address>([claimer, ctx.relayer, ...(gatekeeper ? [gatekeeper] : [])]);
  if (Object.keys(tx.signatures).length !== required.size)
    return { ok: false, reason: "Unexpected signers" };
  for (const signer of required) {
    const sig = tx.signatures[signer];
    if (!sig) return { ok: false, reason: `Missing signature from ${signer === claimer ? "claimer" : signer}` };
    const key = await getPublicKeyFromAddress(signer);
    if (!(await verifySignature(key, sig, tx.messageBytes)))
      return { ok: false, reason: `Invalid signature from ${signer === claimer ? "claimer" : signer}` };
  }
  return { ok: true, transaction: tx, angpao, claimer };
}

