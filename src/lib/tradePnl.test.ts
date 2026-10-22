import { afterEach, describe, expect, it } from "vitest";
import {
  FALLBACK_ACCOUNT_BALANCE,
  accountBalanceForRoi,
  aggregateTradeStats,
  dedupeTradesForPnL,
  netTradeResult,
  tradeRoiPercent,
  type PnlTrade,
} from "@/lib/tradePnl";
import {
  computeWinLossStats,
  getTradeNetResult,
  journalTradeStats,
  setBrokerPlByPositionCache,
  sumPnL,
} from "@/lib/tradeFormat";
import { bestAndWorst, buildEquityCurve, computePeriodStats } from "@/lib/compareMetrics";
import type { Trade } from "@/types/trade";

function pnl(partial: Partial<PnlTrade> & { id: string }): PnlTrade {
  return { result: 0, ...partial };
}

function asTrade(partial: Partial<Trade> & { id: string }): Trade {
  return {
    date: "2026-06-01",
    pair: "EURUSD",
    direction: "Long",
    result: 0,
    ...partial,
  };
}

afterEach(() => {
  setBrokerPlByPositionCache(null);
});

describe("netTradeResult", () => {
  it("uses the entered result for a manual trade with no fees", () => {
    expect(netTradeResult(pnl({ id: "m1", result: 42.5 }))).toBe(42.5);
    expect(netTradeResult(pnl({ id: "m2", result: -18 }))).toBe(-18);
  });

  it("applies manual swap and commission once", () => {
    const trade = pnl({ id: "m3", result: 100, swap: -2.5, commission: -1.25 });
    expect(netTradeResult(trade)).toBe(96.25);
  });

  it("does not stack fees on TradeLocker rows whose result is already net", () => {
    const trade = pnl({
      id: "tl1",
      importedFromBroker: true,
      brokerPositionId: "pos-1",
      result: 418,
      swap: -5,
      commission: -3,
    });
    expect(netTradeResult(trade)).toBe(418);
  });

  it("keeps MT5 net result when sync already folded fees in and zeroed the columns", () => {
    const trade = pnl({
      id: "mt1",
      importedFromBroker: true,
      brokerPositionId: "ticket-9",
      result: 97,
      swap: 0,
      commission: 0,
    });
    expect(netTradeResult(trade)).toBe(97);
  });

  it("prefers broker history realized P&L over a zero journal result", () => {
    const cache = new Map<string, number>([["pos-zero", 126.4]]);
    const trade = pnl({
      id: "tl-zero",
      importedFromBroker: true,
      brokerPositionId: "pos-zero",
      result: 0,
      swap: -1,
      commission: -1,
    });
    expect(netTradeResult(trade, { brokerPlByPosition: cache })).toBe(126.4);
  });

  it("treats a cached zero as breakeven and does not add fees", () => {
    const cache = new Map<string, number>([["pos-be", 0]]);
    const trade = pnl({
      id: "tl-be",
      importedFromBroker: true,
      brokerPositionId: "pos-be",
      result: 40,
      swap: -2,
      commission: -1,
    });
    expect(netTradeResult(trade, { brokerPlByPosition: cache })).toBe(0);
  });

  it("falls back to journal result when the position is missing from the cache", () => {
    const cache = new Map<string, number>([["other", 10]]);
    const trade = pnl({
      id: "tl-miss",
      importedFromBroker: true,
      brokerPositionId: "pos-miss",
      result: 15,
    });
    expect(netTradeResult(trade, { brokerPlByPosition: cache })).toBe(15);
  });

  it("treats missing, blank, and non-finite results as zero", () => {
    expect(netTradeResult(pnl({ id: "a", result: null }))).toBe(0);
    expect(netTradeResult(pnl({ id: "b", result: undefined }))).toBe(0);
    expect(netTradeResult(pnl({ id: "c", result: Number.NaN }))).toBe(0);
    expect(netTradeResult(pnl({ id: "d", result: Number("") as unknown as number }))).toBe(0);
  });

  it("uses journal result for an imported row that has no position id", () => {
    expect(
      netTradeResult(
        pnl({
          id: "orphan",
          importedFromBroker: true,
          brokerPositionId: null,
          result: 8,
          swap: -4,
        }),
      ),
    ).toBe(8);
  });
});

describe("dedupe and aggregate", () => {
  const duplicated = [
    pnl({
      id: "old",
      importedFromBroker: true,
      brokerPositionId: "pos-1",
      result: 100,
      lastBrokerSyncAt: "2026-06-01T00:00:00.000Z",
    }),
    pnl({
      id: "new",
      importedFromBroker: true,
      brokerPositionId: "pos-1",
      result: 80,
      lastBrokerSyncAt: "2026-06-02T00:00:00.000Z",
    }),
    pnl({ id: "manual", result: 20, swap: -5, commission: 0 }),
    pnl({ id: "scratch", result: 0 }),
    pnl({ id: "loss", result: -10 }),
  ];

  it("keeps the latest sync for a position and every manual row", () => {
    const ids = dedupeTradesForPnL(duplicated).map((t) => t.id);
    expect(ids).toEqual(["manual", "scratch", "loss", "new"]);
  });

  it("keeps the later row when sync timestamps tie", () => {
    const rows = dedupeTradesForPnL([
      pnl({
        id: "a",
        importedFromBroker: true,
        brokerPositionId: "same",
        result: 1,
        lastBrokerSyncAt: "2026-01-01T00:00:00.000Z",
      }),
      pnl({
        id: "b",
        importedFromBroker: true,
        brokerPositionId: "same",
        result: 2,
        lastBrokerSyncAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["b"]);
  });

  it("counts a duplicated broker position once and includes breakeven in win rate", () => {
    const stats = aggregateTradeStats(duplicated);
    expect(stats.netPnL).toBe(80 + 15 + 0 + -10);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakeven).toBe(1);
    expect(stats.total).toBe(4);
    expect(stats.winRate).toBe(50);
    expect(stats.feesApplied).toBe(-5);
    expect(stats.profitFactor).toBeCloseTo(95 / 10);
    expect(stats.avgWin).toBeCloseTo(95 / 2);
    expect(stats.avgLoss).toBe(10);
    expect(stats.expectancy).toBeCloseTo(stats.netPnL / 4);
  });

  it("returns zeros and a zero win rate for an empty set", () => {
    const stats = aggregateTradeStats([]);
    expect(stats).toMatchObject({
      netPnL: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      total: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      feesApplied: 0,
    });
  });

  it("reports an infinite profit factor when every trade wins", () => {
    const stats = aggregateTradeStats([
      pnl({ id: "w1", result: 10 }),
      pnl({ id: "w2", result: 5 }),
    ]);
    expect(stats.profitFactor).toBe(Infinity);
    expect(stats.winRate).toBe(100);
  });

  it("does not double-count broker history when the cache overrides both copies", () => {
    const cache = new Map<string, number>([["pos-1", 50]]);
    const stats = aggregateTradeStats(
      [
        pnl({
          id: "a",
          importedFromBroker: true,
          brokerPositionId: "pos-1",
          result: 0,
          lastBrokerSyncAt: "2026-01-01T00:00:00.000Z",
        }),
        pnl({
          id: "b",
          importedFromBroker: true,
          brokerPositionId: "pos-1",
          result: 0,
          lastBrokerSyncAt: "2026-01-02T00:00:00.000Z",
        }),
      ],
      { brokerPlByPosition: cache },
    );
    expect(stats.netPnL).toBe(50);
    expect(stats.total).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.feesApplied).toBe(0);
  });
});

describe("account balance for ROI", () => {
  it("uses a positive balance and falls back otherwise", () => {
    expect(accountBalanceForRoi(25000)).toBe(25000);
    expect(accountBalanceForRoi(0)).toBe(FALLBACK_ACCOUNT_BALANCE);
    expect(accountBalanceForRoi(-100)).toBe(FALLBACK_ACCOUNT_BALANCE);
    expect(accountBalanceForRoi(null)).toBe(FALLBACK_ACCOUNT_BALANCE);
    expect(accountBalanceForRoi(Number.NaN)).toBe(FALLBACK_ACCOUNT_BALANCE);
  });

  it("computes ROI against the account balance", () => {
    expect(tradeRoiPercent(250, 25000)).toBeCloseTo(1);
    expect(tradeRoiPercent(-100, null)).toBeCloseTo(-1);
  });
});

describe("cache-aware journal helpers stay on the same module", () => {
  it("getTradeNetResult, sumPnL, and journalTradeStats share the broker cache", () => {
    const trades = [
      asTrade({
        id: "tl",
        importedFromBroker: true,
        brokerPositionId: "pos-9",
        result: 0,
        swap: -4,
        commission: -1,
      }),
      asTrade({ id: "manual", result: 30, swap: -5, commission: -5 }),
    ];
    setBrokerPlByPositionCache(new Map([["pos-9", 12]]));

    expect(getTradeNetResult(trades[0])).toBe(12);
    expect(getTradeNetResult(trades[1])).toBe(20);
    expect(sumPnL(trades)).toBe(32);

    const stats = journalTradeStats(trades);
    const winLoss = computeWinLossStats(trades);
    expect(stats.netPnL).toBe(32);
    expect(stats.winRate).toBe(100);
    expect(winLoss).toMatchObject({ wins: 2, losses: 0, breakeven: 0, total: 2, winRate: 100 });
  });

  it("compare stats, equity curve, and best/worst use the same net and dedupe", () => {
    const trades = [
      asTrade({
        id: "old",
        importedFromBroker: true,
        brokerPositionId: "pos",
        result: 500,
        openTime: "2026-06-01T10:00:00.000Z",
        date: "2026-06-01",
        lastBrokerSyncAt: "2026-06-01T00:00:00.000Z",
      }),
      asTrade({
        id: "new",
        importedFromBroker: true,
        brokerPositionId: "pos",
        result: 40,
        openTime: "2026-06-01T10:00:00.000Z",
        date: "2026-06-01",
        lastBrokerSyncAt: "2026-06-02T00:00:00.000Z",
      }),
      asTrade({
        id: "loss",
        result: -10,
        openTime: "2026-06-02T10:00:00.000Z",
        date: "2026-06-02",
      }),
    ];
    setBrokerPlByPositionCache(new Map([["pos", 25]]));

    const period = computePeriodStats(trades);
    const stats = journalTradeStats(trades);
    expect(period.netPnL).toBe(stats.netPnL);
    expect(period.netPnL).toBe(15);
    expect(period.totalTrades).toBe(stats.total);
    expect(period.winRate).toBeCloseTo(stats.winRate / 100);
    expect(period.wins).toBe(1);
    expect(period.losses).toBe(1);

    const curve = buildEquityCurve(trades);
    expect(curve[curve.length - 1].cumulative).toBe(stats.netPnL);

    const extremes = bestAndWorst(trades);
    expect(extremes.best?.id).toBe("new");
    expect(extremes.worst?.id).toBe("loss");
    expect(getTradeNetResult(extremes.best!)).toBe(25);
  });
});
