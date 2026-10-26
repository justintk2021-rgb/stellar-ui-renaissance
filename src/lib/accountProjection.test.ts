import { describe, expect, it } from "vitest";
import {
  computeGoalProgress,
  computeProjectionMetrics,
  deriveStartBalance,
  parseDepositFromAccountName,
  parseStartingBalance,
  resolveBrokerStartBalance,
} from "@/lib/accountProjection";

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

describe("parseDepositFromAccountName", () => {
  it("reads common funded sizes from the account title", () => {
    expect(parseDepositFromAccountName("FTMO 25K")).toBe(25000);
    expect(parseDepositFromAccountName("Challenge 50,000")).toBe(50000);
    expect(parseDepositFromAccountName("BRAND#abc123")).toBeNull();
  });
});

describe("resolveBrokerStartBalance", () => {
  it("uses the deposit amount instead of live minus trades", () => {
    expect(resolveBrokerStartBalance(25000, 26100, 1100)).toBe(25000);
    expect(resolveBrokerStartBalance(null, 26100, 1100)).toBe(25000);
  });
});

describe("computeGoalProgress", () => {
  it("measures the goal from the opening balance, not from zero", () => {
    expect(computeGoalProgress(25000, 25000, 50000)).toBe(0);
    expect(computeGoalProgress(25000, 37500, 50000)).toBe(50);
    expect(computeGoalProgress(25000, 50000, 50000)).toBe(100);
  });
});

describe("computeProjectionMetrics", () => {
  it("uses opening size for profit and goal so a 25k account is not already halfway to 50k", () => {
    const metrics = computeProjectionMetrics({
      trades: [],
      startBalance: 25000,
      currentBalance: 25800,
      goalBalance: 50000,
      profitTarget: 5000,
    });
    expect(metrics.accountProfit).toBe(800);
    expect(metrics.goalProgress).toBe(3.2);
    expect(metrics.profitProgress).toBe(16);
    expect(metrics.remainingToGoal).toBe(24200);
  });
});
