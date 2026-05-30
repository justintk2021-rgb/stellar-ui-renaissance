import { useEffect, useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import type { TradingAccount } from "@/hooks/useTradingAccounts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Trophy,
  AlertTriangle,
  Pencil,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, subDays, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import {
  formatLocalDateKey,
  getTradeCloseLocalDateKey,
  getTradeLocalDateKey,
  getTradeNetResult,
  formatPnL,
} from "@/lib/tradeFormat";
import {
  computePeriodStats,
  computeDelta,
  bestAndWorst,
  buildCompareInsights,
  type CompareInsight,
  type Delta,
  type PeriodStats,
} from "@/lib/compareMetrics";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { CompareMode, CompareSlotConfig, readCompareFromURL, writeCompareToURL, clearCompareFromURL } from '@/lib/compareUrl';

interface CompareViewProps {
  trades: Trade[];
  allAccountTrades: Trade[];
  accounts: TradingAccount[];
  initialMode?: CompareMode;
  initialA?: CompareSlotConfig;
  initialB?: CompareSlotConfig;
  onClose: () => void;
  onEditPeriods?: (current: { a: CompareSlotConfig; b: CompareSlotConfig }) => void;
  onChange?: (state: { mode: CompareMode; a: CompareSlotConfig; b: CompareSlotConfig }) => void;
}

/* Re-export URL helpers for backward compatibility */
export { readCompareFromURL, writeCompareToURL, clearCompareFromURL } from '@/lib/compareUrl';
export type { CompareMode, CompareSlotConfig };

/* --------------------------- Filtering by slot --------------------------- */

const tradeDateInRange = (t: Trade, start: Date, end: Date) => {
  const k = getTradeLocalDateKey(t);
  if (!k) return false;
  const s = formatLocalDateKey(start);
  const e = formatLocalDateKey(end);
  return k >= s && k <= e;
};

const filterTradesForSlot = (
  scopedTrades: Trade[],
  allAccountTrades: Trade[],
  slot: CompareSlotConfig,
  mode: CompareMode,
): Trade[] => {
  const base = mode === "account" ? allAccountTrades : scopedTrades;
  let list = base.filter((t) => tradeDateInRange(t, slot.start, slot.end));
  if (mode === "account" && slot.accountId) list = list.filter((t) => t.accountId === slot.accountId);
  if (mode === "asset" && slot.asset) list = list.filter((t) => t.pair === slot.asset);
  if (mode === "tag" && slot.tag) list = list.filter((t) => (t.session || "").toLowerCase() === slot.tag!.toLowerCase());
  if (mode === "dayOfWeek" && slot.dayOfWeek !== undefined) {
    list = list.filter((t) => {
      const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
      return !isNaN(d.getTime()) && d.getDay() === slot.dayOfWeek;
    });
  }
  return list;
};

/* ------------------------------ Color helpers ----------------------------- */

const pnlTextColor = (n: number) =>
  n > 0 ? "text-emerald-500" : n < 0 ? "text-red-500" : "text-foreground";

/* ---------------------- Sparkline data builder ---------------------- */

function buildDailyPnL(trades: Trade[], start: Date, end: Date) {
  const days = eachDayOfInterval({ start, end });
  const map = new Map<string, number>();
  trades.forEach((t) => {
    const k = getTradeCloseLocalDateKey(t);
    map.set(k, (map.get(k) || 0) + getTradeNetResult(t));
  });
  let cum = 0;
  return days.map((d) => {
    const k = formatLocalDateKey(d);
    const daily = map.get(k) || 0;
    cum += daily;
    return { date: format(d, "MMM d"), pnl: cum };
  });
}

/* --------------------------- Headline metric def --------------------------- */

interface MetricDef {
  key: string;
  label: string;
  format: (n: number) => string;
  pctSuffix?: string;
  raw: (s: ReturnType<typeof computePeriodStats>) => number;
  direction: "higher-better" | "lower-better" | "neutral";
  isPnL?: boolean;
}

const METRICS: MetricDef[] = [
  { key: "netPnL", label: "NET P&L", format: (n) => formatPnL(n), raw: (s) => s.netPnL, direction: "higher-better", isPnL: true },
  { key: "winRate", label: "WIN RATE", format: (n) => `${(n * 100).toFixed(1)}%`, pctSuffix: "pp", raw: (s) => s.winRate, direction: "higher-better" },
  { key: "profitFactor", label: "PROFIT FACTOR", format: (n) => isFinite(n) ? n.toFixed(2) : "∞", raw: (s) => isFinite(s.profitFactor) ? s.profitFactor : 0, direction: "higher-better" },
  { key: "totalTrades", label: "TOTAL TRADES", format: (n) => String(Math.round(n)), raw: (s) => s.totalTrades, direction: "neutral" },
  { key: "expectancy", label: "EXPECTANCY", format: (n) => formatPnL(n), raw: (s) => s.expectancy, direction: "higher-better", isPnL: true },
  { key: "avgWin", label: "AVG WIN", format: (n) => formatPnL(n), raw: (s) => s.avgWin, direction: "higher-better", isPnL: true },
  { key: "avgLoss", label: "AVG LOSS", format: (n) => formatPnL(n), raw: (s) => s.avgLoss, direction: "higher-better", isPnL: true },
  { key: "avgTradesPerDay", label: "TRADES / DAY", format: (n) => n.toFixed(1), raw: (s) => s.avgTradesPerDay, direction: "neutral" },
];

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

/* --------------------------------- Main --------------------------------- */

export function CompareView({
  trades, allAccountTrades, accounts,
  initialMode = "range", initialA, initialB,
  onClose, onEditPeriods, onChange,
}: CompareViewProps) {
  const today = new Date();
  const [mode] = useState<CompareMode>(initialMode);
  const [aSlot] = useState<CompareSlotConfig>(initialA || { start: subDays(today, 14), end: subDays(today, 8) });
  const [bSlot] = useState<CompareSlotConfig>(initialB || { start: subDays(today, 7), end: today });

  useEffect(() => {
    const state = { mode, a: aSlot, b: bSlot };
    writeCompareToURL(state);
    onChange?.(state);
  }, [mode, aSlot, bSlot]);

  const aTrades = useMemo(() => filterTradesForSlot(trades, allAccountTrades, aSlot, mode), [trades, allAccountTrades, aSlot, mode]);
  const bTrades = useMemo(() => filterTradesForSlot(trades, allAccountTrades, bSlot, mode), [trades, allAccountTrades, bSlot, mode]);
  const aStats = useMemo(() => computePeriodStats(aTrades), [aTrades]);
  const bStats = useMemo(() => computePeriodStats(bTrades), [bTrades]);
  const aLabel = useMemo(() => slotLabel(aSlot, mode, accounts, "A"), [aSlot, mode, accounts]);
  const bLabel = useMemo(() => slotLabel(bSlot, mode, accounts, "B"), [bSlot, mode, accounts]);
  const aShort = useMemo(() => shortLabel(aSlot, mode, accounts), [aSlot, mode, accounts]);
  const bShort = useMemo(() => shortLabel(bSlot, mode, accounts), [bSlot, mode, accounts]);
  const aDays = differenceInCalendarDays(aSlot.end, aSlot.start) + 1;
  const bDays = differenceInCalendarDays(bSlot.end, bSlot.start) + 1;
  const insights = useMemo(
    () => buildCompareInsights(aStats, bStats, aTrades, bTrades, aLabel, bLabel, { aDays, bDays }),
    [aStats, bStats, aTrades, bTrades, aLabel, bLabel, aDays, bDays],
  );

  const aSparkline = useMemo(() => buildDailyPnL(aTrades, aSlot.start, aSlot.end), [aTrades, aSlot]);
  const bSparkline = useMemo(() => buildDailyPnL(bTrades, bSlot.start, bSlot.end), [bTrades, bSlot]);

  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);
  const aAssetRows = useMemo(() => buildSinglePeriodAssetRows(aTrades), [aTrades]);
  const bAssetRows = useMemo(() => buildSinglePeriodAssetRows(bTrades), [bTrades]);

  const tableMetrics = useMemo(() => {
    return METRICS.map((m) => {
      const aVal = m.raw(aStats);
      const bVal = m.raw(bStats);
      const delta = computeDelta(aVal, bVal, m.direction);
      return { ...m, aVal, bVal, delta };
    });
  }, [aStats, bStats]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  };

  const netDelta = computeDelta(aStats.netPnL, bStats.netPnL, "higher-better");
  const wrDelta = computeDelta(aStats.winRate, bStats.winRate, "higher-better");
  const tradesDelta = computeDelta(aStats.totalTrades, bStats.totalTrades, "neutral");

  const deltaItems = [
    { label: "Net P&L", delta: netDelta, aDisplay: formatPnL(aStats.netPnL), bDisplay: formatPnL(bStats.netPnL) },
    { label: "Win rate", delta: wrDelta, aDisplay: `${(aStats.winRate * 100).toFixed(0)}%`, bDisplay: `${(bStats.winRate * 100).toFixed(0)}%` },
    { label: "Trades", delta: tradesDelta, aDisplay: String(aStats.totalTrades), bDisplay: String(bStats.totalTrades) },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 min-w-0 w-full"
    >
      <div className="space-y-5 md:space-y-6">
        <motion.header
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 text-left"
        >
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Compare</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              <span className="text-amber-600/90 dark:text-amber-400">{aShort}</span>
              <span className="mx-2 text-muted-foreground/40">vs</span>
              <span className="text-primary">{bShort}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEditPeriods && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditPeriods({ a: aSlot, b: bSlot })}
                className="h-9 text-xs gap-1.5 border-border/50 rounded-xl"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit periods
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearCompareFromURL(); onClose(); }}
              className="h-9 text-xs gap-1.5 rounded-xl"
            >
              <X className="w-3.5 h-3.5" />
              Exit
            </Button>
          </div>
        </motion.header>

        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-0 auto-rows-min divide-y divide-border/30 xl:divide-y-0">
          <BentoCard
            variants={itemVariants}
            className="md:col-span-1 xl:col-span-4"
            title={aShort}
            description={aLabel}
            accent="amber"
          >
            <PeriodCompareCard
              stats={aStats}
              sparkline={aSparkline}
              accent="amber"
            />
          </BentoCard>

          <BentoCard
            variants={itemVariants}
            className="md:col-span-2 xl:col-span-4"
            title="Insights"
            description="What changed between periods"
          >
            <CompareInsightsPanel insights={insights} embedded />
            <KeyDeltaStrip className="mt-5" items={deltaItems} />
          </BentoCard>

          <BentoCard
            variants={itemVariants}
            className="md:col-span-1 xl:col-span-4"
            title={bShort}
            description={bLabel}
            accent="primary"
          >
            <PeriodCompareCard
              stats={bStats}
              sparkline={bSparkline}
              accent="primary"
            />
          </BentoCard>

          <BentoCard
            variants={itemVariants}
            className="md:col-span-2 xl:col-span-7"
            title="All metrics"
            description={`${aShort} compared to ${bShort}`}
          >
            <CompareMetricsTable rows={tableMetrics} aLabel={aShort} bLabel={bShort} />
          </BentoCard>

          <BentoCard
            variants={itemVariants}
            className="md:col-span-2 xl:col-span-5"
            title="Trade highlights"
            description="Best, worst, and top pairs"
          >
            <PeriodMetaGrid aSlot={aSlot} bSlot={bSlot} aStats={aStats} bStats={bStats} aLabel={aShort} bLabel={bShort} />
            <div className="mt-5 space-y-5">
              <HighlightsColumn label={aShort} bw={aBW} />
              <HighlightsColumn label={bShort} bw={bBW} />
            </div>
            {(aAssetRows.length > 0 || bAssetRows.length > 0) && (
              <TopPairsDropdown
                aRows={aAssetRows}
                bRows={bAssetRows}
                aLabel={aShort}
                bLabel={bShort}
              />
            )}
          </BentoCard>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ----------------------------- Sub-components ----------------------------- */

const INSIGHT_BADGE: Record<
  CompareInsight["tone"],
  { label: string; className: string }
> = {
  positive: { label: "Improved", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  negative: { label: "Declined", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  neutral: { label: "Stable", className: "bg-muted text-muted-foreground" },
  advice: { label: "Focus", className: "bg-primary/15 text-primary" },
};

const SUMMARY_BG: Record<CompareInsight["tone"], string> = {
  positive: "bg-emerald-500/10 border-emerald-500/20",
  negative: "bg-red-500/10 border-red-500/20",
  neutral: "bg-muted/30 border-border/40",
  advice: "bg-primary/10 border-primary/20",
};

const SUMMARY_BADGE: Record<CompareInsight["tone"], { label: string; className: string }> = {
  positive: { label: "Improving", className: "bg-emerald-600 text-white" },
  negative: { label: "Regressing", className: "bg-red-600 text-white" },
  neutral: { label: "Flat", className: "bg-muted-foreground/80 text-white" },
  advice: { label: "Review", className: "bg-primary text-primary-foreground" },
};

function insightBadge(insight: CompareInsight) {
  if (insight.id === "empty" || insight.id === "one-sided") {
    return { label: "Incomplete", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
  return INSIGHT_BADGE[insight.tone];
}

const BENTO_ACCENT_BAR: Record<"amber" | "primary", string> = {
  amber: "from-amber-500/60 via-amber-400/30 to-transparent",
  primary: "from-primary/60 via-primary/30 to-transparent",
};

const BENTO_CELL_DIVIDER =
  "xl:[&:nth-child(1)]:border-r xl:[&:nth-child(2)]:border-r xl:[&:nth-child(4)]:border-t xl:[&:nth-child(4)]:border-r xl:[&:nth-child(5)]:border-t border-border/30";

function BentoCard({
  title,
  description,
  accent,
  className,
  children,
  variants: motionVariants,
}: {
  title: string;
  description?: string;
  accent?: "amber" | "primary";
  className?: string;
  children: React.ReactNode;
  variants?: typeof itemVariants;
}) {
  return (
    <motion.article
      variants={motionVariants}
      className={cn(
        "flex flex-col min-h-0 text-left bg-transparent",
        BENTO_CELL_DIVIDER,
        className,
      )}
    >
      {accent && (
        <div className={cn("h-0.5 w-full bg-gradient-to-r shrink-0 opacity-80", BENTO_ACCENT_BAR[accent])} />
      )}
      <div className="px-5 pt-5 pb-2 md:px-6 md:pt-6 md:pb-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="px-5 pb-5 md:px-6 md:pb-6 pt-1 flex-1 min-w-0">{children}</div>
    </motion.article>
  );
}

function KeyDeltaStrip({
  items,
  className,
}: {
  items: { label: string; delta: Delta; aDisplay: string; bDisplay: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}>
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 + i * 0.06, duration: 0.35 }}
          className="rounded-lg bg-muted/30 px-4 py-3.5 text-left"
        >
          <div className="text-xs text-muted-foreground mb-2">{item.label}</div>
          <div className="flex items-center gap-2 text-sm tabular-nums flex-wrap">
            <span className="text-muted-foreground">{item.aDisplay}</span>
            <DeltaPill delta={item.delta} />
            <span className="text-foreground font-medium">{item.bDisplay}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  if (delta.direction === "unchanged") {
    return <span className="text-[10px] text-muted-foreground shrink-0">—</span>;
  }
  const improved = delta.direction === "improved";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full",
        improved ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400",
      )}
    >
      {improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta.pct !== null ? `${Math.abs(delta.pct).toFixed(0)}%` : "Δ"}
    </span>
  );
}

function CompareMetricsTable({
  rows,
  aLabel,
  bLabel,
}: {
  rows: Array<{
    key: string;
    label: string;
    format: (n: number) => string;
    aVal: number;
    bVal: number;
    delta: Delta;
    isPnL?: boolean;
  }>;
  aLabel: string;
  bLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[minmax(6.5rem,9rem)_1fr_auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground pb-3 border-b border-border/25">
        <span>Metric</span>
        <span className="truncate">{aLabel}</span>
        <span className="sr-only">Change</span>
        <span className="truncate">{bLabel}</span>
      </div>
      {rows.map((row, i) => (
        <motion.div
          key={row.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.03, duration: 0.25 }}
          className="rounded-lg bg-muted/25 px-4 py-3 grid grid-cols-1 sm:grid-cols-[minmax(6.5rem,9rem)_1fr_auto_1fr] gap-x-4 gap-y-2 sm:gap-y-0 sm:items-center text-left"
        >
          <span className="text-sm text-muted-foreground">{row.label}</span>
          <span
            className={cn(
              "text-sm font-mono tabular-nums",
              row.isPnL ? pnlTextColor(row.aVal) : "text-foreground",
            )}
          >
            {row.format(row.aVal)}
          </span>
          <DeltaPill delta={row.delta} />
          <span
            className={cn(
              "text-sm font-mono tabular-nums sm:text-right",
              row.isPnL ? pnlTextColor(row.bVal) : "text-foreground",
            )}
          >
            {row.format(row.bVal)}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function PeriodMetaGrid({
  aSlot,
  bSlot,
  aStats,
  bStats,
  aLabel,
  bLabel,
}: {
  aSlot: CompareSlotConfig;
  bSlot: CompareSlotConfig;
  aStats: PeriodStats;
  bStats: PeriodStats;
  aLabel: string;
  bLabel: string;
}) {
  const cells = [
    { label: aLabel, value: `${format(aSlot.start, "MMM d")} – ${format(aSlot.end, "MMM d, yyyy")}` },
    { label: bLabel, value: `${format(bSlot.start, "MMM d")} – ${format(bSlot.end, "MMM d, yyyy")}` },
    { label: "Trades", value: `${aStats.totalTrades} / ${bStats.totalTrades}` },
    { label: "Trading days", value: `${aStats.uniqueDays} / ${bStats.uniqueDays}` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-lg bg-muted/30 px-4 py-3 text-left"
        >
          <div className="text-xs text-muted-foreground">{cell.label}</div>
          <div className="text-sm font-medium text-foreground mt-1 tabular-nums">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

function HighlightsColumn({
  label,
  bw,
}: {
  label: string;
  bw: ReturnType<typeof bestAndWorst>;
}) {
  return (
    <div className="space-y-2 text-left">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <TradeHighlight trade={bw.best} type="best" />
      <TradeHighlight trade={bw.worst} type="worst" />
    </div>
  );
}

function CompareInsightsPanel({
  insights,
  embedded = false,
}: {
  insights: CompareInsight[];
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const summary = insights.find((i) => i.id === "summary") ?? insights[0];
  const details = insights.filter((i) => i !== summary);
  const previewBadge = summary ? insightBadge(summary) : null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: embedded ? 0 : -1 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          embedded
            ? "rounded-lg bg-muted/30 px-4 py-4 hover:bg-muted/40"
            : "rounded-lg bg-muted/25 hover:bg-muted/35 px-4 py-3",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              {previewBadge && (
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", previewBadge.className)}>
                  {previewBadge.label}
                </span>
              )}
            </div>
            {summary && (
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
                {summary.analysis}
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3">
              View full analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold flex-1">AI Insights</DialogTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
              aria-label="Close insights"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
            }}
            className="max-h-[min(70vh,520px)] overflow-y-auto px-4 py-3"
          >
            {summary && (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16, scale: 0.96 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 380, damping: 28 } },
                }}
                className={cn("rounded-xl glass-popup-panel px-3 py-2.5 mb-2", SUMMARY_BG[summary.tone])}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-foreground">Overall Recommendation</span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                      SUMMARY_BADGE[summary.tone].className,
                    )}
                  >
                    {SUMMARY_BADGE[summary.tone].label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {summary.analysis}
                  {summary.advice && (
                    <span className="text-foreground/90"> {summary.advice}</span>
                  )}
                </p>
              </motion.div>
            )}

            {details.map((insight) => {
              const badge = insightBadge(insight);
              return (
                <motion.div
                  key={insight.id}
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } },
                  }}
                  className="border-t border-border/30 py-2.5 first:border-t-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{insight.title}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    {insight.analysis}
                    {insight.advice && (
                      <span className="text-primary/90"> → {insight.advice}</span>
                    )}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AssetRow {
  asset: string;
  pnl: number;
  trades: number;
  winRate: number;
}

function buildSinglePeriodAssetRows(trades: Trade[]): AssetRow[] {
  const map = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const k = t.pair || "—";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  });
  const rows: AssetRow[] = [];
  map.forEach((ts, asset) => {
    const pnl = ts.reduce((s, t) => s + (t.result || 0), 0);
    const wins = ts.filter((t) => t.result > 0).length;
    rows.push({ asset, pnl, trades: ts.length, winRate: ts.length ? wins / ts.length : 0 });
  });
  rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return rows;
}

const ACCENT_CHART: Record<"amber" | "primary", string> = {
  amber: "#f59e0b",
  primary: "hsl(var(--primary))",
};

function PeriodCompareCard({
  stats,
  sparkline,
  accent,
}: {
  stats: PeriodStats;
  sparkline: { date: string; pnl: number }[];
  accent: "amber" | "primary";
}) {
  const chartColor = ACCENT_CHART[accent];
  const gradientId = `spark-${accent}`;

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="space-y-1">
        <div className={cn("text-2xl font-semibold font-mono tabular-nums tracking-tight", pnlTextColor(stats.netPnL))}>
          {formatPnL(stats.netPnL)}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="tabular-nums">{(stats.winRate * 100).toFixed(0)}% win rate</span>
          <span className="tabular-nums">{stats.totalTrades} trades</span>
        </div>
      </div>

      {sparkline.length > 1 && (
        <div className="h-20 w-full opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number) => [formatPnL(value), "Cumulative"]}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TopPairsDropdown({
  aRows,
  bRows,
  aLabel,
  bLabel,
}: {
  aRows: AssetRow[];
  bRows: AssetRow[];
  aLabel: string;
  bLabel: string;
}) {
  const pairCount = new Set([...aRows.map((r) => r.asset), ...bRows.map((r) => r.asset)]).size;

  return (
    <Collapsible className="mt-5 pt-5 border-t border-border/30">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">Top pairs</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {pairCount} {pairCount === 1 ? "pair" : "pairs"} · {aLabel} vs {bLabel}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pt-3 rounded-xl glass-popup-panel p-4">
          <AssetCompareList aRows={aRows} bRows={bRows} aLabel={aLabel} bLabel={bLabel} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssetCompareList({
  aRows,
  bRows,
  aLabel,
  bLabel,
}: {
  aRows: AssetRow[];
  bRows: AssetRow[];
  aLabel: string;
  bLabel: string;
}) {
  const keys = [...new Set([...aRows.map((r) => r.asset), ...bRows.map((r) => r.asset)])].slice(0, 4);
  const aMap = new Map(aRows.map((r) => [r.asset, r]));
  const bMap = new Map(bRows.map((r) => [r.asset, r]));

  return (
    <div className="space-y-2">
      {keys.map((asset) => (
        <div
          key={asset}
          className="flex items-center justify-between gap-3 rounded-lg bg-muted/25 px-3 py-2.5 text-sm"
        >
          <span className="font-medium truncate text-foreground">{asset}</span>
          <div className="flex gap-4 shrink-0 tabular-nums font-mono text-xs">
            <span className={cn(pnlTextColor(aMap.get(asset)?.pnl ?? 0))}>
              {aMap.has(asset) ? formatPnL(aMap.get(asset)!.pnl) : "—"}
            </span>
            <span className={cn(pnlTextColor(bMap.get(asset)?.pnl ?? 0))}>
              {bMap.has(asset) ? formatPnL(bMap.get(asset)!.pnl) : "—"}
            </span>
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-4 text-xs text-muted-foreground pt-1 pr-3">
        <span>{aLabel}</span>
        <span>{bLabel}</span>
      </div>
    </div>
  );
}

const TradeHighlight: React.FC<{ trade: Trade | null; type: "best" | "worst" }> = ({ trade, type }) => {
  if (!trade) return null;
  const isBest = type === "best";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/25 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        {isBest ? <Trophy className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
        <span className="text-sm font-medium truncate">{trade.pair}</span>
      </div>
      <span className={cn("text-sm font-mono tabular-nums font-semibold shrink-0", isBest ? "text-emerald-500" : "text-red-500")}>
        {formatPnL(trade.result)}
      </span>
    </div>
  );
};

/* ------------------------------- Helpers ------------------------------- */

function slotLabel(s: CompareSlotConfig, mode: CompareMode, accounts: TradingAccount[], fallback: string): string {
  const range = `${format(s.start, "MMM d")} – ${format(s.end, "MMM d, yyyy")}`;
  if (mode === "account") {
    const acc = accounts.find((a) => a.id === s.accountId);
    return acc ? `${acc.name} (${range})` : `${fallback} (${range})`;
  }
  if (mode === "asset" && s.asset) return `${s.asset} (${range})`;
  if (mode === "tag" && s.tag) return `${s.tag} (${range})`;
  if (mode === "dayOfWeek" && s.dayOfWeek !== undefined) {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${labels[s.dayOfWeek]}s (${range})`;
  }
  return range;
}

function shortLabel(s: CompareSlotConfig, mode: CompareMode, accounts: TradingAccount[]): string {
  if (mode === "account") {
    const acc = accounts.find((a) => a.id === s.accountId);
    if (acc) return acc.name;
  }
  if (mode === "asset" && s.asset) return s.asset;
  if (mode === "tag" && s.tag) return s.tag;
  if (mode === "dayOfWeek" && s.dayOfWeek !== undefined) {
    const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return labels[s.dayOfWeek];
  }
  const start = s.start;
  const end = s.end;
  const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === lastOfMonth.getDate()
  ) {
    return format(start, "MMMM yyyy");
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}
