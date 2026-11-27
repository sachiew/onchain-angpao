"use client";

import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  lamports,
  partiallySignTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import type { ClaimSigner } from "../gasless";

/**
 * Instant burner wallet: a keypair generated in this browser and kept in localStorage.
 * For small demo amounts only. Clearing site data loses it, so the UI pushes
 * "Back up key" and "Send to my real wallet".
 */
const KEY = "angpao:burner:v1";

function loadSeed(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as number[];
    return arr.length === 32 ? new Uint8Array(arr) : null;
  } catch {
    return null;
  }
}

export function hasBurner(): boolean {
  return loadSeed() !== null;
}

export async function getBurner(create = false): Promise<KeyPairSigner | null> {
  let seed = loadSeed();
  if (!seed) {
    if (!create) return null;
    seed = crypto.getRandomValues(new Uint8Array(32));
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.from(seed)));
    } catch {
      throw new Error("This browser blocks storage, so an instant wallet can't be saved. Try connecting a wallet instead.");
    }
  }
  return createKeyPairSignerFromPrivateKeyBytes(seed);
}

export function burnerClaimSigner(s: KeyPairSigner): ClaimSigner {
  return {
    address: s.address,
    kind: "burner",
    label: "Instant wallet",
    async signWire(bytes) {
      const tx = getTransactionDecoder().decode(bytes);
      const signed = await partiallySignTransaction([s.keyPair], tx);
      return new Uint8Array(getTransactionEncoder().encode(signed));
    },
  };
}

/**
 * 64-byte secret (seed ‖ pubkey) as base58: the format Phantom/Solflare/Backpack accept
 * under "Import private key".
 */
export async function exportBurnerSecret(): Promise<string | null> {
  const seed = loadSeed();
  const s = await getBurner();
  if (!seed || !s) return null;
  const pub = getAddressEncoder().encode(s.address);
  return getBase58Decoder().decode(new Uint8Array([...seed, ...pub]));
}

export function forgetBurner() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const FEE = 5000n;

/**
 * Send everything to another wallet. The burner pays its own 5000-lamport fee, so it sends
 * `balance − fee` and ends at exactly 0. (A partial send that left it between 0 and the
 * rent-exempt minimum would be rejected by the network.)
 */
export async function sweepBurner(rpc: Rpc<SolanaRpcApi>, destination: Address): Promise<string> {
  const s = await getBurner();
  if (!s) throw new Error("No instant wallet on this device");
  if (destination === s.address) throw new Error("That's the same wallet");
  const { value: balance } = await rpc.getBalance(s.address).send();
  if (balance <= FEE) throw new Error("Nothing to send");
  const { value: bh } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(s, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) =>
      appendTransactionMessageInstruction(
        getTransferSolInstruction({ source: s, destination, amount: lamports(balance - FEE) }),
        m,
      ),
  );
  const tx = await signTransactionMessageWithSigners(msg);
  return rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64" }).send();
}
