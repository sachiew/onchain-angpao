"use client";

import {
  getBase64Decoder,
  getBase64Encoder,
  type Address,
  type Signature,
} from "@solana/kit";

/**
 * Anything that can sign a relayer-built claim transaction as the claimer:
 * a wallet-standard wallet, a Privy embedded wallet, or the in-browser burner.
 * It receives the wire bytes (already signed by the relayer) and returns them signed.
 */
export type ClaimSigner = {
  address: Address;
  kind: "wallet" | "privy" | "burner";
  label: string;
  signWire(tx: Uint8Array): Promise<Uint8Array>;
};

export class GaslessError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j as T;
    // Network busy (RPC rate limit): back off and retry a few times.
    if (r.status === 503 && j.code === "Busy" && attempt < 3) {
      await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      continue;
    }
    throw new GaslessError(j.error ?? `Request failed (${r.status})`, j.code, r.status);
  }
}

export async function relayerInfo(): Promise<{ gasless: boolean; relayer: Address | null; gatekeeper: Address | null }> {
  const r = await fetch("/api/relayer");
  return r.json();
}

/**
 * Gasless claim: the server builds the tx (relayer pays the fee and signs first), the
 * claimer signs, the server verifies and broadcasts. Returns once broadcast; the page
 * confirms via its live account subscription.
 */
export async function gaslessClaim(angpao: Address, signer: ClaimSigner, passphrase?: string): Promise<Signature> {
  const built = await post<{ transaction: string }>("/api/claim/build", {
    angpao,
    claimer: signer.address,
    passphrase,
  });
  const unsigned = new Uint8Array(getBase64Encoder().encode(built.transaction));
  const signed = await signer.signWire(unsigned);
  const { signature } = await post<{ signature: Signature }>("/api/claim/submit", {
    transaction: getBase64Decoder().decode(signed),
  });
  return signature;
}
