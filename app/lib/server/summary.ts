import "server-only";
import { isAddress, type Address } from "@solana/kit";
import { fetchMaybeAngpao, GateKind, SplitMode, type Angpao } from "../../generated/angpao";
import { angpaoStatus } from "../angpao";
import { fiatCodeFromBytes, formatFiat, fromMinor } from "../fiat";
import { formatSol } from "../split";
import { getTheme, type Theme } from "../themes";
import { serverRpc } from "./rpc";

/** Everything a link preview (OG image, metadata, Solana Pay) needs, read from chain. */
export type AngpaoSummary = {
  address: Address;
  data: Angpao;
  theme: Theme;
  /** "RM 88.00" (value at creation) or "0.5 SOL" */
  amountLabel: string;
  /** "8 packets · Lucky" */
  packetsLabel: string;
  left: number;
  expired: boolean;
  soldOut: boolean;
  gate: GateKind;
};

export async function getAngpaoSummary(id: string): Promise<AngpaoSummary | null> {
  if (!isAddress(id)) return null;
  const acc = await fetchMaybeAngpao(serverRpc, id).catch(() => null);
  if (!acc?.exists) return null;
  const d = acc.data;
  const code = fiatCodeFromBytes(d.fiatCode);
  const amountLabel =
    code && d.fiatTotalMinor > 0n ? formatFiat(fromMinor(d.fiatTotalMinor, code), code) : `${formatSol(d.totalLamports)} SOL`;
  const { left, expired, soldOut } = angpaoStatus(d, Date.now() / 1000);
  return {
    address: id,
    data: d,
    theme: getTheme(d.theme),
    amountLabel,
    packetsLabel: `${d.numPackets} packet${d.numPackets === 1 ? "" : "s"} · ${d.mode === SplitMode.Lucky ? "Lucky" : "Equal"}`,
    left,
    expired,
    soldOut,
    gate: d.gateKind,
  };
}

export function summaryStatus(s: AngpaoSummary): string {
  if (s.soldOut) return "All packets claimed";
  if (s.expired) return "Expired";
  return `${s.left} of ${s.data.numPackets} left`;
}
