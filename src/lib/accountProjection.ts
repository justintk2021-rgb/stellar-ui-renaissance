import { Trade } from '@/types/trade';
import { dedupeTradesForPnL, getTradeCloseLocalDateKey, getTradeNetResult, sumPnL } from '@/lib/tradeFormat';

export interface ProjectionMetricsInput {
  trades: Trade[];
  startBalance: number;
  currentBalance: number;
  goalBalance: number | null;
  profitTarget: number | null;
  /** When set (broker history), pace uses these day totals instead of journal trades. */
  dailyPnL?: Map<string, number> | null;
}

export interface ProjectionMetrics {
  netPnL: number;
  /** Realized profit from balance change (currentBalance - startBalance) — works for broker + manual */
  accountProfit: number;
  goalProgress: number;
  profitProgress: number;
  remainingToGoal: number | null;
  remainingProfit: number | null;
  goalReached: boolean;
  profitTargetHit: boolean;
  avgDailyPnL: number | null;
  estimatedDaysToGoal: number | null;
  tradingDays: number;
}

export function computeNetPnL(trades: Trade[]): number {
  return sumPnL(trades);
}

export function computeAvgDailyPnLFromMap(
  byDay: Map<string, number>,
): { avgDailyPnL: number | null; tradingDays: number } {
  const tradingDays = byDay.size;
  if (tradingDays === 0) return { avgDailyPnL: null, tradingDays: 0 };
  const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0);
  return { avgDailyPnL: total / tradingDays, tradingDays };
}

export function computeAvgDailyPnL(trades: Trade[]): { avgDailyPnL: number | null; tradingDays: number } {
  const byDay = new Map<string, number>();
  for (const trade of dedupeTradesForPnL(trades)) {
    const key = getTradeCloseLocalDateKey(trade);
    if (!key) continue;
    byDay.set(key, (byDay.get(key) || 0) + getTradeNetResult(trade));
  }
  return computeAvgDailyPnLFromMap(byDay);
}

/** Progress from opening size to the goal. A $25k account aiming at $50k starts at 0%, not 50%. */
export function computeGoalProgress(
  startBalance: number,
  currentBalance: number,
  goalBalance: number,
): number {
  const span = goalBalance - startBalance;
  if (!(span > 0)) return currentBalance >= goalBalance ? 100 : 0;
  return Math.min(100, Math.max(0, ((currentBalance - startBalance) / span) * 100));
}

export function computeProjectionMetrics(input: ProjectionMetricsInput): ProjectionMetrics {
  const netPnL = computeNetPnL(input.trades);
  const { avgDailyPnL, tradingDays } = input.dailyPnL
    ? computeAvgDailyPnLFromMap(input.dailyPnL)
    : computeAvgDailyPnL(input.trades);

  // Account-level profit derived from balance change so broker and manual stay in sync
  const accountProfit = input.currentBalance - input.startBalance;

  const goalBalance = input.goalBalance && input.goalBalance > 0 ? input.goalBalance : null;
  const profitTarget = input.profitTarget && input.profitTarget > 0 ? input.profitTarget : null;

  const goalProgress = goalBalance
    ? computeGoalProgress(input.startBalance, input.currentBalance, goalBalance)
    : 0;

  const profitProgress = profitTarget
    ? Math.min(100, Math.max(0, (Math.max(0, accountProfit) / profitTarget) * 100))
    : 0;

  const remainingToGoal = goalBalance != null ? Math.max(0, goalBalance - input.currentBalance) : null;
  const remainingProfit = profitTarget != null ? Math.max(0, profitTarget - Math.max(0, accountProfit)) : null;

  let estimatedDaysToGoal: number | null = null;
  if (remainingToGoal != null && remainingToGoal > 0 && avgDailyPnL != null && avgDailyPnL > 0) {
    estimatedDaysToGoal = Math.ceil(remainingToGoal / avgDailyPnL);
  }

  return {
    netPnL,
    accountProfit,
    goalProgress,
    profitProgress,
    remainingToGoal,
    remainingProfit,
    goalReached: goalBalance != null && input.currentBalance >= goalBalance,
    profitTargetHit: profitTarget != null && accountProfit >= profitTarget,
    avgDailyPnL,
    estimatedDaysToGoal,
    tradingDays,
  };
}

/** Parse a starting-balance field. Empty or invalid input is not replaced with a default. */
export function parseStartingBalance(raw: string): number | null {
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const COMMON_FUNDED_SIZES = new Set([
  5000, 10000, 15000, 25000, 50000, 100000, 150000, 200000, 250000, 300000, 500000,
]);

/** Read a funded size from an account name like "25K Challenge" or "FTMO 50,000". */
export function parseDepositFromAccountName(name: string | null | undefined): number | null {
  if (!name) return null;
  const k = name.match(/(?:^|[^\d])(\d{1,3})\s*[kK](?:[^\d]|$)/);
  if (k) {
    const value = Number(k[1]) * 1000;
    if (COMMON_FUNDED_SIZES.has(value)) return value;
  }
  const full = name.match(/(\d{1,3}(?:,\d{3})+|\d{4,7})/);
  if (full) {
    const value = Number(full[1].replace(/,/g, ""));
    if (COMMON_FUNDED_SIZES.has(value)) return value;
  }
  return null;
}

export function extractDepositFromBrokerPayload(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const keys = [
    "deposit",
    "depositBalance",
    "deposit_balance",
    "initialDeposit",
    "initial_deposit",
    "initialBalance",
    "initial_balance",
    "startingBalance",
    "starting_balance",
    "accountSize",
    "account_size",
    "fundedAmount",
    "funded_amount",
  ];
  for (const key of keys) {
    const found = extractDepositFromBrokerPayload(rec[key]);
    if (found != null) return found;
  }
  return null;
}

/** Broker start prefers the funded/deposit amount. Otherwise live minus closed P&L. */
export function resolveBrokerStartBalance(
  depositBalance: number | null | undefined,
  liveBalance: number | null,
  realizedPnL: number,
): number {
  if (depositBalance != null && Number.isFinite(depositBalance) && depositBalance > 0) {
    return depositBalance;
  }
  return deriveStartBalance(null, liveBalance, realizedPnL);
}

/**
 * Resolve the account's starting balance — the size before any trades.
 * A $25,000 broker account stays $25,000 (deposit, or live minus closed P&L).
 * Manual accounts use the value the user saved. Never substitutes $10,000.
 */
export function deriveStartBalance(
  storedStart: number | null | undefined,
  liveBalance: number | null,
  netPnL: number,
): number {
  if (storedStart != null && Number.isFinite(storedStart) && storedStart >= 0) {
    return storedStart;
  }
  if (liveBalance != null && Number.isFinite(liveBalance)) {
    return liveBalance - netPnL;
  }
  return 0;
}
