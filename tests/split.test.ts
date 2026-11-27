import { describe, expect, it } from "vitest";
import {
  equalSplit,
  luckySplit,
  MIN_PACKET_LAMPORTS,
  solToLamports,
  validateSplitInput,
} from "../app/lib/split";
import { fiatToLamports, formatFiat, toMinor } from "../app/lib/fiat";
import { byteLength, THEMES } from "../app/lib/themes";

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

describe("equalSplit", () => {
  it("splits exactly, remainder on the last packet", () => {
    const total = 100_000_007n;
    const out = equalSplit(total, 8);
    expect(sum(out)).toBe(total);
    expect(out.slice(0, 7).every((x) => x === total / 8n)).toBe(true);
    expect(out[7]).toBe(total / 8n + (total % 8n));
  });

  it("rejects packets below the minimum", () => {
    expect(() => equalSplit(MIN_PACKET_LAMPORTS * 8n - 1n, 8)).toThrow();
    expect(equalSplit(MIN_PACKET_LAMPORTS * 8n, 8)).toHaveLength(8);
  });
});

describe("luckySplit", () => {
  it("always sums to the total and respects the minimum (1000 runs)", () => {
    for (let run = 0; run < 1000; run++) {
      const n = 1 + (run % 50);
      const total = MIN_PACKET_LAMPORTS * BigInt(n) + BigInt(run) * 123_457n;
      const out = luckySplit(total, n);
      expect(out).toHaveLength(n);
      expect(sum(out)).toBe(total);
      expect(out.every((x) => x >= MIN_PACKET_LAMPORTS)).toBe(true);
    }
  });

  it("works at the exact minimum total", () => {
    const out = luckySplit(MIN_PACKET_LAMPORTS * 50n, 50);
    expect(out.every((x) => x === MIN_PACKET_LAMPORTS)).toBe(true);
  });

  it("is actually random", () => {
    const a = luckySplit(1_000_000_000n, 8).join();
    const b = luckySplit(1_000_000_000n, 8).join();
    expect(a).not.toBe(b);
  });
});

describe("validateSplitInput", () => {
  it("enforces 1..50 packets", () => {
    expect(validateSplitInput(1_000_000_000n, 0)).toMatch(/between/);
    expect(validateSplitInput(1_000_000_000n, 51)).toMatch(/between/);
    expect(validateSplitInput(1_000_000_000n, 50)).toBeNull();
  });
});

describe("conversions", () => {
  it("parses SOL strings without float error", () => {
    expect(solToLamports("0.1")).toBe(100_000_000n);
    expect(solToLamports("1.000000001")).toBe(1_000_000_001n);
    expect(solToLamports("abc")).toBe(0n);
  });

  it("converts fiat at a price", () => {
    expect(fiatToLamports(88, 880)).toBe(100_000_000n);
    expect(toMinor(88, "myr")).toBe(8800n);
    expect(toMinor(150000, "idr")).toBe(150000n);
    expect(formatFiat(88, "myr")).toBe("RM 88.00");
  });

  it("every preset greeting fits the 140-byte onchain limit", () => {
    for (const t of THEMES)
      for (const g of Object.values(t.greetings)) expect(byteLength(g)).toBeLessThanOrEqual(140);
  });
});
