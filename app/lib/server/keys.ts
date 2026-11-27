import "server-only";
import {
  createKeyPairSignerFromBytes,
  getBase58Encoder,
  type KeyPairSigner,
} from "@solana/kit";

/** Parse a 64-byte secret key from base58 or a JSON array (Solana CLI format). */
export function parseSecretKey(raw: string): Uint8Array {
  const s = raw.trim();
  const bytes = s.startsWith("[")
    ? new Uint8Array(JSON.parse(s) as number[])
    : new Uint8Array(getBase58Encoder().encode(s));
  if (bytes.length !== 64) throw new Error("Secret key must be 64 bytes");
  return bytes;
}

let relayer: Promise<KeyPairSigner | null> | undefined;
let gatekeeper: Promise<KeyPairSigner | null> | undefined;

/** The fee payer. `null` when RELAYER_SECRET_KEY isn't configured (gasless disabled). */
export function getRelayerSigner(): Promise<KeyPairSigner | null> {
  relayer ??= process.env.RELAYER_SECRET_KEY
    ? createKeyPairSignerFromBytes(parseSecretKey(process.env.RELAYER_SECRET_KEY))
    : Promise.resolve(null);
  return relayer;
}

/** Co-signs gated claims. Falls back to the relayer key. */
export function getGatekeeperSigner(): Promise<KeyPairSigner | null> {
  gatekeeper ??= process.env.GATEKEEPER_SECRET_KEY
    ? createKeyPairSignerFromBytes(parseSecretKey(process.env.GATEKEEPER_SECRET_KEY))
    : getRelayerSigner();
  return gatekeeper;
}
