import { describe, expect, it, vi } from "vitest";

vi.mock("./marketClient", () => ({
  invokeTradeLockerMarket: vi.fn(() => {
    throw new Error("TradeLocker market should not be called for candles or quotes");
  }),
}));

import { TradeLockerAdapter } from "./TradeLockerAdapter";

describe("TradeLockerAdapter market surface", () => {
  it("does not fetch candles or quotes", async () => {
    const adapter = new TradeLockerAdapter({
      id: "tl-1",
      label: "TradeLocker - Demo",
      platform: "tradelocker",
      environment: "demo",
      accountNumber: "1",
      brokerName: "TradeLocker",
      connectionId: "conn-1",
      accountId: "a1",
      accNum: 1,
    });

    await expect(adapter.getCandles("EURUSD", "15m")).resolves.toEqual([]);
    await expect(adapter.loadMoreCandles("EURUSD", "15m", Date.now())).resolves.toEqual([]);
    expect(typeof adapter.subscribePrice("EURUSD", () => undefined)).toBe("function");
    adapter.destroy();
  });
});
