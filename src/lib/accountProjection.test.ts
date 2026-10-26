import { describe, expect, it } from "vitest";
import { deriveStartBalance, parseStartingBalance } from "@/lib/accountProjection";

describe("parseStartingBalance", () => {
  it("returns the number the user typed, including zero", () => {
    expect(parseStartingBalance("25000")).toBe(25000);
    expect(parseStartingBalance("0")).toBe(0);
    expect(parseStartingBalance(" 5000.50 ")).toBe(5000.5);
  });

  it("does not invent a 10000 default for empty or invalid input", () => {
    expect(parseStartingBalance("")).toBeNull();
    expect(parseStartingBalance("abc")).toBeNull();
    expect(parseStartingBalance("-1")).toBeNull();
  });
});

describe("deriveStartBalance", () => {
  it("uses the stored starting balance the user set", () => {
    expect(deriveStartBalance(25000, 27000, 2000)).toBe(25000);
    expect(deriveStartBalance(0, null, 0)).toBe(0);
  });

  it("a 25000 broker account starts at 25000 even after trades", () => {
    expect(deriveStartBalance(null, 25000, 0)).toBe(25000);
    expect(deriveStartBalance(null, 25800, 800)).toBe(25000);
    expect(deriveStartBalance(null, 24100, -900)).toBe(25000);
  });

  it("does not fall back to 10000 when nothing is known yet", () => {
    expect(deriveStartBalance(null, null, 0)).toBe(0);
    expect(deriveStartBalance(undefined, null, 150)).toBe(0);
  });
});
