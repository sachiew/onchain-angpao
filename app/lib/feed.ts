import type { Address } from "@solana/kit";
import type { Angpao } from "../generated/angpao";

export type FeedEntry = {
  index: number;
  claimer: Address;
  ts: number;
  amount: bigint;
  luckiest: boolean;
};

/**
 * Packet `i` goes to the `i`-th claimer, so each claim's amount is `amounts[i]`.
 * The "Luckiest" crown appears once sold out. On a tie, the earliest claimer wins it.
 * Returned newest first.
 */
export function buildFeed(a: Angpao): FeedEntry[] {
  const soldOut = a.claimedCount === a.numPackets;
  let luckiestIdx = -1;
  if (soldOut && a.numPackets > 1) {
    let max = -1n;
    a.claims.forEach((_, i) => {
      if (a.amounts[i] > max) {
        max = a.amounts[i];
        luckiestIdx = i;
      }
    });
  }
  return a.claims
    .map((c, i) => ({
      index: i,
      claimer: c.claimer,
      ts: Number(c.ts),
      amount: a.amounts[i],
      luckiest: i === luckiestIdx,
    }))
    .reverse();
}

/** What a given wallet received from this angpao, if anything. */
export function claimOf(a: Angpao, who: Address | undefined): FeedEntry | null {
  if (!who) return null;
  const i = a.claims.findIndex((c) => c.claimer === who);
  if (i < 0) return null;
  return buildFeed(a).find((e) => e.index === i) ?? null;
}

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, now - ts);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function countdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Expired";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
