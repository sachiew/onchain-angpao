import { getAddressEncoder, isAddress, type Address } from "@solana/kit";

/**
 * Passphrase gate hash, stored onchain in `gate_hash`:
 *   sha256("angpao-gate" || angpao_pda (32 bytes) || utf8(NFC(trim(passphrase))))
 *
 * Salted with the PDA so the same passphrase hashes differently per angpao. A short
 * passphrase can still be guessed offline from the onchain hash; this is a demo-grade gate
 * (see README → Limitations). The real check is the server refusing to co-sign.
 */
export async function passphraseHash(angpao: Address, passphrase: string): Promise<Uint8Array> {
  const prefix = new TextEncoder().encode("angpao-gate");
  const pda = getAddressEncoder().encode(angpao);
  const phrase = new TextEncoder().encode(normalizePassphrase(passphrase));
  const buf = new Uint8Array(prefix.length + pda.length + phrase.length);
  buf.set(prefix, 0);
  buf.set(pda, prefix.length);
  buf.set(phrase, prefix.length + pda.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

export function normalizePassphrase(p: string) {
  return p.trim().normalize("NFC");
}

export function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const MAX_ALLOWLIST = 50;
export const ALLOWLIST_CHUNK = 25;
export const MIN_PASSPHRASE = 6;

/** Parse pasted wallet addresses (comma/space/newline separated), deduped, in order. */
export function parseAllowlist(text: string): { addresses: Address[]; invalid: string[] } {
  const seen = new Set<string>();
  const addresses: Address[] = [];
  const invalid: string[] = [];
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!isAddress(tok)) invalid.push(tok);
    else if (!seen.has(tok)) {
      seen.add(tok);
      addresses.push(tok);
    }
  }
  return { addresses, invalid };
}

export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
