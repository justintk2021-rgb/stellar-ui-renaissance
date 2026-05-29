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
  Calendar,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, subDays, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import {
  formatLocalDateKey,
  getTradeLocalDateKey,
  formatPnL,
  parseLocalDateKey,
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

const deltaColor = (d: Delta) =>
  d.direction === "improved"
    ? "text-emerald-500"
    : d.direction === "regressed"
      ? "text-red-500"
      : "text-muted-foreground";

const pnlTextColor = (n: number) =>
  n > 0 ? "text-emerald-500" : n < 0 ? "text-red-500" : "text-foreground";

const deltaSign = (n: number) => (n > 0 ? "+" : n < 0 ? "" : "");

type GradeLetter = "A" | "B" | "C" | "D" | "F";

const GRADE_STYLES: Record<GradeLetter, { bar: string; text: string; bg: string }> = {
  A: { bar: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/15" },
  B: { bar: "bg-primary", text: "text-primary", bg: "bg-primary/15" },
  C: { bar: "bg-yellow-500", text: "text-yellow-500", bg: "bg-yellow-500/15" },
  D: { bar: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-500/15" },
  F: { bar: "bg-red-500", text: "text-red-500", bg: "bg-red-500/15" },
};

function performanceScore(stats: PeriodStats): number {
  const wr = stats.winRate * 100;
  const pf = isFinite(stats.profitFactor)
    ? (Math.min(stats.profitFactor, 3) / 3) * 100
    : stats.profitFactor === Infinity
      ? 100
      : 0;
  const pnlBonus = stats.netPnL > 0 ? 12 : stats.netPnL < 0 ? -8 : 0;
  return Math.max(0, Math.min(100, Math.round(wr * 0.55 + pf * 0.35 + pnlBonus)));
}

function letterGrade(score: number): GradeLetter {
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 55) return "D";
  return "F";
}

function getInitials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function metricBarPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.min(100, (Math.abs(value) / max) * 100));
}

/* ---------------------- Sparkline data builder ---------------------- */

function buildDailyPnL(trades: Trade[], start: Date, end: Date) {
  const days = eachDayOfInterval({ start, end });
  const map = new Map<string, number>();
  trades.forEach((t) => {
    const k = getTradeLocalDateKey(t);
    map.set(k, (map.get(k) || 0) + (t.result || 0));
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
  const aScore = useMemo(() => performanceScore(aStats), [aStats]);
  const bScore = useMemo(() => performanceScore(bStats), [bStats]);
  const aGrade = letterGrade(aScore);
  const bGrade = letterGrade(bScore);

  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);
  const aAssetRows = useMemo(() => buildSinglePeriodAssetRows(aTrades), [aTrades]);
  const bAssetRows = useMemo(() => buildSinglePeriodAssetRows(bTrades), [bTrades]);

  const tableMetrics = useMemo(() => {
    return METRICS.map((m) => {
      const aVal = m.raw(aStats);
      const bVal = m.raw(bStats);
      const delta = computeDelta(aVal, bVal, m.direction);
      const max = Math.max(Math.abs(aVal), Math.abs(bVal), m.key === "winRate" ? 1 : 0.01);
      return { ...m, aVal, bVal, delta, max };
    });
  }, [aStats, bStats]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as const } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 min-w-0 w-full mx-auto"
      style={{ maxWidth: "1200px" }}
    >
      <div className="flex flex-col xl:flex-row gap-5">
        {/* Main comparison column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Compare</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {aShort} <span className="text-muted-foreground/50">vs</span> {bShort}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onEditPeriods && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditPeriods({ a: aSlot, b: bSlot })}
                  className="h-8 text-xs gap-1.5 border-border/50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit periods
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearCompareFromURL(); onClose(); }}
                className="h-8 text-xs gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Exit
              </Button>
            </div>
          </motion.div>

          {/* Insights — top placement for immediate takeaways */}
          <motion.div variants={itemVariants}>
            <CompareInsightsPanel insights={insights} />
          </motion.div>

          {/* Side-by-side period cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PeriodCompareCard
              label={aShort}
              subtitle={aLabel}
              stats={aStats}
              score={aScore}
              grade={aGrade}
              sparkline={aSparkline}
              accent="amber"
              compareStats={bStats}
            />
            <PeriodCompareCard
              label={bShort}
              subtitle={bLabel}
              stats={bStats}
              score={bScore}
              grade={bGrade}
              sparkline={bSparkline}
              accent="primary"
              compareStats={aStats}
            />
          </motion.div>

          {/* Widget row */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NetPnLDonut aPnL={aStats.netPnL} bPnL={bStats.netPnL} aLabel={aShort} bLabel={bShort} />
            <TradesCompareBars aTrades={aStats.totalTrades} bTrades={bStats.totalTrades} aLabel={aShort} bLabel={bShort} />
          </motion.div>

          {/* Metrics table with progress bars */}
          <motion.div variants={itemVariants} className="glass rounded-2xl border border-border/40 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Recommendation</span>
              </div>
              <div className="flex items-center gap-6 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="w-24 text-right">{aShort}</span>
                <span className="w-24 text-right">{bShort}</span>
              </div>
            </div>
            <div className="space-y-1">
              {tableMetrics.map((row) => {
                const aPct = row.key === "winRate" ? row.aVal * 100 : metricBarPct(row.aVal, row.max);
                const bPct = row.key === "winRate" ? row.bVal * 100 : metricBarPct(row.bVal, row.max);
                const aG = letterGrade(row.key === "winRate" ? row.aVal * 100 : metricBarPct(row.aVal, row.max));
                const bG = letterGrade(row.key === "winRate" ? row.bVal * 100 : metricBarPct(row.bVal, row.max));
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground font-medium">{row.label}</span>
                    <MetricBarCell
                      grade={aG}
                      pct={aPct}
                      display={row.format(row.aVal)}
                      valueClass={row.isPnL ? pnlTextColor(row.aVal) : undefined}
                    />
                    <MetricBarCell
                      grade={bG}
                      pct={bPct}
                      display={row.format(row.bVal)}
                      valueClass={row.isPnL ? pnlTextColor(row.bVal) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Report sidebar */}
        <motion.aside variants={itemVariants} className="xl:w-72 shrink-0 space-y-4">
          <ReportSidebar
            aScore={aScore}
            bScore={bScore}
            aGrade={aGrade}
            bGrade={bGrade}
            aLabel={aShort}
            bLabel={bShort}
            aSlot={aSlot}
            bSlot={bSlot}
            aStats={aStats}
            bStats={bStats}
            aBW={aBW}
            bBW={bBW}
            aAssetRows={aAssetRows}
            bAssetRows={bAssetRows}
          />
        </motion.aside>
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

function CompareInsightsPanel({ insights }: { insights: CompareInsight[] }) {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const summary = insights.find((i) => i.id === "summary") ?? insights[0];
  const details = insights.filter((i) => i !== summary);
  const previewBadge = summary ? insightBadge(summary) : null;

  const handleOpen = () => {
    setBurst(true);
    window.setTimeout(() => {
      setOpen(true);
      setBurst(false);
    }, 320);
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={handleOpen}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.97 }}
        className="group relative w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/40 via-violet-500/30 to-primary/40 opacity-70 blur-[1px] group-hover:opacity-100 transition-opacity" />
        <motion.div
          className="absolute inset-0 rounded-xl opacity-40"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{
            background: "conic-gradient(from 0deg, transparent, hsl(var(--primary)/0.5), transparent, hsl(var(--primary)/0.3), transparent)",
          }}
        />
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
          animate={{ x: ["-120%", "380%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
        />

        <AnimatePresence>
          {burst && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.4, opacity: 0.8, x: 0, y: 0 }}
                  animate={{
                    scale: 0,
                    opacity: 0,
                    x: Math.cos((i * Math.PI) / 2) * 48,
                    y: Math.sin((i * Math.PI) / 2) * 48,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 -ml-1 -mt-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
                />
              ))}
              <motion.span
                initial={{ scale: 0.6, opacity: 0.5 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="absolute inset-2 rounded-[10px] border-2 border-primary/60"
              />
            </>
          )}
        </AnimatePresence>

        <div className="relative m-[1px] flex items-center gap-3 rounded-[11px] bg-background/90 backdrop-blur-md px-4 py-3 border border-white/5">
          <motion.div
            animate={burst ? { scale: [1, 1.25, 1], rotate: [0, 180, 360] } : { rotate: [0, 8, -8, 0] }}
            transition={
              burst
                ? { duration: 0.35 }
                : { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }
            className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/25"
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </motion.div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-semibold text-foreground">AI Insights</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Tap to analyze your month comparison
            </div>
          </div>
          {previewBadge && (
            <span
              className={cn(
                "hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                previewBadge.className,
              )}
            >
              {previewBadge.label}
            </span>
          )}
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-[11px] font-medium text-primary shrink-0"
          >
            Open →
          </motion.span>
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass border-border/40 max-w-md sm:max-w-lg p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border/30">
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
                className={cn("rounded-lg border px-3 py-2.5 mb-2", SUMMARY_BG[summary.tone])}
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
  label,
  subtitle,
  stats,
  score,
  grade,
  sparkline,
  accent,
  compareStats,
}: {
  label: string;
  subtitle: string;
  stats: PeriodStats;
  score: number;
  grade: GradeLetter;
  sparkline: { date: string; pnl: number }[];
  accent: "amber" | "primary";
  compareStats: PeriodStats;
}) {
  const styles = GRADE_STYLES[grade];
  const chartColor = ACCENT_CHART[accent];
  const pnlDelta = computeDelta(compareStats.netPnL, stats.netPnL, "higher-better");
  const wrDelta = computeDelta(compareStats.winRate, stats.winRate, "higher-better");
  const gradientId = `spark-${label.replace(/\s/g, "")}`;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "glass rounded-2xl border p-4 sm:p-5 flex flex-col gap-4 overflow-hidden",
        accent === "amber" ? "border-amber-500/25" : "border-primary/25",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
            accent === "amber" ? "bg-amber-500/15 text-amber-500" : "bg-primary/15 text-primary",
          )}
        >
          {getInitials(label)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{label}</div>
          <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold tabular-nums", styles.text)}>{grade}</span>
            <span className="text-lg text-muted-foreground tabular-nums">({score}%)</span>
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center justify-end gap-1.5">
            <span className={cn("text-sm font-mono font-semibold tabular-nums", pnlTextColor(stats.netPnL))}>
              {formatPnL(stats.netPnL)}
            </span>
            {pnlDelta.direction !== "unchanged" && (
              <span className={cn("inline-flex items-center", deltaColor(pnlDelta))}>
                {pnlDelta.direction === "improved" ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{(stats.winRate * 100).toFixed(0)}% win</span>
            {wrDelta.direction !== "unchanged" && (
              <span className={cn("tabular-nums font-medium", deltaColor(wrDelta))}>
                {wrDelta.pct !== null ? `${deltaSign(wrDelta.pct)}${Math.abs(wrDelta.pct).toFixed(0)}%` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {sparkline.length > 1 && (
        <div className="h-16 -mx-1 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
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
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

function NetPnLDonut({
  aPnL,
  bPnL,
  aLabel,
  bLabel,
}: {
  aPnL: number;
  bPnL: number;
  aLabel: string;
  bLabel: string;
}) {
  const total = Math.abs(aPnL) + Math.abs(bPnL);
  const aShare = total > 0 ? Math.abs(aPnL) / total : 0.5;
  const size = 88;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const aLen = circ * aShare;
  const bLen = circ * (1 - aShare);

  return (
    <div className="glass rounded-2xl border border-border/40 p-4 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} opacity={0.25} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={stroke}
            strokeDasharray={`${aLen} ${circ}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeDasharray={`${bLen} ${circ}`}
            strokeDashoffset={-aLen}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Net P&L</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-xs font-semibold text-foreground">Total P&L split</div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{aLabel}</span>
          </div>
          <span className={cn("text-xs font-mono font-semibold tabular-nums shrink-0", pnlTextColor(aPnL))}>
            {formatPnL(aPnL)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{bLabel}</span>
          </div>
          <span className={cn("text-xs font-mono font-semibold tabular-nums shrink-0", pnlTextColor(bPnL))}>
            {formatPnL(bPnL)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TradesCompareBars({
  aTrades,
  bTrades,
  aLabel,
  bLabel,
}: {
  aTrades: number;
  bTrades: number;
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(aTrades, bTrades, 1);
  const aH = (aTrades / max) * 100;
  const bH = (bTrades / max) * 100;

  return (
    <div className="glass rounded-2xl border border-border/40 p-4">
      <div className="text-xs font-semibold text-foreground mb-3">Trades taken</div>
      <div className="flex items-end justify-center gap-8 h-20">
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[72px]">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full rounded-t-md bg-amber-500/80 origin-bottom"
            style={{ height: `${Math.max(aH, 8)}%` }}
          />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">{aLabel}</span>
          <span className="text-xs font-mono font-bold tabular-nums">{aTrades}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[72px]">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
            className="w-full rounded-t-md bg-primary/80 origin-bottom"
            style={{ height: `${Math.max(bH, 8)}%` }}
          />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">{bLabel}</span>
          <span className="text-xs font-mono font-bold tabular-nums">{bTrades}</span>
        </div>
      </div>
    </div>
  );
}

function MetricBarCell({
  grade,
  pct,
  display,
  valueClass,
}: {
  grade: GradeLetter;
  pct: number;
  display: string;
  valueClass?: string;
}) {
  const styles = GRADE_STYLES[grade];
  return (
    <div className="flex items-center gap-2 min-w-0 sm:min-w-[140px]">
      <span className={cn("text-xs font-bold w-4 shrink-0", styles.text)}>{grade}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden min-w-[48px]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", styles.bar)}
        />
      </div>
      <span className={cn("text-[11px] font-mono tabular-nums w-16 text-right shrink-0", valueClass || "text-foreground")}>
        {display}
      </span>
    </div>
  );
}

function ReportSidebar({
  aScore,
  bScore,
  aGrade,
  bGrade,
  aLabel,
  bLabel,
  aSlot,
  bSlot,
  aStats,
  bStats,
  aBW,
  bBW,
  aAssetRows,
  bAssetRows,
}: {
  aScore: number;
  bScore: number;
  aGrade: GradeLetter;
  bGrade: GradeLetter;
  aLabel: string;
  bLabel: string;
  aSlot: CompareSlotConfig;
  bSlot: CompareSlotConfig;
  aStats: PeriodStats;
  bStats: PeriodStats;
  aBW: ReturnType<typeof bestAndWorst>;
  bBW: ReturnType<typeof bestAndWorst>;
  aAssetRows: AssetRow[];
  bAssetRows: AssetRow[];
}) {
  return (
    <>
      <div className="glass rounded-2xl border border-border/40 p-4 space-y-4">
        <div className="text-sm font-semibold text-foreground">Report overview</div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/20 p-3 text-center">
            <div className={cn("text-2xl font-bold", GRADE_STYLES[aGrade].text)}>{aGrade}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{aScore}%</div>
            <div className="text-[10px] text-muted-foreground truncate mt-1">{aLabel}</div>
          </div>
          <div className="rounded-xl bg-muted/20 p-3 text-center">
            <div className={cn("text-2xl font-bold", GRADE_STYLES[bGrade].text)}>{bGrade}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{bScore}%</div>
            <div className="text-[10px] text-muted-foreground truncate mt-1">{bLabel}</div>
          </div>
        </div>

        <div className="space-y-2 text-[11px] text-muted-foreground border-t border-border/30 pt-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{format(aSlot.start, "MMM d")} – {format(aSlot.end, "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{format(bSlot.start, "MMM d")} – {format(bSlot.end, "MMM d, yyyy")}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>Trades</span>
            <span className="tabular-nums text-foreground">{aStats.totalTrades} / {bStats.totalTrades}</span>
          </div>
          <div className="flex justify-between">
            <span>Trading days</span>
            <span className="tabular-nums text-foreground">{aStats.uniqueDays} / {bStats.uniqueDays}</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/40 p-4 space-y-3">
        <div className="text-xs font-semibold text-foreground">Best & worst</div>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{aLabel}</div>
          <TradeHighlight trade={aBW.best} type="best" />
          <TradeHighlight trade={aBW.worst} type="worst" />
        </div>
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{bLabel}</div>
          <TradeHighlight trade={bBW.best} type="best" />
          <TradeHighlight trade={bBW.worst} type="worst" />
        </div>
      </div>

      {(aAssetRows.length > 0 || bAssetRows.length > 0) && (
        <div className="glass rounded-2xl border border-border/40 p-4">
          <div className="text-xs font-semibold text-foreground mb-3">Top pairs</div>
          <AssetCompareList aRows={aAssetRows} bRows={bAssetRows} aLabel={aLabel} bLabel={bLabel} />
        </div>
      )}
    </>
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
        <div key={asset} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium truncate text-foreground/80">{asset}</span>
          <div className="flex gap-3 shrink-0">
            <span className={cn("font-mono tabular-nums", pnlTextColor(aMap.get(asset)?.pnl ?? 0))}>
              {aMap.has(asset) ? formatPnL(aMap.get(asset)!.pnl) : "—"}
            </span>
            <span className={cn("font-mono tabular-nums", pnlTextColor(bMap.get(asset)?.pnl ?? 0))}>
              {bMap.has(asset) ? formatPnL(bMap.get(asset)!.pnl) : "—"}
            </span>
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-3 text-[9px] uppercase tracking-wider text-muted-foreground/60 pt-1">
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
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {isBest ? <Trophy className="w-3 h-3 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
        <span className="text-xs font-medium truncate">{trade.pair}</span>
      </div>
      <span className={cn("text-xs font-mono tabular-nums font-semibold shrink-0", isBest ? "text-emerald-500" : "text-red-500")}>
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
