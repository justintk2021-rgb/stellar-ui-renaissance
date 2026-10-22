import { describe, expect, it } from "vitest";
import type { Trade } from "@/types/trade";
import { evaluatePropFirm } from "./propFirm";

function trade(partial: Partial<Trade> & Pick<Trade, "id" | "result">): Trade {
  return {
    date: "2026-10-22",
    pair: "EURUSD",
    direction: "Long",
    ...partial,
  };
}

const rules = {
  profitTargetPct: 10,
  dailyLossPct: 5,
  maxDrawdownPct: 10,
  drawdownMode: "static" as const,
};

describe("evaluatePropFirm", () => {
  it("measures profit progress against the starting balance", () => {
    const result = evaluatePropFirm({
      trades: [],
      startBalance: 10_000,
      currentBalance: 10_500,
      rules,
      todayKey: "2026-10-22",
    });
    expect(result.profitTarget).toBe(1000);
    expect(result.accountProfit).toBe(500);
    expect(result.profitProgress).toBe(50);
    expect(result.profitRemaining).toBe(500);
    expect(result.standing).toBe("on-track");
  });

  it("marks a daily loss limit breach from today's closes", () => {
    const result = evaluatePropFirm({
      trades: [trade({ id: "a", result: -600, date: "2026-10-22" })],
      startBalance: 10_000,
      currentBalance: 9_400,
      rules,
      todayKey: "2026-10-22",
    });
    expect(result.dailyLossLimit).toBe(500);
    expect(result.todayPnL).toBe(-600);
    expect(result.dailyBreached).toBe(true);
    expect(result.standing).toBe("breached");
  });

  it("prefers a broker day total over the journal sum", () => {
    const result = evaluatePropFirm({
      trades: [trade({ id: "a", result: -600, date: "2026-10-22" })],
      startBalance: 10_000,
      currentBalance: 9_900,
      rules,
      todayKey: "2026-10-22",
      todayPnL: -100,
    });
    expect(result.todayPnL).toBe(-100);
    expect(result.dailyBreached).toBe(false);
  });

  it("uses a trailing peak for drawdown when that mode is selected", () => {
    const result = evaluatePropFirm({
      trades: [
        trade({ id: "win", result: 2000, date: "2026-10-20" }),
        trade({ id: "giveback", result: -800, date: "2026-10-21" }),
      ],
      startBalance: 10_000,
      currentBalance: 11_200,
      rules: { ...rules, drawdownMode: "trailing", maxDrawdownPct: 5 },
      todayKey: "2026-10-22",
    });
    expect(result.peakBalance).toBe(12_000);
    expect(result.currentDrawdown).toBe(800);
    expect(result.maxDrawdownLimit).toBe(500);
    expect(result.drawdownBreached).toBe(true);
  });

  it("passes once the profit target is hit and the limits hold", () => {
    const result = evaluatePropFirm({
      trades: [],
      startBalance: 10_000,
      currentBalance: 11_200,
      rules,
      todayKey: "2026-10-22",
      todayPnL: 50,
    });
    expect(result.standing).toBe("passed");
  });

  it("does not divide by zero when the account has no starting balance", () => {
    const result = evaluatePropFirm({
      trades: [trade({ id: "a", result: -20 })],
      startBalance: 0,
      currentBalance: 0,
      rules,
      todayKey: "2026-10-22",
    });
    expect(result.profitProgress).toBe(0);
    expect(result.dailyBreached).toBe(false);
    expect(result.drawdownBreached).toBe(false);
    expect(result.standing).toBe("on-track");
  });
});
