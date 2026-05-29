import { Trade } from "@/types/trade";
import type { TradingAccount } from "@/hooks/useTradingAccounts";
import { computePeriodStats } from "@/lib/compareMetrics";
import { getTradeLocalDateKey } from "@/lib/tradeFormat";

export interface AssistantUserContext {
  user: {
    firstName?: string | null;
    email?: string | null;
  };
  ui: {
    currentPage: string;
    pageDescription: string;
    inCompareMode: boolean;
    journalFilter?: string;
    selectedAccountName?: string | null;
    brokerAccountActive: boolean;
    brokerBalance?: number | null;
    brokerEquity?: number | null;
    brokerFloatingPl?: number;
    hasOpenPositions?: boolean;
  };
  trading: {
    totalTrades: number;
    winRate: string;
    totalPnL: string;
    avgWin: string;
    avgLoss: string;
    profitFactor: string;
    topPairs: string;
    topSessions: string;
    recentTrades: string;
    thisMonthTrades: number;
    thisMonthPnL: string;
    thisMonthWinRate: string;
    bestDay?: string;
    worstDay?: string;
  } | null;
  app: {
    manualAccounts: number;
    notebookEntries: number;
    checklists: number;
    theme?: string;
  };
}

interface BuildContextInput {
  trades: Trade[];
  currentPage: string;
  pageDescription: string;
  compareOpen?: boolean;
  journalFilter?: string;
  selectedAccount?: TradingAccount | null;
  brokerAccountActive?: boolean;
  brokerBalance?: number | null;
  brokerEquity?: number | null;
  brokerFloatingPl?: number;
  hasOpenPositions?: boolean;
  userProfile?: { first_name?: string | null; email?: string | null } | null;
  accountsCount?: number;
  notebookEntriesCount?: number;
  checklistsCount?: number;
  theme?: string;
}

function tradesThisMonth(trades: Trade[]): Trade[] {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return trades.filter((t) => getTradeLocalDateKey(t).startsWith(prefix));
}

function dayOfWeekPnL(trades: Trade[]): { best?: string; worst?: string } {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets = new Map<number, number>();
  trades.forEach((t) => {
    const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
    if (isNaN(d.getTime())) return;
    const dow = d.getDay();
    buckets.set(dow, (buckets.get(dow) || 0) + (t.result || 0));
  });
  if (!buckets.size) return {};
  let bestDow = 0;
  let worstDow = 0;
  let bestPnl = -Infinity;
  let worstPnl = Infinity;
  buckets.forEach((pnl, dow) => {
    if (pnl > bestPnl) { bestPnl = pnl; bestDow = dow; }
    if (pnl < worstPnl) { worstPnl = pnl; worstDow = dow; }
  });
  return { best: days[bestDow], worst: days[worstDow] };
}

export function buildAssistantContext(input: BuildContextInput): AssistantUserContext {
  const {
    trades,
    currentPage,
    pageDescription,
    compareOpen = false,
    journalFilter,
    selectedAccount,
    brokerAccountActive = false,
    brokerBalance,
    brokerEquity,
    brokerFloatingPl,
    hasOpenPositions,
    userProfile,
    accountsCount = 0,
    notebookEntriesCount = 0,
    checklistsCount = 0,
    theme,
  } = input;

  let trading: AssistantUserContext["trading"] = null;

  if (trades.length > 0) {
    const stats = computePeriodStats(trades);
    const monthTrades = tradesThisMonth(trades);
    const monthStats = monthTrades.length ? computePeriodStats(monthTrades) : null;
    const { best, worst } = dayOfWeekPnL(trades);

    const pairCounts: Record<string, number> = {};
    const sessionCounts: Record<string, number> = {};
    trades.forEach((t) => {
      pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1;
      if (t.session) sessionCounts[t.session] = (sessionCounts[t.session] || 0) + 1;
    });

    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p, c]) => `${p} (${c})`)
      .join(", ") || "None";

    const topSessions = Object.entries(sessionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s)
      .join(", ") || "None";

    const recentTrades = [...trades]
      .sort((a, b) => getTradeLocalDateKey(b).localeCompare(getTradeLocalDateKey(a)))
      .slice(0, 8)
      .map((t) => `${t.date}: ${t.pair} ${t.direction} $${t.result > 0 ? "+" : ""}${t.result.toFixed(2)}`)
      .join("; ");

    trading = {
      totalTrades: stats.totalTrades,
      winRate: (stats.winRate * 100).toFixed(1),
      totalPnL: stats.netPnL.toFixed(2),
      avgWin: stats.avgWin.toFixed(2),
      avgLoss: stats.avgLoss.toFixed(2),
      profitFactor: Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞",
      topPairs,
      topSessions,
      recentTrades: recentTrades || "None",
      thisMonthTrades: monthTrades.length,
      thisMonthPnL: monthStats ? monthStats.netPnL.toFixed(2) : "0.00",
      thisMonthWinRate: monthStats ? (monthStats.winRate * 100).toFixed(1) : "0",
      bestDay: best,
      worstDay: worst,
    };
  }

  return {
    user: {
      firstName: userProfile?.first_name,
      email: userProfile?.email,
    },
    ui: {
      currentPage,
      pageDescription,
      inCompareMode: compareOpen,
      journalFilter,
      selectedAccountName: selectedAccount?.name ?? null,
      brokerAccountActive,
      brokerBalance,
      brokerEquity,
      brokerFloatingPl,
      hasOpenPositions,
    },
    trading,
    app: {
      manualAccounts: accountsCount,
      notebookEntries: notebookEntriesCount,
      checklists: checklistsCount,
      theme,
    },
  };
}
