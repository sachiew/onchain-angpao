import { getBase58Encoder } from "@solana/kit";

/** Same as app/lib/server/keys.ts parseSecretKey (that file is server-only). */
export function parseSecretKey(raw: string): Uint8Array {
  const s = raw.trim();
  const bytes = s.startsWith("[") ? new Uint8Array(JSON.parse(s) as number[]) : new Uint8Array(getBase58Encoder().encode(s));
  if (bytes.length !== 64) throw new Error("Secret key must be 64 bytes");
  return bytes;
}
