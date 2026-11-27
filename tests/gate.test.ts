import { describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { bytesEqual, chunk, parseAllowlist, passphraseHash } from "../app/lib/gate";

const A = "2x9naS8XSQV6fcYXDDEQ7MGYwN4Chex44CJXyFeVKMXQ";
const B = "5FQBcEFGWbS9n3wD2nZWQJ9ig3MTafKSmJ1pR77whBis";

describe("parseAllowlist", () => {
  it("splits on whitespace, commas and semicolons, dedupes in order", () => {
    const r = parseAllowlist(`${A}\n${B}, ${A};\t${B}`);
    expect(r.addresses).toEqual([A, B]);
    expect(r.invalid).toEqual([]);
  });
  it("reports invalid tokens", () => {
    const r = parseAllowlist(`${A} not-an-address 0x1234`);
    expect(r.addresses).toEqual([A]);
    expect(r.invalid).toEqual(["not-an-address", "0x1234"]);
  });
  it("is empty for blank input", () => {
    expect(parseAllowlist("  \n ")).toEqual({ addresses: [], invalid: [] });
  });
});

describe("chunk", () => {
  it("splits into chunks of 25", () => {
    const xs = Array.from({ length: 50 }, (_, i) => i);
    expect(chunk(xs, 25).map((c) => c.length)).toEqual([25, 25]);
    expect(chunk(xs.slice(0, 26), 25).map((c) => c.length)).toEqual([25, 1]);
    expect(chunk([], 25)).toEqual([]);
  });
});

describe("passphraseHash", () => {
  it("normalises whitespace and is salted per angpao", async () => {
    const h1 = await passphraseHash(address(A), "huat-ah");
    expect(bytesEqual(h1, await passphraseHash(address(A), "  huat-ah \n"))).toBe(true);
    expect(bytesEqual(h1, await passphraseHash(address(B), "huat-ah"))).toBe(false);
    expect(bytesEqual(h1, await passphraseHash(address(A), "Huat-ah"))).toBe(false);
  });
});
