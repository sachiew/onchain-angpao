import { describe, expect, it } from "vitest";
import type { Address } from "@solana/kit";
import { buildFeed, claimOf, countdown } from "../app/lib/feed";
import type { Angpao } from "../app/generated/angpao";

const addr = (n: number) => `Claimer${n}`.padEnd(32, "1") as Address;

function angpao(amounts: bigint[], claimed: number): Angpao {
  return {
    numPackets: amounts.length,
    claimedCount: claimed,
    amounts,
    claims: Array.from({ length: claimed }, (_, i) => ({ claimer: addr(i), ts: BigInt(1000 + i) })),
  } as unknown as Angpao;
}

describe("buildFeed", () => {
  it("is newest first and maps packet i to claimer i", () => {
    const f = buildFeed(angpao([5n, 9n, 1n], 2));
    expect(f.map((e) => e.index)).toEqual([1, 0]);
    expect(f[0].amount).toBe(9n);
    expect(f.every((e) => !e.luckiest)).toBe(true); // no crown until sold out
  });

  it("crowns the largest packet once sold out, earliest wins ties", () => {
    const f = buildFeed(angpao([3n, 9n, 9n, 1n], 4));
    expect(f.filter((e) => e.luckiest).map((e) => e.index)).toEqual([1]);
  });

  it("finds a wallet's own claim", () => {
    const a = angpao([5n, 9n, 1n], 3);
    expect(claimOf(a, addr(2))?.amount).toBe(1n);
    expect(claimOf(a, addr(7))).toBeNull();
  });
});

describe("countdown", () => {
  it("formats", () => {
    expect(countdown(0)).toBe("Expired");
    expect(countdown(65)).toBe("1m 05s");
    expect(countdown(3 * 3600 + 120)).toBe("3h 2m");
    expect(countdown(2 * 86400 + 3600)).toBe("2d 1h");
  });
});
