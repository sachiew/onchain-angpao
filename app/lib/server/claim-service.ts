import "server-only";
import {
  getBase64EncodedWireTransaction,
  partiallySignTransaction,
  type Address,
  type Transaction,
} from "@solana/kit";
import { fetchMaybeAngpao, GateKind, type Angpao } from "../../generated/angpao";
import { PROGRAM_ADDRESS } from "../config";
import { cacheGatekeeper, cachedGatekeeper, recentBlockhash, serverRpc as rpc } from "./rpc";
import { claimFeeLamports, compileClaimTx } from "../claim-tx";
import { bytesEqual, passphraseHash } from "../gate";
import { getGatekeeperSigner } from "./keys";
import { getRelayer } from "./relayer";
import { allow, getStore, storeMisconfigured } from "./store";
import { verifyClaimTx } from "./verify";

export class ClaimError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

function dailyBudgetLamports(): number {
  const sol = Number(process.env.RELAYER_DAILY_BUDGET_SOL ?? "0.1");
  return Math.floor((Number.isFinite(sol) && sol > 0 ? sol : 0.1) * 1e9);
}
const budgetKey = () => `budget:${new Date().toISOString().slice(0, 10)}`;

async function loadAngpao(angpao: Address): Promise<Angpao> {
  const acc = await fetchMaybeAngpao(rpc, angpao);
  if (!acc.exists) throw new ClaimError(404, "This angpao doesn't exist or has been closed", "NotFound");
  return acc.data;
}

async function requireRelayer() {
  const relayer = await getRelayer();
  if (!relayer) throw new ClaimError(503, "Gasless claims aren't configured on this server", "NoRelayer");
  if (storeMisconfigured())
    throw new ClaimError(503, "Relayer disabled: Upstash Redis is required in production", "NoStore");
  return relayer;
}

/** Same checks the program will do, so we never sponsor a transaction that would fail. */
function precheck(a: Angpao, claimer: Address) {
  const now = Date.now() / 1000;
  if (now >= Number(a.expiryTs)) throw new ClaimError(410, "This angpao has expired", "Expired");
  if (a.claimedCount >= a.numPackets) throw new ClaimError(410, "All packets have been claimed", "SoldOut");
  if (a.claims.some((c) => c.claimer === claimer))
    throw new ClaimError(409, "This wallet has already claimed a packet", "AlreadyClaimed");
  if (a.gateKind === GateKind.Allowlist && !a.allowlist.includes(claimer))
    throw new ClaimError(403, "This angpao is for invited wallets only", "NotInvited");
}

export type BuildInput = { angpao: Address; claimer: Address; passphrase?: string; ip: string };

/**
 * Build the sponsored claim transaction: relayer = fee payer. The relayer (and the
 * gatekeeper, for gated angpaos) sign now, so the claimer's wallet sees a partially signed
 * transaction it must not modify. The claimer signs and calls `submitClaim` (or, for
 * Solana Pay, the wallet broadcasts it itself).
 */
export async function buildClaim({ angpao, claimer, passphrase, ip }: BuildInput) {
  const relayer = await requireRelayer();
  if (!(await allow(`build:ip:${ip}`, 20, 60))) throw new ClaimError(429, "Too many requests, slow down", "RateLimited");
  if (!(await allow(`build:angpao:${angpao}`, 150, 60))) throw new ClaimError(429, "This angpao is busy, try again", "RateLimited");
  if (claimer === relayer.address) throw new ClaimError(400, "Invalid claimer");

  const a = await loadAngpao(angpao);
  precheck(a, claimer);
  cacheGatekeeper(angpao, a.gatekeeper.__option === "Some" ? a.gatekeeper.value : null);

  // Gatekeeper co-signature.
  const gatekeeperAddr = a.gatekeeper.__option === "Some" ? a.gatekeeper.value : null;
  const gk = gatekeeperAddr ? await getGatekeeperSigner() : null;
  if (gatekeeperAddr && gk?.address !== gatekeeperAddr)
    throw new ClaimError(409, "This angpao is gated by a different server", "WrongGatekeeper");
  if (a.gateKind === GateKind.Passphrase) {
    if (!passphrase) throw new ClaimError(401, "Enter the passphrase to claim", "PassphraseRequired");
    if (!(await allow(`pass:${ip}:${angpao}`, 8, 60)))
      throw new ClaimError(429, "Too many attempts. Wait a minute.", "RateLimited");
    const hash = await passphraseHash(angpao, passphrase);
    if (!bytesEqual(hash, a.gateHash)) throw new ClaimError(403, "Wrong passphrase", "WrongPassphrase");
  }

  // Daily budget (reserve the worst-case fee now; rolled back on failure where possible).
  const signers = new Set([relayer.address, claimer, ...(gatekeeperAddr ? [gatekeeperAddr] : [])]);
  const fee = Number(claimFeeLamports(signers.size));
  const store = getStore();
  const spent = await store.incr(budgetKey(), fee, 2 * 86400);
  if (spent > dailyBudgetLamports()) {
    await store.incr(budgetKey(), -fee, 2 * 86400);
    throw new ClaimError(503, "Today's free-claim budget is used up. Try again after 00:00 UTC, or claim with a wallet that has a little SOL.", "BudgetExhausted");
  }

  const latest = await recentBlockhash();
  let tx: Transaction = compileClaimTx({
    programAddress: PROGRAM_ADDRESS,
    relayer: relayer.address,
    angpao,
    claimer,
    gatekeeper: gatekeeperAddr,
    blockhash: latest.blockhash,
  });
  tx = await relayer.sign(tx);
  if (gk && gk.address !== relayer.address) tx = await partiallySignTransaction([gk.keyPair], tx);

  return {
    transaction: getBase64EncodedWireTransaction(tx),
    lastValidBlockHeight: latest.lastValidBlockHeight.toString(),
    feePayer: relayer.address,
  };
}

/** Verify a claimer-signed transaction is exactly our template, then broadcast it. */
export async function submitClaim(wire: Uint8Array, ip: string) {
  const relayer = await requireRelayer();
  if (!(await allow(`submit:ip:${ip}`, 20, 60))) throw new ClaimError(429, "Too many requests, slow down", "RateLimited");

  const result = await verifyClaimTx(wire, {
    relayer: relayer.address,
    programAddress: PROGRAM_ADDRESS,
    gatekeeperFor: async (angpao) => {
      const cached = cachedGatekeeper(angpao);
      if (cached !== undefined) return cached;
      const acc = await fetchMaybeAngpao(rpc, angpao);
      if (!acc.exists) return undefined;
      const gk = acc.data.gatekeeper.__option === "Some" ? acc.data.gatekeeper.value : null;
      cacheGatekeeper(angpao, gk);
      return gk;
    },
  });
  if (!result.ok) throw new ClaimError(400, result.reason, "Rejected");
  // No second account fetch: the RPC's preflight simulation rejects a claim that would fail
  // (sold out, already claimed, expired) before any fee is charged.

  // The relayer already signed at build; re-signing is idempotent (ed25519 is deterministic)
  // and guarantees the fee-payer signature matches these exact bytes.
  const signed = await relayer.sign(result.transaction);
  const signature = await relayer.send(signed);
  return { signature };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}
