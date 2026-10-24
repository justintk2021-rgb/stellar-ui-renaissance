import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_INSTRUMENTS,
  mergeChartInstruments,
  normalizeChartSymbol,
  toTradingViewInterval,
  toTradingViewSymbol,
} from "./tradingViewSymbols";

describe("TradingView symbol mapping", () => {
  it("maps core symbols onto real-time OANDA / BITSTAMP feeds", () => {
    expect(toTradingViewSymbol("EURUSD")).toBe("OANDA:EURUSD");
    expect(toTradingViewSymbol("eur/usd")).toBe("OANDA:EURUSD");
    expect(toTradingViewSymbol("XAUUSD")).toBe("OANDA:XAUUSD");
    expect(toTradingViewSymbol("NAS100")).toBe("OANDA:NAS100USD");
    expect(toTradingViewSymbol("US30")).toBe("OANDA:US30USD");
    expect(toTradingViewSymbol("BTCUSD")).toBe("BITSTAMP:BTCUSD");
  });

  it("resolves broker aliases and USDT crypto onto live venues", () => {
    expect(toTradingViewSymbol("NAS100.cash")).toBe("OANDA:NAS100USD");
    expect(toTradingViewSymbol("USTEC")).toBe("OANDA:NAS100USD");
    expect(toTradingViewSymbol("GOLD")).toBe("OANDA:XAUUSD");
    expect(toTradingViewSymbol("BTCUSDT")).toBe("BINANCE:BTCUSDT");
    expect(toTradingViewSymbol("ETHUSD")).toBe("BITSTAMP:ETHUSD");
  });

  it("maps our timeframe buttons to TradingView intervals", () => {
    expect(toTradingViewInterval("1m")).toBe("1");
    expect(toTradingViewInterval("5m")).toBe("5");
    expect(toTradingViewInterval("15m")).toBe("15");
    expect(toTradingViewInterval("1H")).toBe("60");
    expect(toTradingViewInterval("4H")).toBe("240");
    expect(toTradingViewInterval("1D")).toBe("D");
  });

  it("keeps a default instrument list so the chart works without a broker", () => {
    expect(DEFAULT_CHART_INSTRUMENTS.some((item) => item.symbol === "EURUSD")).toBe(true);
    expect(mergeChartInstruments([])).toEqual(DEFAULT_CHART_INSTRUMENTS);
    expect(normalizeChartSymbol("eur/usd+")).toBe("EURUSD");
    expect(mergeChartInstruments([{ symbol: "EURUSD", name: "EUR/USD", precision: 5, minMove: 0.00001 }])).toHaveLength(1);
  });
});
