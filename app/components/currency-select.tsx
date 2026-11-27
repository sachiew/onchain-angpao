"use client";

import { FIAT_CODES, FIATS } from "../lib/fiat";
import { useFiat } from "../lib/hooks/use-prices";

export function CurrencySelect({ className = "" }: { className?: string }) {
  const [fiat, setFiat] = useFiat();
  return (
    <select
      value={fiat}
      onChange={(e) => setFiat(e.target.value as typeof fiat)}
      aria-label="Display currency"
      className={`rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold ${className}`}
    >
      {FIAT_CODES.map((c) => (
        <option key={c} value={c}>
          {FIATS[c].label}
        </option>
      ))}
    </select>
  );
}
