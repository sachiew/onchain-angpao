import "server-only";
import { NextResponse } from "next/server";
import { isAddress, type Address } from "@solana/kit";
import { buildClaim, ClaimError, clientIp } from "./claim-service";
import { angpaoErrorCode, parseTransactionError } from "../errors";
import { isRateLimitError } from "./rpc";

/**
 * Solana Pay transaction requests (the "Wallet QR"). They reuse the gasless claim path: the
 * relayer-signed transaction from `buildClaim`. It's partially signed, so the wallet must not
 * change the fee payer or blockhash: it only adds the claimer's signature and broadcasts it.
 * Rules checked against @solana/pay 1.0.26 `fetchTransaction`.
 *
 * CORS `*` is set only on the /api/pay routes.
 */
export const PAY_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Accept-Encoding",
};

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PAY_HEADERS });
export const preflight = () => new NextResponse(null, { status: 204, headers: PAY_HEADERS });

/** Solana Pay uses `{ message }` for errors. */
export function payError(e: unknown) {
  if (e instanceof ClaimError) return json({ message: e.message }, e.status);
  if (angpaoErrorCode(e) !== null) return json({ message: parseTransactionError(e) }, 409);
  if (isRateLimitError(e)) return json({ message: "The network is busy. Try again in a moment." }, 503);
  console.error("pay route error:", e instanceof Error ? e.message : "unknown");
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
