import { describe, expect, it } from "vitest";
import { createNoopSigner, generateKeyPairSigner, type Address } from "@solana/kit";
import { approvalsNeeded, buildCreateAngpaoIx, planCreateTransactions } from "../app/lib/angpao";
import { GateKind } from "../app/generated/angpao";

async function plan(packets: number, invitees: number, message = "恭喜发财，万事如意！🍊") {
  const creator = createNoopSigner("2x9naS8XSQV6fcYXDDEQ7MGYwN4Chex44CJXyFeVKMXQ" as Address);
  const list = await Promise.all(Array.from({ length: invitees }, async () => (await generateKeyPairSigner()).address));
  const { ix, angpao } = await buildCreateAngpaoIx({
    creator, id: 1n, mode: "lucky", theme: 0, message,
    amounts: Array.from({ length: packets }, () => 1_000_000n),
    expiryTs: 0n, fiat: "usd", fiatTotalMinor: 0n,
    gateKind: invitees ? GateKind.Allowlist : GateKind.None, allowlistCap: invitees,
  });
  return { p: planCreateTransactions(creator, angpao, ix, list), list };
}

describe("planCreateTransactions", () => {
  it("no invitees → just the create instruction", async () => {
    const { p } = await plan(8, 0);
    expect(p.first).toHaveLength(1);
    expect(approvalsNeeded(p)).toBe(1);
  });
  it("typical angpao packs the whole list into one approval", async () => {
    const { p } = await plan(8, 15);
    expect(p.first).toHaveLength(2);
    expect(p.rest).toEqual([]);
    expect(approvalsNeeded(p)).toBe(1);
  });
  it("big angpao spills the remainder into follow-up txs, in order", async () => {
    const { p, list } = await plan(50, 50, "x".repeat(140));
    expect(p.rest.length).toBeGreaterThan(0);
    expect(list.slice(list.length - p.rest.length)).toEqual(p.rest);
    expect(approvalsNeeded(p)).toBe(1 + Math.ceil(p.rest.length / 25));
  });
});
