/**
 * Display currencies, in dropdown order. Every code must be a CoinGecko `vs_currencies`
 * value (checked against /simple/supported_vs_currencies) and exactly 3 ASCII letters,
 * because it's stored onchain in the 3-byte `fiat_code` field. Append freely; existing
 * angpaos only need their own code to stay in this list.
 */
export const FIATS = {
  usd: { label: "USD", name: "US Dollar", symbol: "$", decimals: 2, locale: "en-US" },
  eur: { label: "EUR", name: "Euro", symbol: "€", decimals: 2, locale: "de-DE" },
  gbp: { label: "GBP", name: "British Pound", symbol: "£", decimals: 2, locale: "en-GB" },
  jpy: { label: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, locale: "ja-JP" },
  cny: { label: "CNY", name: "Chinese Yuan", symbol: "CN¥", decimals: 2, locale: "zh-CN" },
  hkd: { label: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2, locale: "zh-HK" },
  twd: { label: "TWD", name: "New Taiwan Dollar", symbol: "NT$", decimals: 0, locale: "zh-TW" },
  krw: { label: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0, locale: "ko-KR" },
  sgd: { label: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, locale: "en-SG" },
  myr: { label: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2, locale: "en-MY" },
  idr: { label: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0, locale: "id-ID" },
  thb: { label: "THB", name: "Thai Baht", symbol: "฿", decimals: 2, locale: "th-TH" },
  php: { label: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2, locale: "en-PH" },
  vnd: { label: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0, locale: "vi-VN" },
  inr: { label: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, locale: "en-IN" },
  aud: { label: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, locale: "en-AU" },
  nzd: { label: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2, locale: "en-NZ" },
  cad: { label: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, locale: "en-CA" },
  chf: { label: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, locale: "de-CH" },
  aed: { label: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, locale: "en-AE" },
  brl: { label: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, locale: "pt-BR" },
  mxn: { label: "MXN", name: "Mexican Peso", symbol: "MX$", decimals: 2, locale: "es-MX" },
} as const satisfies Record<string, { label: string; name: string; symbol: string; decimals: number; locale: string }>;

export type FiatCode = keyof typeof FIATS;

export const FIAT_CODES = Object.keys(FIATS) as FiatCode[];

export function isFiatCode(x: string): x is FiatCode {
  return Object.hasOwn(FIATS, x);
}

/** "$88.00", "€88.00", "RM 88.00" (a space only after letter symbols). */
export function formatFiat(amount: number, code: FiatCode): string {
  const f = FIATS[code];
  const n = amount.toLocaleString(f.locale, {
    minimumFractionDigits: f.decimals,
    maximumFractionDigits: f.decimals,
  });
  return /[A-Za-z]$/.test(f.symbol) ? `${f.symbol} ${n}` : `${f.symbol}${n}`;
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
