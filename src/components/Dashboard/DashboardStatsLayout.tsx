import { useMemo, lazy, Suspense } from "react";
import { Trade } from "@/types/trade";
import { TrendingUp, TrendingDown, DollarSign, Scale, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard } from "./StatCard";
import { PnLCalendar } from "./PnLCalendar";
import { WinRatioCard } from "./WinRatioCard";
import { NotebookEntry } from "@/types/trade";
import { useActiveBrokerConnectionId, useBrokerPositions, sumFloatingPl } from "@/hooks/useBrokerPositions";
import { dedupeTradesForPnL, getTradeNetResult, type BrokerTodayPnL } from "@/lib/tradeFormat";

// Lazy-load heavy widgets so the dashboard top section paints first.
const RecentTrades = lazy(() =>
  import("./RecentTrades").then((m) => ({ default: m.RecentTrades }))
);
const TradingIntelligenceMap = lazy(() =>
  import("./TradingIntelligenceMap").then((m) => ({ default: m.TradingIntelligenceMap }))
);

const WidgetFallback = ({ minHeight = 200 }: { minHeight?: number }) => (
  <div
    className="rounded-2xl bg-card/30 border border-border/30 animate-pulse"
    style={{ minHeight }}
  />
);

interface DashboardStatsLayoutProps {
  trades: Trade[];
  brokerTodayPnL?: BrokerTodayPnL | null;
  notebookEntries: NotebookEntry[];
  onUpdateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  onSaveEntry: (entry: NotebookEntry) => void;
  onAddTrade: (trade: Omit<Trade, "id">) => void;
}

export function DashboardStatsLayout({
  trades,
  brokerTodayPnL = null,
  notebookEntries,
  onUpdateTrade,
  onSaveEntry,
  onAddTrade,
}: DashboardStatsLayoutProps) {
  const activeBrokerConnId = useActiveBrokerConnectionId();
  const { positions: brokerPositions } = useBrokerPositions(activeBrokerConnId);

  const openPositions = useMemo(() => ({
    count: brokerPositions.length,
    floatingPl: sumFloatingPl(brokerPositions),
  }), [brokerPositions]);

  const pnlTrades = useMemo(() => dedupeTradesForPnL(trades), [trades]);

  const stats = pnlTrades.reduce(
    (acc, trade) => {
      const pl = getTradeNetResult(trade);
      acc.net += pl;
      if (pl > 0) {
        acc.wins++;
        acc.totalWinAmount += pl;
      } else if (pl < 0) {
        acc.losses++;
        acc.totalLossAmount += Math.abs(pl);
      }
      return acc;
    },
    { wins: 0, losses: 0, net: 0, totalWinAmount: 0, totalLossAmount: 0 }
  );

  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;
  const profitFactor =
    stats.totalLossAmount > 0
      ? stats.totalWinAmount / stats.totalLossAmount
      : stats.totalWinAmount > 0
      ? Infinity
      : 0;

  const leftCards = [
    {
      label: "Total Net P&L",
      value: stats.net,
      prefix: "$",
      decimals: 2,
      tooltip: "Total profit and loss across all trades",
      icon: DollarSign,
      isPositive: stats.net >= 0,
      showTrend: true,
      colorClass: stats.net >= 0 ? "text-primary" : "text-destructive",
      bgClass: stats.net >= 0 ? "bg-primary/10" : "bg-destructive/10",
      extra: `${pnlTrades.length} trades total`,
    },
    {
      label: "Open Trades",
      value: openPositions.floatingPl,
      prefix: "$",
      decimals: 2,
      tooltip: "Currently open broker positions and their floating P&L",
      icon: Activity,
      isPositive: openPositions.floatingPl >= 0,
      showTrend: true,
      colorClass: openPositions.floatingPl >= 0 ? "text-primary" : "text-destructive",
      bgClass: openPositions.floatingPl >= 0 ? "bg-primary/10" : "bg-destructive/10",
      extra: `${openPositions.count} position${openPositions.count !== 1 ? "s" : ""} open`,
    },
    {
      label: "Profit Factor",
      value: profitFactor === Infinity ? 999 : profitFactor,
      decimals: 2,
      tooltip: "Ratio of gross profit to gross loss. Above 1.5 is considered good.",
      icon: Scale,
      isPositive: profitFactor >= 1,
      displayInfinity: profitFactor === Infinity,
      colorClass: profitFactor >= 1 ? "text-primary" : "text-destructive",
      bgClass: profitFactor >= 1 ? "bg-primary/10" : "bg-destructive/10",
    },
  ];

  const rightCards = [
    {
      label: "Avg Winning Trade",
      value: avgWin,
      prefix: "$",
      decimals: 2,
      tooltip: "Average profit per winning trade",
      icon: TrendingUp,
      isPositive: true,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
      highlight: true,
      highlightColor: "primary" as const,
    },
    {
      label: "Avg Losing Trade",
      value: avgLoss,
      prefix: "-$",
      decimals: 2,
      tooltip: "Average loss per losing trade",
      icon: TrendingDown,
      isPositive: false,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
      highlight: true,
      highlightColor: "destructive" as const,
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Responsive layout: tablet uses 2-col, desktop uses 3-col split */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-4 lg:gap-5 items-stretch">
        {/* Left column — fills height, compact cards */}
        <div className="md:col-span-1 lg:col-span-2 flex flex-col gap-2 min-h-0">
          {leftCards.map((card, i) => (
            <div key={card.label} className="flex-1 min-h-0">
              <StatCard {...card} index={i} compact fill />
            </div>
          ))}
        </div>

        {/* Center column - Calendar */}
        <div className="md:col-span-2 lg:col-span-8 order-first md:order-none min-w-0">
          <PnLCalendar
            trades={trades}
            brokerTodayPnL={brokerTodayPnL}
            onUpdateTrade={onUpdateTrade}
            notebookEntries={notebookEntries}
            onSaveEntry={onSaveEntry}
            onAddTrade={onAddTrade}
          />
        </div>

        {/* Right column — fills height, compact cards + map */}
        <div className="md:col-span-2 lg:col-span-2 flex flex-col gap-2 min-h-0">
          {rightCards.map((card, i) => (
            <div key={card.label} className="flex-1 min-h-0">
              <StatCard {...card} index={i} compact fill />
            </div>
          ))}
          <div className="flex-[1.4] min-h-0">
            <Suspense fallback={<WidgetFallback minHeight={120} />}>
              <TradingIntelligenceMap trades={trades} compact />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Win ratio + Recent trades below */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 md:p-5 bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl flex flex-col min-h-[260px] md:min-h-[280px]"
        >
          <WinRatioCard trades={trades} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 min-w-0"
        >
          <Suspense fallback={<WidgetFallback minHeight={280} />}>
            <RecentTrades trades={trades} />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
}
