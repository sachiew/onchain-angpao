import { describe, expect, it } from "vitest";
import { FIAT_CODES, FIATS, fiatCodeBytes, fiatCodeFromBytes, formatFiat, fromMinor, isFiatCode, toMinor } from "../app/lib/fiat";

describe("fiat", () => {
  it("every code fits the 3-byte onchain field and round-trips", () => {
    for (const c of FIAT_CODES) {
      expect(c).toMatch(/^[a-z]{3}$/);
      expect(fiatCodeFromBytes(fiatCodeBytes(c))).toBe(c);
    }
  });
  it("only accepts listed codes (no prototype keys)", () => {
    expect(isFiatCode("usd")).toBe(true);
    expect(isFiatCode("xyz")).toBe(false);
    expect(isFiatCode("constructor")).toBe(false);
  });
  it("formats with a space only after letter symbols", () => {
    expect(formatFiat(88, "usd")).toBe("$88.00");
    expect(formatFiat(88, "myr")).toBe("RM 88.00");
    expect(formatFiat(1234.5, "jpy")).toBe("¥1,235");
    expect(FIATS.idr.decimals).toBe(0);
  });
  it("minor units respect decimals", () => {
    expect(toMinor(88, "usd")).toBe(8800n);
    expect(toMinor(1500, "krw")).toBe(1500n);
    expect(fromMinor(8800n, "myr")).toBe(88);
  });
});
