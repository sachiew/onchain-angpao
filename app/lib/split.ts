/**
 * Packet splitting. Runs in the browser; the program re-validates the result.
 *
 * Lucky mode is randomised by the *creator's* browser. That's fine: it's their gift, and
 * the program still enforces the sum and the per-packet minimum.
 */

export const LAMPORTS_PER_SOL = 1_000_000_000n;
/** Must match `MIN_PACKET_LAMPORTS` in the program (0.001 SOL, above the rent minimum). */
export const MIN_PACKET_LAMPORTS = 1_000_000n;
export const MAX_PACKETS = 50;

export type RandomBelow = (n: bigint) => bigint;

/** Uniform random bigint in [0, n) using crypto.getRandomValues with rejection sampling. */
export const cryptoRandomBelow: RandomBelow = (n) => {
  if (n <= 0n) throw new Error("n must be positive");
  const bits = n.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;
  const buf = new Uint8Array(bytes);
  for (;;) {
    crypto.getRandomValues(buf);
    let x = 0n;
    for (const b of buf) x = (x << 8n) | BigInt(b);
    x &= mask;
    if (x < n) return x;
  }
};

export function validateSplitInput(total: bigint, packets: number): string | null {
  if (!Number.isInteger(packets) || packets < 1 || packets > MAX_PACKETS)
    return `Packets must be between 1 and ${MAX_PACKETS}`;
  if (total < MIN_PACKET_LAMPORTS * BigInt(packets))
    return `Each packet needs at least 0.001 SOL (min total ${
      Number(MIN_PACKET_LAMPORTS * BigInt(packets)) / 1e9
    } SOL)`;
  return null;
}

/** Equal: floor(total / n) each; the remainder goes on the last packet. */
export function equalSplit(total: bigint, packets: number): bigint[] {
  const err = validateSplitInput(total, packets);
  if (err) throw new Error(err);
  const n = BigInt(packets);
  const base = total / n;
  const out = Array<bigint>(packets).fill(base);
  out[packets - 1] = total - base * (n - 1n);
  return out;
}

/**
 * Lucky: the "double average" method. Each packet is random in
 * [MIN, min(2 × remaining average, remaining − MIN × packets still to fill)],
 * the last packet takes what's left, then the order is shuffled.
 */
export function luckySplit(
  total: bigint,
  packets: number,
  randomBelow: RandomBelow = cryptoRandomBelow,
): bigint[] {
  const err = validateSplitInput(total, packets);
  if (err) throw new Error(err);
  const out: bigint[] = [];
  let remaining = total;
  for (let i = 0; i < packets; i++) {
    const left = BigInt(packets - i);
    if (left === 1n) {
      out.push(remaining);
      break;
    }
    const doubleAvg = (remaining * 2n) / left;
    const reserve = remaining - MIN_PACKET_LAMPORTS * (left - 1n);
    const max = doubleAvg < reserve ? doubleAvg : reserve;
    const amount = MIN_PACKET_LAMPORTS + randomBelow(max - MIN_PACKET_LAMPORTS + 1n);
    out.push(amount);
    remaining -= amount;
  }
  // Fisher–Yates shuffle so the big packet isn't biased towards early claimers.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Number(randomBelow(BigInt(i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function solToLamports(sol: string | number): bigint {
  const s = typeof sol === "number" ? sol.toFixed(9) : sol.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return 0n;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole || "0") * LAMPORTS_PER_SOL + BigInt((frac + "000000000").slice(0, 9));
}

export function lamportsToSol(l: bigint): number {
  return Number(l) / 1e9;
}

export function formatSol(l: bigint, maxDecimals = 4): string {
  const sol = lamportsToSol(l);
  return sol.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}
