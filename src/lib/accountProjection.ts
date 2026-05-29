import { Trade } from '@/types/trade';
import { getTradeLocalDateKey } from '@/lib/tradeFormat';

export interface ProjectionMetricsInput {
  trades: Trade[];
  startBalance: number;
  currentBalance: number;
  goalBalance: number | null;
  profitTarget: number | null;
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
  return trades.reduce((sum, t) => sum + (t.result || 0), 0);
}

export function computeAvgDailyPnL(trades: Trade[]): { avgDailyPnL: number | null; tradingDays: number } {
  const byDay = new Map<string, number>();
  for (const trade of trades) {
    const key = getTradeLocalDateKey(trade);
    if (!key) continue;
    byDay.set(key, (byDay.get(key) || 0) + (trade.result || 0));
  }
  const tradingDays = byDay.size;
  if (tradingDays === 0) return { avgDailyPnL: null, tradingDays: 0 };
  const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0);
  return { avgDailyPnL: total / tradingDays, tradingDays };
}

export function computeProjectionMetrics(input: ProjectionMetricsInput): ProjectionMetrics {
  const netPnL = computeNetPnL(input.trades);
  const { avgDailyPnL, tradingDays } = computeAvgDailyPnL(input.trades);

  // Account-level profit derived from balance change so broker and manual stay in sync
  const accountProfit = input.currentBalance - input.startBalance;

  const goalBalance = input.goalBalance && input.goalBalance > 0 ? input.goalBalance : null;
  const profitTarget = input.profitTarget && input.profitTarget > 0 ? input.profitTarget : null;

  const goalProgress = goalBalance
    ? Math.min(100, Math.max(0, (input.currentBalance / goalBalance) * 100))
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

export function deriveStartBalance(
  storedStart: number | null | undefined,
  liveBalance: number | null,
  netPnL: number,
  fallback = 10000,
): number {
  if (storedStart != null && storedStart > 0) return storedStart;
  if (liveBalance != null) return liveBalance - netPnL;
  return fallback;
}
