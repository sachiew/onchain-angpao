import "server-only";
import { NextResponse } from "next/server";
import { isAddress, type Address } from "@solana/kit";
import { NETWORK } from "../config";
import { buildClaim, ClaimError, clientIp } from "./claim-service";
import { angpaoErrorCode, parseTransactionError } from "../errors";
import { isRateLimitError } from "./rpc";

/**
 * Solana Actions (Blinks) and Solana Pay transaction requests share one claim path: the
 * relayer-signed transaction from `buildClaim`. It's partially signed, so per both specs
 * the wallet must not change the fee payer or blockhash: it only adds the claimer's
 * signature and broadcasts it itself.
 *
 * Header values from @solana/actions-spec 2.4.2 and @solana/actions 1.6.6 (BLOCKCHAIN_IDS,
 * ACTIONS_CORS_HEADERS). CORS `*` is set ONLY on these routes and /actions.json.
 */
const BLOCKCHAIN_IDS: Partial<Record<typeof NETWORK, string>> = {
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

export const ACTION_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
  "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
  "X-Action-Version": "2.4",
  ...(BLOCKCHAIN_IDS[NETWORK] ? { "X-Blockchain-Ids": BLOCKCHAIN_IDS[NETWORK]! } : {}),
};

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: ACTION_HEADERS });
export const preflight = () => new NextResponse(null, { status: 204, headers: ACTION_HEADERS });

/** Both specs use `{ message }` for errors. */
export function actionError(e: unknown) {
  if (e instanceof ClaimError) return json({ message: e.message }, e.status);
  if (angpaoErrorCode(e) !== null) return json({ message: parseTransactionError(e) }, 409);
  if (isRateLimitError(e)) return json({ message: "The network is busy. Try again in a moment." }, 503);
  console.error("action route error:", e instanceof Error ? e.message : "unknown");
  return json({ message: "Something went wrong. Please try again." }, 500);
}

/** POST body `{ account }` → relayer-signed claim tx for that account. */
export async function claimForAccount(req: Request, angpao: string, passphrase: string | undefined, message: string) {
  const body = (await req.json().catch(() => null)) as { account?: unknown } | null;
  const account = typeof body?.account === "string" ? body.account : "";
  if (!isAddress(angpao) || !isAddress(account)) return json({ message: "Invalid account" }, 400);
  const built = await buildClaim({
    angpao: angpao as Address,
    claimer: account,
    passphrase: passphrase?.slice(0, 200) || undefined,
    ip: clientIp(req),
  });
  return json({ type: "transaction", transaction: built.transaction, message });
}

export const origin = (req: Request) => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
