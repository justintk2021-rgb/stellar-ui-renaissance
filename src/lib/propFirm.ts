import type { Trade } from "@/types/trade";
import {
  dedupeTradesForPnL,
  formatLocalDateKey,
  getTradeCloseLocalDateKey,
  getTradeNetResult,
} from "@/lib/tradeFormat";

export type DrawdownMode = "static" | "trailing";

export interface PropFirmRules {
  profitTargetPct: number;
  dailyLossPct: number;
  maxDrawdownPct: number;
  drawdownMode: DrawdownMode;
}

export type PropFirmStanding = "on-track" | "at-risk" | "passed" | "breached";

export interface PropFirmEvaluation {
  profitTarget: number;
  accountProfit: number;
  profitProgress: number;
  profitRemaining: number;
  dailyLossLimit: number;
  todayPnL: number;
  /** Share of the daily loss limit already used. 0 on a green day. */
  dailyLossUsedPct: number;
  dailyBreached: boolean;
  maxDrawdownLimit: number;
  currentDrawdown: number;
  peakBalance: number;
  drawdownUsedPct: number;
  drawdownBreached: boolean;
  standing: PropFirmStanding;
}

export const DEFAULT_PROP_FIRM_RULES: PropFirmRules = {
  profitTargetPct: 10,
  dailyLossPct: 5,
  maxDrawdownPct: 10,
  drawdownMode: "static",
};

/** Starting templates. The user can edit every number; these are not a firm's live rulebook. */
export const PROP_FIRM_PRESETS: { id: string; label: string; rules: PropFirmRules }[] = [
  { id: "two-step", label: "2-step", rules: { profitTargetPct: 10, dailyLossPct: 5, maxDrawdownPct: 10, drawdownMode: "static" } },
  { id: "one-step", label: "1-step", rules: { profitTargetPct: 10, dailyLossPct: 3, maxDrawdownPct: 6, drawdownMode: "trailing" } },
  { id: "conservative", label: "Conservative", rules: { profitTargetPct: 8, dailyLossPct: 4, maxDrawdownPct: 8, drawdownMode: "static" } },
];

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function sortKey(trade: Trade): string {
  return trade.closeTime || trade.openTime || trade.date || "";
}

/**
 * Challenge progress against the selected account.
 * Profit and drawdown use the account's start and current balance.
 * Today's P&L prefers a broker day total when one is passed in.
 */
export function evaluatePropFirm(input: {
  trades: readonly Trade[];
  startBalance: number;
  currentBalance: number;
  rules: PropFirmRules;
  todayKey?: string;
  todayPnL?: number | null;
}): PropFirmEvaluation {
  const start = Number.isFinite(input.startBalance) ? input.startBalance : 0;
  const current = Number.isFinite(input.currentBalance) ? input.currentBalance : start;
  const profitTargetPct = clampPct(input.rules.profitTargetPct);
  const dailyLossPct = clampPct(input.rules.dailyLossPct);
  const maxDrawdownPct = clampPct(input.rules.maxDrawdownPct);

  const profitTarget = start * (profitTargetPct / 100);
  const accountProfit = current - start;
  const profitProgress = profitTarget > 0 ? (Math.max(0, accountProfit) / profitTarget) * 100 : 0;
  const profitRemaining = Math.max(0, profitTarget - Math.max(0, accountProfit));

  const todayKey = input.todayKey ?? formatLocalDateKey(new Date());
  const deduped = dedupeTradesForPnL(input.trades);
  const journalToday = deduped.reduce((sum, trade) => {
    if (getTradeCloseLocalDateKey(trade) !== todayKey) return sum;
    return sum + getTradeNetResult(trade);
  }, 0);
  const todayPnL = input.todayPnL != null && Number.isFinite(input.todayPnL) ? input.todayPnL : journalToday;

  const dailyLossLimit = start * (dailyLossPct / 100);
  const dailyLossUsed = todayPnL < 0 ? Math.abs(todayPnL) : 0;
  const dailyLossUsedPct = dailyLossLimit > 0 ? (dailyLossUsed / dailyLossLimit) * 100 : 0;
  const dailyBreached = dailyLossLimit > 0 && dailyLossUsed >= dailyLossLimit;

  let peak = start;
  let equity = start;
  const ordered = [...deduped].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  for (const trade of ordered) {
    equity += getTradeNetResult(trade);
    if (equity > peak) peak = equity;
  }
  if (current > peak) peak = current;

  const currentDrawdown = input.rules.drawdownMode === "trailing"
    ? Math.max(0, peak - current)
    : Math.max(0, start - current);
  const maxDrawdownLimit = start * (maxDrawdownPct / 100);
  const drawdownUsedPct = maxDrawdownLimit > 0 ? (currentDrawdown / maxDrawdownLimit) * 100 : 0;
  const drawdownBreached = maxDrawdownLimit > 0 && currentDrawdown >= maxDrawdownLimit;

  const targetHit = profitTarget > 0 && accountProfit >= profitTarget;
  let standing: PropFirmStanding = "on-track";
  if (dailyBreached || drawdownBreached) standing = "breached";
  else if (targetHit) standing = "passed";
  else if (dailyLossUsedPct >= 70 || drawdownUsedPct >= 70) standing = "at-risk";

  return {
    profitTarget,
    accountProfit,
    profitProgress,
    profitRemaining,
    dailyLossLimit,
    todayPnL,
    dailyLossUsedPct,
    dailyBreached,
    maxDrawdownLimit,
    currentDrawdown,
    peakBalance: peak,
    drawdownUsedPct,
    drawdownBreached,
    standing,
  };
}
