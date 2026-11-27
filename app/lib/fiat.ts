export type FiatCode = "myr" | "sgd" | "idr" | "usd" | "cny";

export const FIATS: Record<
  FiatCode,
  { label: string; symbol: string; decimals: number; locale: string }
> = {
  myr: { label: "MYR", symbol: "RM", decimals: 2, locale: "en-MY" },
  sgd: { label: "SGD", symbol: "S$", decimals: 2, locale: "en-SG" },
  idr: { label: "IDR", symbol: "Rp", decimals: 0, locale: "id-ID" },
  usd: { label: "USD", symbol: "$", decimals: 2, locale: "en-US" },
  cny: { label: "CNY", symbol: "¥", decimals: 2, locale: "zh-CN" },
};

export const FIAT_CODES = Object.keys(FIATS) as FiatCode[];

export function isFiatCode(x: string): x is FiatCode {
  return x in FIATS;
}

/** "RM 88.00" style. */
export function formatFiat(amount: number, code: FiatCode): string {
  const f = FIATS[code];
  const n = amount.toLocaleString(f.locale, {
    minimumFractionDigits: f.decimals,
    maximumFractionDigits: f.decimals,
  });
  return `${f.symbol} ${n}`;
}

/** Fiat amount → minor units for onchain storage (8800 = RM 88.00). */
export function toMinor(amount: number, code: FiatCode): bigint {
  return BigInt(Math.round(amount * 10 ** FIATS[code].decimals));
}

export function fromMinor(minor: bigint, code: FiatCode): number {
  return Number(minor) / 10 ** FIATS[code].decimals;
}

/** 3-byte ASCII code for the account's `fiat_code` field. */
export function fiatCodeBytes(code: FiatCode): Uint8Array {
  return new TextEncoder().encode(code);
}

export function fiatCodeFromBytes(bytes: ArrayLike<number>): FiatCode | null {
  const s = String.fromCharCode(...Array.from(bytes));
  return isFiatCode(s) ? s : null;
}

/** Fiat → lamports at a SOL price. */
export function fiatToLamports(amount: number, solPrice: number): bigint {
  if (!(solPrice > 0) || !(amount > 0)) return 0n;
  return BigInt(Math.floor((amount / solPrice) * 1e9));
}

export type Prices = {
  solana: Partial<Record<FiatCode, number>>;
  "usd-coin"?: Partial<Record<FiatCode, number>>;
  fetchedAt: number;
};
