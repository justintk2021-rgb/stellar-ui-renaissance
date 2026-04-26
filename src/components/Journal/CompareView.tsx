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
  BarChart3,
} from "lucide-react";
import { format, subDays, differenceInCalendarDays } from "date-fns";
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

const deltaBgChip = (d: Delta) =>
  d.direction === "improved"
    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
    : d.direction === "regressed"
      ? "bg-red-500/15 text-red-500 border-red-500/30"
      : "bg-muted/40 text-muted-foreground border-border/40";

const pnlTextColor = (n: number) =>
  n > 0 ? "text-emerald-500" : n < 0 ? "text-red-500" : "text-foreground";

const formatNumber = (n: number, digits = 2) => isFinite(n) ? n.toFixed(digits) : "∞";
const deltaSign = (n: number) => (n > 0 ? "+" : n < 0 ? "" : "");

/* --------------------------- Headline metric def --------------------------- */

interface MetricDef {
  key: string;
  label: string;
  format: (n: number) => string;
  pctSuffix?: string;
  rawA: (s: ReturnType<typeof computePeriodStats>) => number;
  rawB: (s: ReturnType<typeof computePeriodStats>) => number;
  direction: "higher-better" | "lower-better" | "neutral";
  isPnL?: boolean;
}

const HEADLINE_METRICS: MetricDef[] = [
  { key: "netPnL", label: "Net P&L", format: (n) => formatPnL(n), rawA: (s) => s.netPnL, rawB: (s) => s.netPnL, direction: "higher-better", isPnL: true },
  { key: "winRate", label: "Win Rate", format: (n) => `${(n * 100).toFixed(1)}%`, pctSuffix: "pp", rawA: (s) => s.winRate, rawB: (s) => s.winRate, direction: "higher-better" },
  { key: "profitFactor", label: "Profit Factor", format: (n) => isFinite(n) ? n.toFixed(2) : "∞", rawA: (s) => isFinite(s.profitFactor) ? s.profitFactor : 0, rawB: (s) => isFinite(s.profitFactor) ? s.profitFactor : 0, direction: "higher-better" },
  { key: "expectancy", label: "Expectancy", format: (n) => formatPnL(n), rawA: (s) => s.expectancy, rawB: (s) => s.expectancy, direction: "higher-better", isPnL: true },
  { key: "avgWin", label: "Avg Win", format: (n) => formatPnL(n), rawA: (s) => s.avgWin, rawB: (s) => s.avgWin, direction: "higher-better", isPnL: true },
  { key: "avgLoss", label: "Avg Loss", format: (n) => formatPnL(n), rawA: (s) => s.avgLoss, rawB: (s) => s.avgLoss, direction: "higher-better", isPnL: true },
  { key: "totalTrades", label: "Total Trades", format: (n) => String(Math.round(n)), rawA: (s) => s.totalTrades, rawB: (s) => s.totalTrades, direction: "neutral" },
  { key: "avgTradesPerDay", label: "Trades / Day", format: (n) => n.toFixed(2), rawA: (s) => s.avgTradesPerDay, rawB: (s) => s.avgTradesPerDay, direction: "neutral" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const aAssetRows = useMemo(() => buildSinglePeriodAssetRows(aTrades), [aTrades]);
  const bAssetRows = useMemo(() => buildSinglePeriodAssetRows(bTrades), [bTrades]);
  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);

  // Headline strip delta (Net P&L)
  const headlineDelta = computeDelta(aStats.netPnL, bStats.netPnL, "higher-better");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 min-w-0 w-full space-y-4 mx-auto"
      style={{ maxWidth: "95%" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold whitespace-nowrap">Compare:</span>
          <span className="text-muted-foreground truncate">{aLabel}</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground truncate">{bLabel}</span>
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
            Exit Compare
          </button>
        </div>
      </div>

      {/* T-chart card */}
      <div className="glass rounded-2xl border border-border/40 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 hover:shadow-glow-sm">
        {/* Subtle bg gradient — match Checklist Performance card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="relative z-10 p-5 space-y-4">
          {/* Card title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Comparison</h3>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Performance Comparison</p>
            </div>
          </div>

          {/* Headline strip — Net P&L A → B + delta */}
          <div className={cn(
            "rounded-xl p-4 relative overflow-hidden border",
            headlineDelta.direction === "improved"
              ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30"
              : headlineDelta.direction === "regressed"
                ? "bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent border-red-500/30"
                : "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/30"
          )}>
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{aShort} · Net P&L</div>
                  <div className={cn("text-2xl font-bold font-mono tabular-nums", pnlTextColor(aStats.netPnL))}>
                    {formatPnL(aStats.netPnL)}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{bShort} · Net P&L</div>
                  <div className={cn("text-2xl font-bold font-mono tabular-nums", pnlTextColor(bStats.netPnL))}>
                    {formatPnL(bStats.netPnL)}
                  </div>
                </div>
              </div>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums border",
                deltaBgChip(headlineDelta),
              )}>
                {headlineDelta.direction === "improved" ? <TrendingUp className="w-4 h-4" /> :
                  headlineDelta.direction === "regressed" ? <TrendingDown className="w-4 h-4" /> : null}
                {headlineDelta.direction === "unchanged"
                  ? "No change"
                  : headlineDelta.pct !== null
                    ? `${deltaSign(headlineDelta.pct)}${Math.abs(headlineDelta.pct).toFixed(1)}%`
                    : `${deltaSign(headlineDelta.abs)}${formatNumber(Math.abs(headlineDelta.abs))}`}
              </div>
            </div>
          </div>

          {/* T-chart grid: Labels (15) | Period A (20) | Period B (20) | Conclusion (45) */}
          <div
            className="grid gap-0 rounded-xl bg-muted/10 border border-border/30 overflow-hidden"
            style={{ gridTemplateColumns: "15% 20% 20% 45%" }}
          >
            {/* === HEADER ROW === */}
            <div className="px-3 py-3" />
            <div className="px-3 py-3 border-l border-border/40 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Period A</div>
              <div className="text-sm font-semibold truncate">{aShort}</div>
            </div>
            <div className="px-3 py-3 border-l border-border/40 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Period B</div>
              <div className="text-sm font-semibold truncate">{bShort}</div>
            </div>
            <div className="px-4 py-3 border-l border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Conclusion of Comparison
              </div>
            </div>

            {/* Spans full width: horizontal divider under header (the top of the T) */}
            <div className="col-span-4 border-t border-border/40" />

            {/* === BODY ROW === */}
            {/* Label column */}
            <div className="flex flex-col">
              {HEADLINE_METRICS.map((m, i) => (
                <div
                  key={m.key}
                  className={cn(
                    "px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center",
                    i > 0 && "border-t border-border/20",
                  )}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Period A column */}
            <div className="flex flex-col border-l border-border/40">
              {HEADLINE_METRICS.map((m, i) => {
                const v = m.rawA(aStats);
                return (
                  <div
                    key={m.key}
                    className={cn(
                      "px-3 py-3 flex items-center justify-center",
                      i > 0 && "border-t border-border/20",
                    )}
                  >
                    <span className={cn(
                      "tabular-nums font-mono text-sm font-semibold",
                      m.isPnL ? pnlTextColor(v) : "text-foreground",
                    )}>
                      {m.format(v)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Period B column */}
            <div className="flex flex-col border-l border-border/40">
              {HEADLINE_METRICS.map((m, i) => {
                const aVal = m.rawA(aStats);
                const bVal = m.rawB(bStats);
                const delta = computeDelta(aVal, bVal, m.direction);
                return (
                  <div
                    key={m.key}
                    className={cn(
                      "px-3 py-3 flex items-center justify-center gap-2 flex-wrap",
                      i > 0 && "border-t border-border/20",
                    )}
                  >
                    <span className={cn(
                      "tabular-nums font-mono text-sm font-semibold",
                      m.isPnL ? pnlTextColor(bVal) : "text-foreground",
                    )}>
                      {m.format(bVal)}
                    </span>
                    {m.direction !== "neutral" || delta.direction !== "unchanged" ? (
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tabular-nums shrink-0",
                        deltaBgChip(delta),
                      )}>
                        {delta.direction === "improved" ? "▲ " : delta.direction === "regressed" ? "▼ " : ""}
                        {delta.direction === "unchanged"
                          ? "—"
                          : delta.pct !== null
                            ? `${deltaSign(delta.pct)}${Math.abs(delta.pct).toFixed(1)}${m.pctSuffix || "%"}`
                            : `${deltaSign(delta.abs)}${formatNumber(Math.abs(delta.abs))}`}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Conclusion column — internal scroll if needed */}
            <div className="border-l border-border/40 flex flex-col max-h-[560px] overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Insight text */}
                <div className="space-y-1.5">
                  {insights.map((line, i) => (
                    <p key={i} className="text-xs text-foreground/90 leading-relaxed">
                      {line}
                    </p>
                  ))}
                  {lengthMismatch && (
                    <p className="text-[10px] text-muted-foreground italic pt-1">
                      Period A is {aDays} days, Period B is {bDays} days — some metrics are normalized per-day.
                    </p>
                  )}
                </div>

                {/* Per-asset mini-breakdown */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-bold">Per-asset breakdown</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Period A</div>
                      <MiniAssetTable rows={aAssetRows} />
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Period B</div>
                      <MiniAssetTable rows={bAssetRows} />
                    </div>
                  </div>
                </div>

                {/* Best & worst */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-bold">Best &amp; worst trades</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Period A</div>
                      <MiniBestWorst bw={aBW} />
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Period B</div>
                      <MiniBestWorst bw={bBW} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ----------------------------- Mini components ----------------------------- */

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

const MiniAssetTable: React.FC<{ rows: AssetRow[] }> = ({ rows }) => {
  if (!rows.length) return <div className="text-[10px] text-muted-foreground py-1">No trades.</div>;
  return (
    <div className="space-y-1">
      {rows.slice(0, 4).map((r) => (
        <div key={r.asset} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium truncate">{r.asset}</span>
          <span className={cn("tabular-nums font-mono shrink-0", pnlTextColor(r.pnl))}>
            {formatPnL(r.pnl)}
          </span>
        </div>
      ))}
    </div>
  );
};

const MiniBestWorst: React.FC<{ bw: { best: Trade | null; worst: Trade | null } }> = ({ bw }) => {
  if (!bw.best && !bw.worst) return <div className="text-[10px] text-muted-foreground py-1">No trades.</div>;
  return (
    <div className="space-y-1.5">
      {bw.best && (
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <Trophy className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="text-[10px] font-medium truncate">{bw.best.pair}</span>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-semibold text-emerald-500 shrink-0">
            {formatPnL(bw.best.result)}
          </span>
        </div>
      )}
      {bw.worst && bw.worst.id !== bw.best?.id && (
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
            <span className="text-[10px] font-medium truncate">{bw.worst.pair}</span>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-semibold text-red-500 shrink-0">
            {formatPnL(bw.worst.result)}
          </span>
        </div>
      )}
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

/** Short header label — prefer single month name when slot is exactly that month. */
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
  // If start is day 1 of its month and end is the last day of same month → single month name
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
