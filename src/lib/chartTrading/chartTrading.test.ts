import { describe, expect, it } from "vitest";
import { MockAdapter } from "./MockAdapter";
import { UnavailableAdapter } from "./UnavailableAdapter";
import { mapConnectedAccounts } from "./accountMap";
import { computeEma, computeRsi } from "./indicators";
import { generateMockCandles } from "./mockCandles";
import {
  alignBarTimeUtc,
  applyQuoteToCandle,
  classifyMarketError,
  mapHistoryBars,
} from "./tradeLockerMap";
import { positionPnl, type ChartBrokerAccount } from "./types";

const account: ChartBrokerAccount = {
  id: "mock-tl-live-12345",
  label: "TradeLocker - Live 12345",
  platform: "tradelocker",
  environment: "live",
  accountNumber: "12345",
  brokerName: "TradeLocker",
};

describe("chart trading mock", () => {
  it("generates contiguous OHLC candles", () => {
    const candles = generateMockCandles("EURUSD", "15m", 80, "test");
    expect(candles).toHaveLength(80);
    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.volume).toBeGreaterThan(0);
    }
    expect(candles[1].time - candles[0].time).toBe(900);
  });

  it("computes EMA and RSI via technicalindicators", () => {
    const candles = generateMockCandles("XAUUSD", "1H", 120, "ind");
    const ema20 = computeEma(candles, 20);
    const rsi14 = computeRsi(candles, 14);
    expect(ema20.length).toBeGreaterThan(80);
    expect(rsi14.length).toBeGreaterThan(80);
    expect(rsi14.every((p) => p.value >= 0 && p.value <= 100)).toBe(true);
  });

  it("places and closes mock positions through BrokerAdapter", async () => {
    const adapter = new MockAdapter(account);
    await adapter.getCandles("EURUSD", "15m");
    const before = await adapter.getPositions();
    const result = await adapter.placeOrder({
      symbol: "EURUSD",
      side: "buy",
      type: "market",
      lots: 0.2,
      stopLoss: 1.07,
      takeProfit: 1.1,
    });
    expect(result.position?.symbol).toBe("EURUSD");
    const open = await adapter.getPositions();
    expect(open.length).toBe(before.length + 1);
    const closed = await adapter.closePosition(result.position!.id);
    expect(closed?.pnl).toBe(positionPnl("buy", closed!.entryPrice, closed!.exitPrice, 0.2, "EURUSD"));
    adapter.destroy();
  });
});

describe("TradeLocker market mapping", () => {
  it("maps millisecond history bars onto UTC timeframe boundaries", () => {
    const bars = mapHistoryBars(
      [
        { t: Date.UTC(2026, 0, 2, 14, 7, 33), o: 1.1, h: 1.2, l: 1.0, c: 1.15, v: 10 },
        { t: Date.UTC(2026, 0, 2, 14, 15, 0) / 1000, o: 1.15, h: 1.16, l: 1.14, c: 1.15, v: 8 },
      ],
      "15m",
    );
    expect(bars).toHaveLength(2);
    expect(bars[0].time % 900).toBe(0);
    expect(bars[1].time - bars[0].time).toBe(900);
  });

  it("aligns daily bars to 00:00 UTC", () => {
    const noon = Math.floor(Date.UTC(2026, 5, 12, 12, 30, 0) / 1000);
    expect(alignBarTimeUtc(noon, "1D")).toBe(Math.floor(Date.UTC(2026, 5, 12) / 1000));
  });

  it("updates the current bar from a live quote and opens a new bar after the boundary", () => {
    const open = alignBarTimeUtc(1_700_000_000, "5m");
    const last = { time: open, open: 100, high: 101, low: 99, close: 100.5, volume: 4 };
    const sameBar = applyQuoteToCandle(last, { last: 102, time: open + 60 }, "5m");
    expect(sameBar.time).toBe(open);
    expect(sameBar.high).toBe(102);
    expect(sameBar.close).toBe(102);

    const next = applyQuoteToCandle(sameBar, { last: 101.5, time: open + 300 }, "5m");
    expect(next.time).toBe(open + 300);
    expect(next.open).toBe(102);
    expect(next.close).toBe(101.5);
  });

  it("classifies expired tokens and rate limits", () => {
    expect(classifyMarketError(401, { error: "expired" }).code).toBe("expired");
    expect(classifyMarketError(429, "too many requests").code).toBe("rate_limit");
    expect(classifyMarketError(409, { code: "market_closed", error: "Market is closed" }).code).toBe("market_closed");
  });
});

describe("chart accounts and adapters", () => {
  it("maps real connected broker accounts and never injects mocks", () => {
    const accounts = mapConnectedAccounts(
      [
        {
          id: "conn-1",
          platform: "tradelocker",
          broker_name: "TradeLocker",
          environment: "demo",
          connection_status: "connected",
          login: "trader@example.com",
        },
        {
          id: "conn-2",
          platform: "mt5",
          broker_name: "IC Markets",
          environment: "live",
          connection_status: "connected",
          login: "67890",
        },
      ],
      {
        "conn-1": [
          { id: "a1", account_id_external: "111", acc_num: 1, account_name: "Demo" },
        ],
        "conn-2": [
          { id: "a2", account_id_external: "67890", acc_num: 2, account_name: "Live" },
        ],
      },
    );

    expect(accounts).toHaveLength(2);
    expect(accounts.every((item) => item.connectionId)).toBe(true);
    expect(accounts.some((item) => /12345|67890 mock/i.test(item.label))).toBe(false);
    expect(accounts[0].platform).toBe("tradelocker");
    expect(accounts[1].platform).toBe("mt5");
    expect(new UnavailableAdapter(accounts[1]).supportsMarketData).toBe(false);
  });

  it("returns no accounts when nothing is connected", () => {
    expect(mapConnectedAccounts([], {})).toEqual([]);
  });
});
