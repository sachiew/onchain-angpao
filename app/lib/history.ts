import type { Address } from "@solana/kit";

/**
 * Angpaos this browser created, so the dashboard can still list them after they're closed
 * (a closed account is deleted onchain and no longer shows up in getProgramAccounts).
 * Convenience only: the onchain query is the source of truth for open angpaos.
 */
export type HistoryEntry = { angpao: Address; createdAt: number; label: string };

const key = (creator: Address) => `angpao:created:${creator}`;

export function readHistory(creator: Address): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(key(creator));
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(creator: Address, entry: HistoryEntry) {
  try {
    const list = readHistory(creator).filter((e) => e.angpao !== entry.angpao);
    localStorage.setItem(key(creator), JSON.stringify([entry, ...list].slice(0, 100)));
  } catch {
    // storage unavailable (private mode); the dashboard still shows open angpaos
  }
}
