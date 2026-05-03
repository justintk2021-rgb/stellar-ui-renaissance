import { useEffect, useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import type { TradingAccount } from "@/hooks/useTradingAccounts";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  X,
  ArrowRight,
  Sparkles,
  Trophy,
  AlertTriangle,
  Pencil,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
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
  buildInsights,
  type Delta,
} from "@/lib/compareMetrics";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

/* --------------------------------- Types --------------------------------- */

export type CompareMode = "range" | "account" | "tag" | "asset" | "dayOfWeek";

interface SlotConfig {
  start: Date;
  end: Date;
  accountId?: string | null;
  tag?: string;
  asset?: string;
  dayOfWeek?: number;
}

interface CompareViewProps {
  trades: Trade[];
  allAccountTrades: Trade[];
  accounts: TradingAccount[];
  initialMode?: CompareMode;
  initialA?: SlotConfig;
  initialB?: SlotConfig;
  onClose: () => void;
  onEditPeriods?: (current: { a: SlotConfig; b: SlotConfig }) => void;
  onChange?: (state: { mode: CompareMode; a: SlotConfig; b: SlotConfig }) => void;
}

/* ------------------------------ URL helpers ------------------------------ */

const dateToParam = (d: Date) => formatLocalDateKey(d);
const paramToDate = (s: string | null, fallback: Date): Date => {
  if (!s) return fallback;
  try { return parseLocalDateKey(s); } catch { return fallback; }
};

export const readCompareFromURL = (
  search: string,
): { mode: CompareMode; a: SlotConfig; b: SlotConfig } | null => {
  const sp = new URLSearchParams(search);
  if (sp.get("compare") !== "true") return null;
  const mode = (sp.get("mode") as CompareMode) || "range";
  const today = new Date();
  const a: SlotConfig = {
    start: paramToDate(sp.get("aStart"), subDays(today, 14)),
    end: paramToDate(sp.get("aEnd"), subDays(today, 8)),
    accountId: sp.get("aAccount") || undefined,
    tag: sp.get("aTag") || undefined,
    asset: sp.get("aAsset") || undefined,
    dayOfWeek: sp.get("aDow") ? Number(sp.get("aDow")) : undefined,
  };
  const b: SlotConfig = {
    start: paramToDate(sp.get("bStart"), subDays(today, 7)),
    end: paramToDate(sp.get("bEnd"), today),
    accountId: sp.get("bAccount") || undefined,
    tag: sp.get("bTag") || undefined,
    asset: sp.get("bAsset") || undefined,
    dayOfWeek: sp.get("bDow") ? Number(sp.get("bDow")) : undefined,
  };
  return { mode, a, b };
};

export const writeCompareToURL = (state: {
  mode: CompareMode; a: SlotConfig; b: SlotConfig;
}) => {
  const sp = new URLSearchParams(window.location.search);
  sp.set("compare", "true");
  sp.set("mode", state.mode);
  sp.set("aStart", dateToParam(state.a.start));
  sp.set("aEnd", dateToParam(state.a.end));
  sp.set("bStart", dateToParam(state.b.start));
  sp.set("bEnd", dateToParam(state.b.end));
  const setOrDel = (k: string, v: string | number | null | undefined) => {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  };
  setOrDel("aAccount", state.a.accountId);
  setOrDel("bAccount", state.b.accountId);
  setOrDel("aTag", state.a.tag);
  setOrDel("bTag", state.b.tag);
  setOrDel("aAsset", state.a.asset);
  setOrDel("bAsset", state.b.asset);
  setOrDel("aDow", state.a.dayOfWeek);
  setOrDel("bDow", state.b.dayOfWeek);
  const newUrl = `${window.location.pathname}?${sp.toString()}${window.location.hash}`;
  window.history.replaceState({}, "", newUrl);
};

export const clearCompareFromURL = () => {
  const sp = new URLSearchParams(window.location.search);
  ["compare","mode","aStart","aEnd","bStart","bEnd","aAccount","bAccount","aTag","bTag","aAsset","bAsset","aDow","bDow"].forEach((k) => sp.delete(k));
  const qs = sp.toString();
  const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", newUrl);
};

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
  slot: SlotConfig,
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

const formatNumber = (n: number, digits = 2) => isFinite(n) ? n.toFixed(digits) : "∞";
const deltaSign = (n: number) => (n > 0 ? "+" : n < 0 ? "" : "");

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
  const [aSlot] = useState<SlotConfig>(initialA || { start: subDays(today, 14), end: subDays(today, 8) });
  const [bSlot] = useState<SlotConfig>(initialB || { start: subDays(today, 7), end: today });

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
  const insights = useMemo(() => buildInsights(aStats, bStats, aTrades, bTrades, aLabel, bLabel), [aStats, bStats, aTrades, bTrades, aLabel, bLabel]);

  const aDays = differenceInCalendarDays(aSlot.end, aSlot.start) + 1;
  const bDays = differenceInCalendarDays(bSlot.end, bSlot.start) + 1;
  const lengthMismatch = mode === "range" && aDays !== bDays;

  // Sparkline data
  const aSparkline = useMemo(() => buildDailyPnL(aTrades, aSlot.start, aSlot.end), [aTrades, aSlot]);
  const bSparkline = useMemo(() => buildDailyPnL(bTrades, bSlot.start, bSlot.end), [bTrades, bSlot]);

  // Top 3 stat cards with sparklines (like the reference image)
  const topCards = useMemo(() => {
    return [
      {
        label: "NET P&L",
        aVal: aStats.netPnL,
        bVal: bStats.netPnL,
        format: formatPnL,
        direction: "higher-better" as const,
        isPnL: true,
        aData: aSparkline,
        bData: bSparkline,
      },
      {
        label: "WIN RATE",
        aVal: aStats.winRate,
        bVal: bStats.winRate,
        format: (n: number) => `${(n * 100).toFixed(1)}%`,
        direction: "higher-better" as const,
        isPnL: false,
        aData: null,
        bData: null,
      },
      {
        label: "TOTAL TRADES",
        aVal: aStats.totalTrades,
        bVal: bStats.totalTrades,
        format: (n: number) => String(Math.round(n)),
        direction: "neutral" as const,
        isPnL: false,
        aData: null,
        bData: null,
      },
    ];
  }, [aStats, bStats, aSparkline, bSparkline]);

  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);
  const aAssetRows = useMemo(() => buildSinglePeriodAssetRows(aTrades), [aTrades]);
  const bAssetRows = useMemo(() => buildSinglePeriodAssetRows(bTrades), [bTrades]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as const } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 min-w-0 w-full space-y-5 mx-auto px-2"
      style={{ maxWidth: "95%" }}
    >
      {/* Top bar */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Compare</h1>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-sm text-muted-foreground">{aShort} vs {bShort}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onEditPeriods && (
            <button
              onClick={() => onEditPeriods({ a: aSlot, b: bSlot })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-medium border border-primary/30 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit periods
            </button>
          )}
          <button
            onClick={() => { clearCompareFromURL(); onClose(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card text-xs font-medium border border-border/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        </div>
      </motion.div>

      {/* Top stat cards row — 3 cards with sparkline charts */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        {topCards.map((card, idx) => {
          const delta = computeDelta(card.aVal, card.bVal, card.direction);
          const sparkData = card.aData;
          const isPositive = card.bVal >= card.aVal;
          const sparkColor = delta.direction === "improved" ? "#10b981" : delta.direction === "regressed" ? "#ef4444" : "hsl(var(--primary))";

          return (
            <div
              key={idx}
              className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4 space-y-3 hover:border-border/50 transition-colors"
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                {card.label}
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className={cn("text-2xl font-bold tabular-nums font-mono", card.isPnL ? pnlTextColor(card.bVal) : "text-foreground")}>
                  {card.format(card.bVal)}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums font-mono">
                  {card.format(card.aVal)}
                </span>
                {delta.direction !== "unchanged" && (
                  <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", deltaColor(delta))}>
                    {delta.direction === "improved" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {delta.pct !== null
                      ? `${deltaSign(delta.pct)}${Math.abs(delta.pct).toFixed(1)}%`
                      : `${deltaSign(delta.abs)}${formatNumber(Math.abs(delta.abs))}`}
                  </span>
                )}
              </div>
              {/* Sparkline */}
              {sparkData && sparkData.length > 1 && (
                <div className="h-14 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "11px",
                          padding: "4px 8px",
                        }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}
                        formatter={(value: number) => [formatPnL(value), "Cumulative"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke={sparkColor}
                        strokeWidth={1.5}
                        fill={`url(#grad-${idx})`}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!sparkData && (
                <div className="h-14 flex items-end">
                  {/* Simple bar indicator for non-sparkline cards */}
                  <div className="w-full flex items-end gap-[2px] h-10">
                    {[...Array(12)].map((_, i) => {
                      const h = 20 + Math.random() * 80;
                      return (
                        <motion.div
                          key={i}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: i * 0.03, duration: 0.4 }}
                          className="flex-1 rounded-sm origin-bottom"
                          style={{
                            height: `${h}%`,
                            backgroundColor: sparkColor,
                            opacity: 0.15 + (i / 12) * 0.35,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Insights row */}
      <motion.div variants={itemVariants} className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Insights</span>
        </div>
        <div className="space-y-2">
          {insights.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="text-sm text-muted-foreground leading-relaxed"
            >
              {line}
            </motion.p>
          ))}
          {lengthMismatch && (
            <p className="text-xs text-muted-foreground/60 italic pt-1">
              Note: Period A is {aDays} days, Period B is {bDays} days.
            </p>
          )}
        </div>
      </motion.div>

      {/* Bottom section: Metrics comparison + Per-asset + Best/Worst */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Full metric comparison table */}
        <motion.div variants={itemVariants} className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
            Detailed Metrics
          </div>
          <div className="space-y-1">
            {METRICS.map((m) => {
              const aVal = m.raw(aStats);
              const bVal = m.raw(bStats);
              const delta = computeDelta(aVal, bVal, m.direction);
              return (
                <div
                  key={m.key}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-medium w-28">{m.label}</span>
                  <div className="flex items-center gap-6 text-right">
                    <span className={cn("text-sm tabular-nums font-mono w-20 text-right", m.isPnL ? pnlTextColor(aVal) : "text-foreground")}>
                      {m.format(aVal)}
                    </span>
                    <span className={cn("text-sm tabular-nums font-mono font-semibold w-20 text-right", m.isPnL ? pnlTextColor(bVal) : "text-foreground")}>
                      {m.format(bVal)}
                    </span>
                    <span className={cn("text-xs tabular-nums font-semibold w-16 text-right", deltaColor(delta))}>
                      {delta.direction === "unchanged"
                        ? "—"
                        : delta.pct !== null
                          ? `${deltaSign(delta.pct)}${Math.abs(delta.pct).toFixed(1)}${m.pctSuffix || "%"}`
                          : `${deltaSign(delta.abs)}${formatNumber(Math.abs(delta.abs))}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Column headers */}
          <div className="flex items-center justify-between px-2 pt-2 border-t border-border/20 mt-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-28">Metric</span>
            <div className="flex items-center gap-6 text-right">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-20 text-right">{aShort}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-20 text-right">{bShort}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-16 text-right">Delta</span>
            </div>
          </div>
        </motion.div>

        {/* Right: Per-asset breakdown + Best/Worst */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Per-asset */}
          <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
              Per-Asset Breakdown
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">{aShort}</div>
                <AssetList rows={aAssetRows} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">{bShort}</div>
                <AssetList rows={bAssetRows} />
              </div>
            </div>
          </div>

          {/* Best & Worst */}
          <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
              Best & Worst Trades
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{aShort}</div>
                <TradeHighlight trade={aBW.best} type="best" />
                <TradeHighlight trade={aBW.worst} type="worst" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{bShort}</div>
                <TradeHighlight trade={bBW.best} type="best" />
                <TradeHighlight trade={bBW.worst} type="worst" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ----------------------------- Sub-components ----------------------------- */

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

const AssetList: React.FC<{ rows: AssetRow[] }> = ({ rows }) => {
  if (!rows.length) return <div className="text-xs text-muted-foreground py-2">No trades.</div>;
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 5).map((r) => (
        <div key={r.asset} className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium truncate text-foreground/80">{r.asset}</span>
          <span className={cn("text-xs tabular-nums font-mono font-semibold shrink-0", pnlTextColor(r.pnl))}>
            {formatPnL(r.pnl)}
          </span>
        </div>
      ))}
    </div>
  );
};

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

function slotLabel(s: SlotConfig, mode: CompareMode, accounts: TradingAccount[], fallback: string): string {
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

function shortLabel(s: SlotConfig, mode: CompareMode, accounts: TradingAccount[]): string {
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
