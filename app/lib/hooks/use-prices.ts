"use client";

import useSWR from "swr";
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_FIAT } from "../config";
import { isFiatCode, type FiatCode, type Prices } from "../fiat";

export function usePrices() {
  const { data, error } = useSWR<Prices>(
    "/api/price",
    (url: string) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error("price");
        return r.json();
      }),
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
  return { prices: data, error };
}

const KEY = "angpao:fiat";
const listeners = new Set<() => void>();

function readFiat(): FiatCode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && isFiatCode(v) ? v : null;
  } catch {
    return null; // storage unavailable (private mode, previews)
  }
}

/** The viewer's selected local currency (remembered per browser, shared across components). */
export function useFiat(): [FiatCode, (c: FiatCode) => void] {
  const fallback: FiatCode = isFiatCode(DEFAULT_FIAT) ? DEFAULT_FIAT : "myr";
  const fiat = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readFiat() ?? fallback,
    () => fallback,
  );
  const setFiat = useCallback((c: FiatCode) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [fiat, setFiat];
}
