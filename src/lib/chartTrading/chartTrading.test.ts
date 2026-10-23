import { describe, expect, it } from "vitest";
import { MockAdapter } from "./MockAdapter";
import { computeEma, computeRsi } from "./indicators";
import { generateMockCandles } from "./mockCandles";
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
