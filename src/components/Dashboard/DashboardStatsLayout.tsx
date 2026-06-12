import { useMemo, useState, lazy, Suspense } from "react";
import { Trade } from "@/types/trade";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { StatCardPro } from "./StatCardPro";
import { SpotlightCard } from "./SpotlightCard";
import { EquityCurveCard } from "./EquityCurveCard";
import { PnLCalendar } from "./PnLCalendar";
import { WinRatioCard } from "./WinRatioCard";
import { NotebookEntry } from "@/types/trade";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBrokerPositions, sumFloatingPl } from "@/hooks/useBrokerPositions";
import {
  buildDailyPnLMap,
  dedupeTradesForPnL,
  getTradeNetResult,
} from "@/lib/tradeFormat";

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
  userId?: string;
  brokerDayTotals?: Map<string, number> | null;
  /** When null, open-position stats are hidden (avoids stale broker rows on manual accounts). */
  brokerConnectionId?: string | null;
  notebookEntries: NotebookEntry[];
  onUpdateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  onSaveEntry: (entry: NotebookEntry) => void;
  onAddTrade: (trade: Omit<Trade, "id">) => void;
}

export function DashboardStatsLayout({
  trades,
  userId,
  brokerDayTotals = null,
  brokerConnectionId = null,
  notebookEntries,
  onUpdateTrade,
  onSaveEntry,
  onAddTrade,
}: DashboardStatsLayoutProps) {
  const { positions: brokerPositions } = useBrokerPositions(brokerConnectionId);
  const [equityOpen, setEquityOpen] = useState(false);

  const openPositions = useMemo(
    () => ({
      count: brokerConnectionId ? brokerPositions.length : 0,
      floatingPl: brokerConnectionId ? sumFloatingPl(brokerPositions) : 0,
    }),
    [brokerConnectionId, brokerPositions],
  );

  const pnlTrades = useMemo(() => dedupeTradesForPnL(trades), [trades]);

  const stats = useMemo(
    () =>
      pnlTrades.reduce(
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
        { wins: 0, losses: 0, net: 0, totalWinAmount: 0, totalLossAmount: 0 },
      ),
    [pnlTrades],
  );

  // Sparkline series from daily P&L (last 30 trading days).
  const series = useMemo(() => {
    const byDay = buildDailyPnLMap(trades, brokerDayTotals);
    const daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
    let cum = 0;
    const equity = daily.map((v) => (cum += v));
    const last = <T,>(arr: T[]) => arr.slice(-30);
    return {
      equity: last(equity),
      daily: last(daily),
      winDays: last(daily.filter((v) => v > 0)),
      lossDays: last(daily.filter((v) => v < 0).map((v) => Math.abs(v))),
    };
  }, [trades, brokerDayTotals]);

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
      tooltip: "Total profit and loss across all trades. Click to view your equity curve.",
      icon: DollarSign,
      isPositive: stats.net >= 0,
      showTrend: true,
      extra: `${pnlTrades.length} trades total`,
      sparkData: series.equity,
      onClick: () => setEquityOpen(true),
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
      sparkData: series.winDays,
    },
    {
      label: "Avg Losing Trade",
      value: avgLoss,
      prefix: "-$",
      decimals: 2,
      tooltip: "Average loss per losing trade",
      icon: TrendingDown,
      isPositive: false,
      sparkData: series.lossDays,
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
              <StatCardPro {...card} index={i} compact />
            </div>
          ))}
        </div>

        {/* Center column - Calendar */}
        <div className="md:col-span-2 lg:col-span-8 order-first md:order-none min-w-0">
          <PnLCalendar
            trades={trades}
            userId={userId}
            brokerDayTotals={brokerDayTotals}
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
              <StatCardPro {...card} index={i} compact />
            </div>
          ))}
          <div className="flex-[1.4] min-h-0">
            <Suspense fallback={<WidgetFallback minHeight={120} />}>
              <TradingIntelligenceMap trades={trades} compact />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Equity curve popup — opens from the Total Net P&L card */}
      <Dialog open={equityOpen} onOpenChange={setEquityOpen}>
        <DialogContent
          className={
            "sm:max-w-3xl overflow-hidden rounded-3xl p-6 md:p-7 " +
            "border border-border/50 bg-card/70 backdrop-blur-2xl " +
            "shadow-[0_24px_80px_-16px_hsl(var(--foreground)/0.18),0_0_60px_-20px_hsl(var(--primary)/0.35)]"
          }
        >
          {/* Ambient glow accents */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-28 w-80 h-80 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          />
          <DialogHeader>
            <DialogTitle className="sr-only">Equity Curve</DialogTitle>
          </DialogHeader>
          <EquityCurveCard
            trades={trades}
            brokerDayTotals={brokerDayTotals}
            className="relative h-[420px]"
          />
        </DialogContent>
      </Dialog>

      {/* Win ratio + Recent trades */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        <SpotlightCard
          index={1}
          contentClassName="p-4 md:p-5 flex flex-col min-h-[260px] md:min-h-[280px]"
          hoverLift={false}
        >
          <WinRatioCard trades={trades} />
        </SpotlightCard>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 min-w-0"
        >
          <Suspense fallback={<WidgetFallback minHeight={280} />}>
            <RecentTrades trades={trades} brokerConnectionId={brokerConnectionId} />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
}
