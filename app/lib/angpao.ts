import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import {
  GateKind,
  SplitMode,
  getCreateAngpaoInstruction,
  getSetAllowlistInstruction,
  type Angpao,
} from "../generated/angpao";
import { PROGRAM_ADDRESS } from "./config";
import { fiatCodeBytes, type FiatCode } from "./fiat";
import { ALLOWLIST_CHUNK, chunk } from "./gate";

export const MAX_MESSAGE_BYTES = 140;
export const EXPIRY_OPTIONS = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "3 days", seconds: 3 * 24 * 60 * 60 },
] as const;

/**
 * Solana note — PDA: the angpao's address is derived from seeds, so anyone can recompute it
 * from (creator, id) without a lookup. Seeds: ["angpao", creator, id as u64 little-endian].
 */
export async function findAngpaoPda(creator: Address, id: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ADDRESS,
    seeds: [
      getUtf8Encoder().encode("angpao"),
      getAddressEncoder().encode(creator),
      getU64Encoder().encode(id),
    ],
  });
  return pda;
}

/** Random u64 id so one creator can have many angpaos without a counter account. */
export function randomId(): bigint {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return new DataView(b.buffer).getBigUint64(0, true);
}

export type CreateParams = {
  creator: TransactionSigner;
  id: bigint;
  mode: "lucky" | "equal";
  theme: number;
  message: string;
  amounts: bigint[];
  expiryTs: bigint;
  fiat: FiatCode;
  fiatTotalMinor: bigint;
  gatekeeper?: Address | null;
  gateKind?: GateKind;
  gateHash?: Uint8Array;
  allowlistCap?: number;
};

export async function buildCreateAngpaoIx(p: CreateParams) {
  const angpao = await findAngpaoPda(p.creator.address, p.id);
  const ix = getCreateAngpaoInstruction(
    {
      creator: p.creator,
      angpao,
      id: p.id,
      mode: p.mode === "lucky" ? SplitMode.Lucky : SplitMode.Equal,
      theme: p.theme,
      message: p.message,
      amounts: p.amounts,
      expiryTs: p.expiryTs,
      gatekeeper: p.gatekeeper ?? null,
      gateKind: p.gateKind ?? GateKind.None,
      gateHash: p.gateHash ?? new Uint8Array(32),
      fiatCode: fiatCodeBytes(p.fiat),
      fiatTotalMinor: p.fiatTotalMinor,
      allowlistCap: p.allowlistCap ?? 0,
    },
    { programAddress: PROGRAM_ADDRESS },
  );
  return { ix, angpao };
}

/**
 * `set_allowlist` instructions, ≤25 wallets each so every one fits in its own transaction.
 * Send them after `create_angpao` and before sharing: until then nobody is on the list.
 */
export function buildSetAllowlistIxs(creator: TransactionSigner, angpao: Address, entries: Address[]) {
  return chunk(entries, ALLOWLIST_CHUNK).map((c) =>
    getSetAllowlistInstruction({ creator, angpao, entries: c }, { programAddress: PROGRAM_ADDRESS }),
  );
}

/** Derived view helpers used by the claim page, feed and dashboard. */
export function angpaoStatus(a: Angpao, nowSec: number) {
  const left = a.numPackets - a.claimedCount;
  const expired = nowSec >= Number(a.expiryTs);
  const soldOut = left === 0;
  const claimedLamports = a.amounts
    .slice(0, a.claimedCount)
    .reduce((s, x) => s + x, 0n);
  return { left, expired, soldOut, claimedLamports };
}
