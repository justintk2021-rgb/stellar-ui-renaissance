import { describe, expect, it } from "vitest";
import { fallbackLetters, normalizeSymbol, resolveAssetIcon } from "@/lib/assetIcons";

describe("normalizeSymbol", () => {
  it("strips broker prefixes, suffixes and separators", () => {
    expect(normalizeSymbol("OANDA:EURUSD")).toBe("EURUSD");
    expect(normalizeSymbol("EURUSD.m")).toBe("EURUSD");
    expect(normalizeSymbol("EURUSDm")).toBe("EURUSD");
    expect(normalizeSymbol("XAUUSD+")).toBe("XAUUSD");
    expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
    expect(normalizeSymbol("  gbpusd ")).toBe("GBPUSD");
    expect(normalizeSymbol("NAS100.cash")).toBe("NAS100");
  });
});

describe("resolveAssetIcon", () => {
  it("treats forex majors and exotics as overlapping currency flags", () => {
    expect(resolveAssetIcon("EURUSD").kind).toBe("pair");
    expect(resolveAssetIcon("USDJPY").kind).toBe("pair");
    expect(resolveAssetIcon("GBPAUD").kind).toBe("pair");
    expect(resolveAssetIcon("USDZAR").kind).toBe("pair");
    expect(resolveAssetIcon("EURUSDm").kind).toBe("pair");
  });

  it("uses metal/energy badges, with a quote flag when present", () => {
    expect(resolveAssetIcon("XAUUSD").kind).toBe("pair");
    expect(resolveAssetIcon("XAGUSD").kind).toBe("pair");
    expect(resolveAssetIcon("USOIL").kind).toBe("badge");
    expect(resolveAssetIcon("NATGAS").kind).toBe("badge");
  });

  it("maps common indices to a country flag badge", () => {
    expect(resolveAssetIcon("US30").kind).toBe("badge");
    expect(resolveAssetIcon("NAS100").kind).toBe("badge");
    expect(resolveAssetIcon("GER40").kind).toBe("badge");
    expect(resolveAssetIcon("JP225").kind).toBe("badge");
  });

  it("pairs crypto with the quote flag", () => {
    expect(resolveAssetIcon("BTCUSD").kind).toBe("pair");
    expect(resolveAssetIcon("ETHUSDT").kind).toBe("pair");
    expect(resolveAssetIcon("BTC").kind).toBe("badge");
  });

  it("treats equity tickers as stocks and unknowns as letters", () => {
    expect(resolveAssetIcon("AAPL").kind).toBe("stock");
    expect(resolveAssetIcon("TSLA").kind).toBe("stock");
    expect(resolveAssetIcon("???").kind).toBe("unknown");
    expect(fallbackLetters("EURUSD")).toBe("EU");
  });
});
