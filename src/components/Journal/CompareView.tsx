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
  buildGroupBreakdown,
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
  /** Re-open the year-view month-picker preloaded with the current A/B months. */
  onEditPeriods?: (current: { a: SlotConfig; b: SlotConfig }) => void;
  onChange?: (state: {
    mode: CompareMode;
    a: SlotConfig;
    b: SlotConfig;
  }) => void;
}

/* ------------------------------ URL helpers ------------------------------ */

const dateToParam = (d: Date) => formatLocalDateKey(d);
const paramToDate = (s: string | null, fallback: Date): Date => {
  if (!s) return fallback;
  try {
    return parseLocalDateKey(s);
  } catch {
    return fallback;
  }
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
  mode: CompareMode;
  a: SlotConfig;
  b: SlotConfig;
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
  [
    "compare", "mode",
    "aStart", "aEnd", "bStart", "bEnd",
    "aAccount", "bAccount", "aTag", "bTag",
    "aAsset", "bAsset", "aDow", "bDow",
  ].forEach((k) => sp.delete(k));
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
  if (mode === "account" && slot.accountId) {
    list = list.filter((t) => t.accountId === slot.accountId);
  }
  if (mode === "asset" && slot.asset) {
    list = list.filter((t) => t.pair === slot.asset);
  }
  if (mode === "tag" && slot.tag) {
    list = list.filter((t) => (t.session || "").toLowerCase() === slot.tag!.toLowerCase());
  }
  if (mode === "dayOfWeek" && slot.dayOfWeek !== undefined) {
    list = list.filter((t) => {
      const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
      return !isNaN(d.getTime()) && d.getDay() === slot.dayOfWeek;
    });
  }
  return list;
};

/* ------------------------------ Color helpers ----------------------------- */

const deltaTextColor = (d: Delta) =>
  d.direction === "improved"
    ? "text-emerald-500"
    : d.direction === "regressed"
      ? "text-red-500"
      : "text-muted-foreground";

const deltaBgChip = (d: Delta) =>
  d.direction === "improved"
    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
    : d.direction === "regressed"
      ? "bg-red-500/15 text-red-500 border-red-500/30"
      : "bg-muted/40 text-muted-foreground border-border/40";

const pnlTextColor = (n: number) =>
  n > 0 ? "text-emerald-500" : n < 0 ? "text-red-500" : "text-muted-foreground";

const formatNumber = (n: number, digits = 2) => {
  if (!isFinite(n)) return "∞";
  return n.toFixed(digits);
};

const deltaSign = (n: number) => (n > 0 ? "+" : n < 0 ? "" : "");

/* --------------------------- Headline metric def --------------------------- */

interface MetricDef {
  key: string;
  label: string;
  format: (n: number) => string;
  /** Suffix on % delta (default "%", "pp" for win-rate) */
  pctSuffix?: string;
  /** Override display: when value is a probability, multiply by 100 etc. */
  rawA: (s: ReturnType<typeof computePeriodStats>) => number;
  rawB: (s: ReturnType<typeof computePeriodStats>) => number;
  direction: "higher-better" | "lower-better" | "neutral";
}

const HEADLINE_METRICS: MetricDef[] = [
  {
    key: "netPnL",
    label: "Net P&L",
    format: (n) => formatPnL(n),
    rawA: (s) => s.netPnL,
    rawB: (s) => s.netPnL,
    direction: "higher-better",
  },
  {
    key: "winRate",
    label: "Win Rate",
    format: (n) => `${(n * 100).toFixed(1)}%`,
    pctSuffix: "pp",
    rawA: (s) => s.winRate,
    rawB: (s) => s.winRate,
    direction: "higher-better",
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    format: (n) => (isFinite(n) ? n.toFixed(2) : "∞"),
    rawA: (s) => (isFinite(s.profitFactor) ? s.profitFactor : 0),
    rawB: (s) => (isFinite(s.profitFactor) ? s.profitFactor : 0),
    direction: "higher-better",
  },
  {
    key: "expectancy",
    label: "Expectancy",
    format: (n) => formatPnL(n),
    rawA: (s) => s.expectancy,
    rawB: (s) => s.expectancy,
    direction: "higher-better",
  },
  {
    key: "avgWin",
    label: "Avg Win",
    format: (n) => formatPnL(n),
    rawA: (s) => s.avgWin,
    rawB: (s) => s.avgWin,
    direction: "higher-better",
  },
  {
    key: "avgLoss",
    label: "Avg Loss",
    format: (n) => formatPnL(n),
    rawA: (s) => s.avgLoss,
    rawB: (s) => s.avgLoss,
    direction: "higher-better", // less negative is better
  },
  {
    key: "totalTrades",
    label: "Total Trades",
    format: (n) => String(Math.round(n)),
    rawA: (s) => s.totalTrades,
    rawB: (s) => s.totalTrades,
    direction: "neutral",
  },
  {
    key: "avgTradesPerDay",
    label: "Trades / Day",
    format: (n) => n.toFixed(2),
    rawA: (s) => s.avgTradesPerDay,
    rawB: (s) => s.avgTradesPerDay,
    direction: "neutral",
  },
];

/* --------------------------------- Main --------------------------------- */

export function CompareView({
  trades,
  allAccountTrades,
  accounts,
  initialMode = "range",
  initialA,
  initialB,
  onClose,
  onEditPeriods,
  onChange,
}: CompareViewProps) {
  const today = new Date();

  const [mode] = useState<CompareMode>(initialMode);
  const [aSlot] = useState<SlotConfig>(
    initialA || { start: subDays(today, 14), end: subDays(today, 8) },
  );
  const [bSlot] = useState<SlotConfig>(
    initialB || { start: subDays(today, 7), end: today },
  );

  // Push state to URL + parent
  useEffect(() => {
    const state = { mode, a: aSlot, b: bSlot };
    writeCompareToURL(state);
    onChange?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, aSlot, bSlot]);

  /* ---------------------------- Compute data --------------------------- */
  const aTrades = useMemo(
    () => filterTradesForSlot(trades, allAccountTrades, aSlot, mode),
    [trades, allAccountTrades, aSlot, mode],
  );
  const bTrades = useMemo(
    () => filterTradesForSlot(trades, allAccountTrades, bSlot, mode),
    [trades, allAccountTrades, bSlot, mode],
  );

  const aStats = useMemo(() => computePeriodStats(aTrades), [aTrades]);
  const bStats = useMemo(() => computePeriodStats(bTrades), [bTrades]);

  const aLabel = useMemo(() => slotLabel(aSlot, mode, accounts, "A"), [aSlot, mode, accounts]);
  const bLabel = useMemo(() => slotLabel(bSlot, mode, accounts, "B"), [bSlot, mode, accounts]);

  const insights = useMemo(
    () => buildInsights(aStats, bStats, aTrades, bTrades, aLabel, bLabel),
    [aStats, bStats, aTrades, bTrades, aLabel, bLabel],
  );

  const aDays = differenceInCalendarDays(aSlot.end, aSlot.start) + 1;
  const bDays = differenceInCalendarDays(bSlot.end, bSlot.start) + 1;
  const lengthMismatch = mode === "range" && aDays !== bDays;

  /* ------------------------------ Groups ------------------------------- */
  // Per-asset rows scoped per period independently (we show each side as its own table)
  const aAssetRows = useMemo(() => buildSinglePeriodAssetRows(aTrades), [aTrades]);
  const bAssetRows = useMemo(() => buildSinglePeriodAssetRows(bTrades), [bTrades]);

  /* --------------------------- Best / Worst ---------------------------- */
  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);

  /* --------------------------- Render --------------------------- */

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 min-w-0 w-full space-y-5"
    >
      {/* Top bar — full width */}
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
            onClick={() => {
              clearCompareFromURL();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card text-xs font-medium border border-border/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Exit Compare
          </button>
        </div>
      </div>

      {/* Insight card — full width */}
      <section className="rounded-xl bg-card/60 border border-border/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Insight
        </div>
        <ul className="space-y-1.5">
          {insights.map((line, i) => (
            <li key={i} className="text-sm text-foreground/90 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
        {lengthMismatch && (
          <div className="mt-1 text-[11px] text-muted-foreground italic">
            Period A is {aDays} days, Period B is {bDays} days — some metrics are normalized per-day.
          </div>
        )}
      </section>

      {/* Headline stats — true side-by-side A | B */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        {/* Period A column */}
        <div className="space-y-3 min-w-0">
          <PeriodColumnHeader label="Period A" range={aLabel} />
          <div className="grid grid-cols-2 gap-3">
            {HEADLINE_METRICS.map((m) => (
              <MetricTile
                key={`a-${m.key}`}
                label={m.label}
                value={m.format(m.rawA(aStats))}
                pnl={m.key === "netPnL" || m.key === "expectancy" || m.key === "avgWin" || m.key === "avgLoss"
                  ? m.rawA(aStats)
                  : undefined}
              />
            ))}
          </div>
        </div>

        {/* Period B column */}
        <div className="space-y-3 min-w-0">
          <PeriodColumnHeader label="Period B" range={bLabel} />
          <div className="grid grid-cols-2 gap-3">
            {HEADLINE_METRICS.map((m) => {
              const aVal = m.rawA(aStats);
              const bVal = m.rawB(bStats);
              const delta = computeDelta(
                aVal,
                bVal,
                m.direction,
              );
              return (
                <MetricTile
                  key={`b-${m.key}`}
                  label={m.label}
                  value={m.format(bVal)}
                  pnl={m.key === "netPnL" || m.key === "expectancy" || m.key === "avgWin" || m.key === "avgLoss"
                    ? bVal
                    : undefined}
                  delta={delta}
                  pctSuffix={m.pctSuffix}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Per-asset (A | B) and Best & worst (A | B) — share one row at xl+ */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-5">
        {/* Per-asset breakdown */}
        <div className="rounded-xl bg-card/60 border border-border/40 p-4 flex flex-col min-w-0">
          <h3 className="text-sm font-semibold mb-3">Per-asset breakdown</h3>
          <div className="grid grid-cols-2 gap-x-6 min-w-0">
            <div className="min-w-0">
              <PeriodMiniHeader label="Period A" />
              <AssetTable rows={aAssetRows} />
            </div>
            <div className="min-w-0">
              <PeriodMiniHeader label="Period B" />
              <AssetTable rows={bAssetRows} />
            </div>
          </div>
        </div>

        {/* Best & worst trades */}
        <div className="rounded-xl bg-card/60 border border-border/40 p-4 flex flex-col min-w-0">
          <h3 className="text-sm font-semibold mb-3">Best &amp; worst trades</h3>
          <div className="grid grid-cols-2 gap-x-6 min-w-0">
            <div className="min-w-0">
              <PeriodMiniHeader label="Period A" />
              <BestWorstBlock bw={aBW} />
            </div>
            <div className="min-w-0">
              <PeriodMiniHeader label="Period B" />
              <BestWorstBlock bw={bBW} />
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

/* ----------------------------- Sub-components ----------------------------- */

const PeriodColumnHeader: React.FC<{ label: string; range: string }> = ({ label, range }) => (
  <div className="flex items-baseline justify-between gap-3 px-1">
    <div className="text-xs font-bold uppercase tracking-wide text-primary">{label}</div>
    <div className="text-[11px] text-muted-foreground tabular-nums truncate">{range}</div>
  </div>
);

const PeriodMiniHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2 px-0.5">
    {label}
  </div>
);

const MetricTile: React.FC<{
  label: string;
  value: string;
  pnl?: number;
  delta?: Delta;
  pctSuffix?: string;
}> = ({ label, value, pnl, delta, pctSuffix = "%" }) => (
  <div className="rounded-xl bg-card/60 border border-border/40 px-3 py-2.5 flex flex-col gap-1 min-w-0">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">
      {label}
    </div>
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span
        className={cn(
          "tabular-nums font-mono font-semibold text-sm truncate",
          pnl !== undefined ? pnlTextColor(pnl) : "",
        )}
      >
        {value}
      </span>
      {delta && (
        <span
          className={cn(
            "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tabular-nums",
            deltaBgChip(delta),
          )}
        >
          {delta.direction === "unchanged"
            ? "—"
            : delta.pct !== null
              ? `${deltaSign(delta.pct)}${Math.abs(delta.pct).toFixed(1)}${pctSuffix}`
              : `${deltaSign(delta.abs)}${formatNumber(Math.abs(delta.abs))}`}
        </span>
      )}
    </div>
  </div>
);

/* --------------------------- Per-asset (single side) --------------------------- */

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
    rows.push({
      asset,
      pnl,
      trades: ts.length,
      winRate: ts.length ? wins / ts.length : 0,
    });
  });
  rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return rows;
}

const AssetTable: React.FC<{ rows: AssetRow[] }> = ({ rows }) => {
  if (!rows.length) {
    return <div className="text-xs text-muted-foreground py-4">No trades.</div>;
  }
  return (
    <div className="overflow-hidden">
      <table className="w-full text-xs table-fixed">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="py-1 font-medium w-[38%] truncate">Asset</th>
            <th className="py-1 font-medium text-right w-[28%]">P&amp;L</th>
            <th className="py-1 font-medium text-right w-[16%]">Trades</th>
            <th className="py-1 font-medium text-right w-[18%]">WR</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((r) => (
            <tr key={r.asset} className="border-t border-border/30">
              <td className="py-1.5 font-medium truncate pr-2">{r.asset}</td>
              <td className={cn("py-1.5 text-right tabular-nums font-mono", pnlTextColor(r.pnl))}>
                {formatPnL(r.pnl)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.trades}</td>
              <td className="py-1.5 text-right tabular-nums">{(r.winRate * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------ Best / worst ------------------------------ */

const BestWorstBlock: React.FC<{ bw: { best: Trade | null; worst: Trade | null } }> = ({ bw }) => {
  if (!bw.best && !bw.worst) {
    return <div className="text-xs text-muted-foreground py-4">No trades.</div>;
  }
  return (
    <div className="space-y-1">
      {bw.best && (
        <div className="flex items-center justify-between gap-2 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">
                {bw.best.pair} · {bw.best.direction}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(bw.best.openTime || bw.best.date), "MMM d, yyyy")}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-emerald-500">
            {formatPnL(bw.best.result)}
          </span>
        </div>
      )}
      {bw.worst && bw.worst.id !== bw.best?.id && (
        <div className="flex items-center justify-between gap-2 py-1.5 border-t border-border/30">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">
                {bw.worst.pair} · {bw.worst.direction}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(bw.worst.openTime || bw.worst.date), "MMM d, yyyy")}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-red-500">
            {formatPnL(bw.worst.result)}
          </span>
        </div>
      )}
    </div>
  );
};

/* ------------------------------- Helpers ------------------------------- */

function slotLabel(
  s: SlotConfig,
  mode: CompareMode,
  accounts: TradingAccount[],
  fallback: string,
): string {
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
