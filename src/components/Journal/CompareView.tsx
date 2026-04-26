import { useEffect, useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import type { TradingAccount } from "@/hooks/useTradingAccounts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar as CalendarIcon,
  Wallet,
  Tag,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, differenceInCalendarDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IOSDatePicker } from "./IOSDatePicker";
import {
  formatLocalDateKey,
  getTradeLocalDateKey,
  formatPnL,
  parseLocalDateKey,
} from "@/lib/tradeFormat";
import {
  computePeriodStats,
  computeDelta,
  buildEquityCurve,
  buildGroupBreakdown,
  buildDayOfWeekBuckets,
  buildSessionBuckets,
  bestAndWorst,
  buildInsights,
  type Delta,
  type MetricDirection,
} from "@/lib/compareMetrics";

/* --------------------------------- Types --------------------------------- */

export type CompareMode = "range" | "account" | "tag" | "asset" | "dayOfWeek";

interface SlotConfig {
  // Date range (always required; used for non-range modes too as scoping window)
  start: Date;
  end: Date;
  // Mode-specific selector
  accountId?: string | null;
  tag?: string;
  asset?: string;
  /** 0=Sun..6=Sat */
  dayOfWeek?: number;
}

interface CompareViewProps {
  trades: Trade[]; // already scoped to current account selection from Index
  allAccountTrades: Trade[]; // ALL trades across accounts (for "account" mode)
  accounts: TradingAccount[];
  initialMode?: CompareMode;
  initialA?: SlotConfig;
  initialB?: SlotConfig;
  onClose: () => void;
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
  scopedTrades: Trade[], // already account-scoped
  allAccountTrades: Trade[], // unscoped, for "account" mode
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

const deltaColor = (d: Delta) =>
  d.direction === "improved"
    ? "text-emerald-500"
    : d.direction === "regressed"
      ? "text-red-500"
      : "text-muted-foreground";

const deltaSign = (n: number) => (n > 0 ? "+" : n < 0 ? "" : "");

const formatNumber = (n: number, digits = 2) => {
  if (!isFinite(n)) return "∞";
  return n.toFixed(digits);
};

/* ----------------------------- Sub-components ---------------------------- */

const StatDeltaCard: React.FC<{
  label: string;
  aValue: string;
  bValue: string;
  delta: Delta;
  pctSuffix?: string; // shown on % delta line
}> = ({ label, aValue, bValue, delta, pctSuffix = "%" }) => (
  <div className="rounded-xl bg-card/60 border border-border/40 p-4 flex flex-col gap-2 min-w-0">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
      {label}
    </div>
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground">A</span>
      <span className="tabular-nums font-mono font-medium">{aValue}</span>
    </div>
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground">B</span>
      <span className="tabular-nums font-mono font-medium">{bValue}</span>
    </div>
    <div className={cn("text-xs font-semibold tabular-nums mt-1", deltaColor(delta))}>
      {delta.direction === "unchanged"
        ? "—"
        : `${deltaSign(delta.abs)}${
            isFinite(delta.abs) ? formatNumber(Math.abs(delta.abs), 2) : "∞"
          }${
            delta.pct !== null
              ? ` (${deltaSign(delta.pct)}${Math.abs(delta.pct).toFixed(1)}${pctSuffix})`
              : ""
          }`}
    </div>
  </div>
);

const ModeButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
      active
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60",
    )}
  >
    {icon}
    {label}
  </button>
);

const RangePicker: React.FC<{
  label: string;
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
}> = ({ label, start, end, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draftS, setDraftS] = useState(start);
  const [draftE, setDraftE] = useState(end);
  useEffect(() => {
    setDraftS(start);
    setDraftE(end);
  }, [start, end]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center justify-between gap-2 rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-xs hover:bg-muted/70 transition-colors">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums font-medium text-foreground">
            {format(start, "MMM d")} → {format(end, "MMM d, yyyy")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-4 rounded-2xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <IOSDatePicker label="Start" value={draftS} onChange={setDraftS} />
            <div className="w-px self-stretch bg-border/40 mt-6" />
            <IOSDatePicker label="End" value={draftE} onChange={setDraftE} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                const [s, e] = draftS <= draftE ? [draftS, draftE] : [draftE, draftS];
                onChange(s, e);
                setOpen(false);
              }}
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* --------------------------------- Main --------------------------------- */

export function CompareView({
  trades,
  allAccountTrades,
  accounts,
  initialMode = "range",
  initialA,
  initialB,
  onClose,
  onChange,
}: CompareViewProps) {
  const today = new Date();

  const [mode, setMode] = useState<CompareMode>(initialMode);
  const [aSlot, setASlot] = useState<SlotConfig>(
    initialA || { start: subDays(today, 14), end: subDays(today, 8) },
  );
  const [bSlot, setBSlot] = useState<SlotConfig>(
    initialB || { start: subDays(today, 7), end: today },
  );

  // Derive available tags & assets across the broader trade pool
  const { availableAssets, availableTags } = useMemo(() => {
    const assetSet = new Set<string>();
    const tagSet = new Set<string>();
    allAccountTrades.forEach((t) => {
      if (t.pair) assetSet.add(t.pair);
      if (t.session) tagSet.add(t.session);
    });
    return {
      availableAssets: Array.from(assetSet).sort(),
      availableTags: Array.from(tagSet).sort(),
    };
  }, [allAccountTrades]);

  // Push state to URL + parent
  useEffect(() => {
    const state = { mode, a: aSlot, b: bSlot };
    writeCompareToURL(state);
    onChange?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, aSlot, bSlot]);

  /* ------------------------------ Presets ------------------------------ */
  const applyPreset = (preset: "thisVsLastMonth" | "thisVsLastWeek" | "last30VsPrev30") => {
    const now = new Date();
    if (preset === "thisVsLastMonth") {
      const aStart = startOfMonth(subMonths(now, 1));
      const aEnd = endOfMonth(subMonths(now, 1));
      const bStart = startOfMonth(now);
      const bEnd = now;
      setASlot((s) => ({ ...s, start: aStart, end: aEnd }));
      setBSlot((s) => ({ ...s, start: bStart, end: bEnd }));
    } else if (preset === "thisVsLastWeek") {
      const aStart = startOfWeek(subWeeks(now, 1));
      const aEnd = endOfWeek(subWeeks(now, 1));
      const bStart = startOfWeek(now);
      const bEnd = now;
      setASlot((s) => ({ ...s, start: aStart, end: aEnd }));
      setBSlot((s) => ({ ...s, start: bStart, end: bEnd }));
    } else if (preset === "last30VsPrev30") {
      const bEnd = now;
      const bStart = subDays(now, 29);
      const aEnd = subDays(bStart, 1);
      const aStart = subDays(aEnd, 29);
      setASlot((s) => ({ ...s, start: aStart, end: aEnd }));
      setBSlot((s) => ({ ...s, start: bStart, end: bEnd }));
    }
  };

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

  /* ------------------------- Equity overlay data ----------------------- */
  const equityData = useMemo(() => {
    const aPts = buildEquityCurve(aTrades);
    const bPts = buildEquityCurve(bTrades);
    const maxLen = Math.max(aPts.length, bPts.length);
    const out: { step: number; A?: number; B?: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      out.push({
        step: i,
        A: aPts[i]?.cumulative,
        B: bPts[i]?.cumulative,
      });
    }
    return out;
  }, [aTrades, bTrades]);

  /* ------------------------------ Groups ------------------------------- */
  const assetRows = useMemo(
    () => buildGroupBreakdown(aTrades, bTrades, (t) => t.pair),
    [aTrades, bTrades],
  );
  const tagRows = useMemo(
    () => buildGroupBreakdown(aTrades, bTrades, (t) => t.session),
    [aTrades, bTrades],
  );

  /* ----------------------------- Behavior ------------------------------ */
  const aDow = useMemo(() => buildDayOfWeekBuckets(aTrades), [aTrades]);
  const bDow = useMemo(() => buildDayOfWeekBuckets(bTrades), [bTrades]);
  const aSessions = useMemo(() => buildSessionBuckets(aTrades), [aTrades]);
  const bSessions = useMemo(() => buildSessionBuckets(bTrades), [bTrades]);

  /* --------------------------- Best / Worst ---------------------------- */
  const aBW = useMemo(() => bestAndWorst(aTrades), [aTrades]);
  const bBW = useMemo(() => bestAndWorst(bTrades), [bTrades]);

  /* --------------------------- Renders --------------------------- */

  const renderModeSelector = () => (
    <div className="flex flex-wrap gap-1.5">
      <ModeButton
        active={mode === "range"}
        onClick={() => setMode("range")}
        icon={<CalendarIcon className="w-3.5 h-3.5" />}
        label="Date range"
      />
      <ModeButton
        active={mode === "account"}
        onClick={() => setMode("account")}
        icon={<Wallet className="w-3.5 h-3.5" />}
        label="Account"
      />
      <ModeButton
        active={mode === "tag"}
        onClick={() => setMode("tag")}
        icon={<Tag className="w-3.5 h-3.5" />}
        label="Tag / setup"
      />
      <ModeButton
        active={mode === "asset"}
        onClick={() => setMode("asset")}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        label="Asset"
      />
      <ModeButton
        active={mode === "dayOfWeek"}
        onClick={() => setMode("dayOfWeek")}
        icon={<Clock className="w-3.5 h-3.5" />}
        label="Day of week"
      />
    </div>
  );

  const renderSlotSelector = (
    slot: SlotConfig,
    setSlot: React.Dispatch<React.SetStateAction<SlotConfig>>,
    title: string,
  ) => (
    <div className="rounded-xl bg-card/60 border border-border/40 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {differenceInCalendarDays(slot.end, slot.start) + 1}d
        </div>
      </div>
      <RangePicker
        label="Range"
        start={slot.start}
        end={slot.end}
        onChange={(start, end) => setSlot((s) => ({ ...s, start, end }))}
      />
      {mode === "account" && (
        <select
          value={slot.accountId || ""}
          onChange={(e) => setSlot((s) => ({ ...s, accountId: e.target.value || undefined }))}
          className="w-full rounded-lg bg-muted/40 border border-border/40 px-2.5 py-2 text-xs"
        >
          <option value="">Select account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      {mode === "asset" && (
        <select
          value={slot.asset || ""}
          onChange={(e) => setSlot((s) => ({ ...s, asset: e.target.value || undefined }))}
          className="w-full rounded-lg bg-muted/40 border border-border/40 px-2.5 py-2 text-xs"
        >
          <option value="">Select asset…</option>
          {availableAssets.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      )}
      {mode === "tag" && (
        <select
          value={slot.tag || ""}
          onChange={(e) => setSlot((s) => ({ ...s, tag: e.target.value || undefined }))}
          className="w-full rounded-lg bg-muted/40 border border-border/40 px-2.5 py-2 text-xs"
        >
          <option value="">Select tag…</option>
          {availableTags.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      )}
      {mode === "dayOfWeek" && (
        <select
          value={slot.dayOfWeek ?? ""}
          onChange={(e) =>
            setSlot((s) => ({
              ...s,
              dayOfWeek: e.target.value === "" ? undefined : Number(e.target.value),
            }))
          }
          className="w-full rounded-lg bg-muted/40 border border-border/40 px-2.5 py-2 text-xs"
        >
          <option value="">Day of week…</option>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      )}
    </div>
  );

  /* ----------------------------- Layout JSX ----------------------------- */
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex gap-6"
    >
      {/* Left: Compare main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header / Exit */}
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold">Compare:</span>
            <span className="text-muted-foreground">{aLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{bLabel}</span>
          </div>
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

        {/* A. Auto-generated insight */}
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
            <div className="mt-2 text-[11px] text-muted-foreground italic">
              Period A is {aDays} days, Period B is {bDays} days — some metrics are normalized per-day.
            </div>
          )}
        </section>

        {/* B. Headline stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatDeltaCard
            label="Net P&L"
            aValue={formatPnL(aStats.netPnL)}
            bValue={formatPnL(bStats.netPnL)}
            delta={computeDelta(aStats.netPnL, bStats.netPnL, "netPnL")}
          />
          <StatDeltaCard
            label="Win Rate"
            aValue={`${(aStats.winRate * 100).toFixed(1)}%`}
            bValue={`${(bStats.winRate * 100).toFixed(1)}%`}
            delta={computeDelta(aStats.winRate, bStats.winRate, "winRate")}
            pctSuffix="pp"
          />
          <StatDeltaCard
            label="Profit Factor"
            aValue={isFinite(aStats.profitFactor) ? aStats.profitFactor.toFixed(2) : "∞"}
            bValue={isFinite(bStats.profitFactor) ? bStats.profitFactor.toFixed(2) : "∞"}
            delta={computeDelta(
              isFinite(aStats.profitFactor) ? aStats.profitFactor : 0,
              isFinite(bStats.profitFactor) ? bStats.profitFactor : 0,
              "profitFactor",
            )}
          />
          <StatDeltaCard
            label="Expectancy"
            aValue={formatPnL(aStats.expectancy)}
            bValue={formatPnL(bStats.expectancy)}
            delta={computeDelta(aStats.expectancy, bStats.expectancy, "expectancy")}
          />
          <StatDeltaCard
            label="Avg Win"
            aValue={formatPnL(aStats.avgWin)}
            bValue={formatPnL(bStats.avgWin)}
            delta={computeDelta(aStats.avgWin, bStats.avgWin, "avgWin")}
          />
          <StatDeltaCard
            label="Avg Loss"
            aValue={formatPnL(aStats.avgLoss)}
            bValue={formatPnL(bStats.avgLoss)}
            delta={computeDelta(aStats.avgLoss, bStats.avgLoss, "avgLoss")}
          />
          <StatDeltaCard
            label="Total Trades"
            aValue={String(aStats.totalTrades)}
            bValue={String(bStats.totalTrades)}
            delta={computeDelta(aStats.totalTrades, bStats.totalTrades, "neutral")}
          />
          <StatDeltaCard
            label="Trades / Day"
            aValue={aStats.avgTradesPerDay.toFixed(2)}
            bValue={bStats.avgTradesPerDay.toFixed(2)}
            delta={computeDelta(aStats.avgTradesPerDay, bStats.avgTradesPerDay, "neutral")}
          />
        </section>

        {/* C. Equity overlay */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Cumulative P&L (normalized to $0)</h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">{aLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                <span className="text-muted-foreground">{bLabel}</span>
              </span>
            </div>
          </div>
          <div className="h-64">
            {equityData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis
                    dataKey="step"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      formatPnL(Number(value)),
                      name === "A" ? aLabel : bLabel,
                    ]}
                    labelFormatter={(l) => `Trade #${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="B"
                    stroke="hsl(var(--primary) / 0.45)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Not enough trade data to plot.
              </div>
            )}
          </div>
        </section>

        {/* D. Per-asset breakdown */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4">
          <h3 className="text-sm font-semibold mb-3">Per-asset breakdown</h3>
          <GroupTable rows={assetRows} keyHeader="Asset" />
        </section>

        {/* E. Per-tag breakdown */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4">
          <h3 className="text-sm font-semibold mb-3">Per-tag / setup breakdown</h3>
          {tagRows.length ? (
            <GroupTable rows={tagRows} keyHeader="Tag" />
          ) : (
            <div className="text-xs text-muted-foreground">No tags / sessions on these trades.</div>
          )}
        </section>

        {/* F. Side-by-side trade log */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4">
          <h3 className="text-sm font-semibold mb-3">Trade log — side by side</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SideTradeList title={`Period A · ${aLabel}`} trades={aTrades} />
            <SideTradeList title={`Period B · ${bLabel}`} trades={bTrades} />
          </div>
        </section>

        {/* G. Behavior metrics */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4 space-y-4">
          <h3 className="text-sm font-semibold">Behavior</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <BehaviorStat
              label="Avg holding time"
              aValue={aStats.avgHoldingMinutes ? formatHolding(aStats.avgHoldingMinutes) : "—"}
              bValue={bStats.avgHoldingMinutes ? formatHolding(bStats.avgHoldingMinutes) : "—"}
            />
            <BehaviorStat
              label="Long share"
              aValue={`${(aStats.longRatio * 100).toFixed(0)}%`}
              bValue={`${(bStats.longRatio * 100).toFixed(0)}%`}
            />
            <BehaviorStat
              label="Short share"
              aValue={`${(aStats.shortRatio * 100).toFixed(0)}%`}
              bValue={`${(bStats.shortRatio * 100).toFixed(0)}%`}
            />
            <BehaviorStat
              label="Active days"
              aValue={String(aStats.uniqueDays)}
              bValue={String(bStats.uniqueDays)}
            />
          </div>
          <BucketRow title="By day of week" aBuckets={aDow} bBuckets={bDow} />
          <BucketRow title="By session" aBuckets={aSessions} bBuckets={bSessions} />
        </section>

        {/* H. Best / worst trade */}
        <section className="rounded-xl bg-card/60 border border-border/40 p-4">
          <h3 className="text-sm font-semibold mb-3">Best & worst trades</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BestWorstBlock title={`Period A · ${aLabel}`} bw={aBW} />
            <BestWorstBlock title={`Period B · ${bLabel}`} bw={bBW} />
          </div>
        </section>
      </div>

      {/* Right: Selection panel (replaces mini calendar) */}
      <aside className="hidden lg:flex flex-col gap-3 w-72 flex-shrink-0">
        <div className="rounded-xl bg-card/60 border border-border/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Compare panel
            </div>
            <button
              onClick={() => {
                clearCompareFromURL();
                onClose();
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close compare"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              Mode
            </div>
            {renderModeSelector()}
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              Quick presets
            </div>
            <div className="flex flex-col gap-1.5">
              <PresetButton onClick={() => applyPreset("thisVsLastMonth")}>
                This month vs Last month
              </PresetButton>
              <PresetButton onClick={() => applyPreset("thisVsLastWeek")}>
                This week vs Last week
              </PresetButton>
              <PresetButton onClick={() => applyPreset("last30VsPrev30")}>
                Last 30 vs Previous 30
              </PresetButton>
            </div>
          </div>

          {renderSlotSelector(aSlot, setASlot, "Period A")}
          {renderSlotSelector(bSlot, setBSlot, "Period B")}
        </div>
      </aside>
    </motion.div>
  );
}

/* ----------------------------- Helper bits ----------------------------- */

function slotLabel(
  s: SlotConfig,
  mode: CompareMode,
  accounts: TradingAccount[],
  fallback: string,
): string {
  const range = `${format(s.start, "MMM d")}–${format(s.end, "MMM d")}`;
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

function formatHolding(minutes: number): string {
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const h = minutes / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

const PresetButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/40 transition-colors"
  >
    {children}
  </button>
);

const BehaviorStat: React.FC<{ label: string; aValue: string; bValue: string }> = ({ label, aValue, bValue }) => (
  <div className="rounded-lg bg-muted/20 border border-border/30 p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">{label}</div>
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground text-[11px]">A</span>
      <span className="tabular-nums font-mono">{aValue}</span>
    </div>
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground text-[11px]">B</span>
      <span className="tabular-nums font-mono">{bValue}</span>
    </div>
  </div>
);

const BucketRow: React.FC<{
  title: string;
  aBuckets: { count: number; pnl: number; day?: string; label?: string }[];
  bBuckets: { count: number; pnl: number; day?: string; label?: string }[];
}> = ({ title, aBuckets, bBuckets }) => {
  const maxCount = Math.max(
    ...aBuckets.map((b) => b.count),
    ...bBuckets.map((b) => b.count),
    1,
  );
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{title}</div>
      <div className="grid gap-1">
        {aBuckets.map((a, i) => {
          const b = bBuckets[i];
          const label = a.day || a.label || "";
          return (
            <div key={label} className="grid grid-cols-[60px_1fr_1fr] items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(a.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="tabular-nums w-6 text-right">{a.count}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-primary/45 rounded-full"
                    style={{ width: `${((b?.count || 0) / maxCount) * 100}%` }}
                  />
                </div>
                <span className="tabular-nums w-6 text-right">{b?.count || 0}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GroupTable: React.FC<{
  rows: ReturnType<typeof buildGroupBreakdown>;
  keyHeader: string;
}> = ({ rows, keyHeader }) => {
  if (!rows.length) {
    return <div className="text-xs text-muted-foreground">No data.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="py-1.5 font-medium">{keyHeader}</th>
            <th className="py-1.5 font-medium text-right">A P&L</th>
            <th className="py-1.5 font-medium text-right">B P&L</th>
            <th className="py-1.5 font-medium text-right">Δ P&L</th>
            <th className="py-1.5 font-medium text-right">A Trades</th>
            <th className="py-1.5 font-medium text-right">B Trades</th>
            <th className="py-1.5 font-medium text-right">A WR</th>
            <th className="py-1.5 font-medium text-right">B WR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const delta = computeDelta(r.aPnL, r.bPnL, "netPnL");
            return (
              <tr key={r.key} className="border-t border-border/30">
                <td className="py-1.5 font-medium">{r.key}</td>
                <td className="py-1.5 text-right tabular-nums font-mono">
                  <span className={r.aPnL > 0 ? "text-emerald-500" : r.aPnL < 0 ? "text-red-500" : ""}>
                    {formatPnL(r.aPnL)}
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums font-mono">
                  <span className={r.bPnL > 0 ? "text-emerald-500" : r.bPnL < 0 ? "text-red-500" : ""}>
                    {formatPnL(r.bPnL)}
                  </span>
                </td>
                <td className={cn("py-1.5 text-right tabular-nums font-mono font-semibold", deltaColor(delta))}>
                  {delta.direction === "unchanged" ? "—" : `${delta.abs > 0 ? "+" : ""}${formatPnL(delta.abs, { showPlus: false })}`}
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.aTrades}</td>
                <td className="py-1.5 text-right tabular-nums">{r.bTrades}</td>
                <td className="py-1.5 text-right tabular-nums">{(r.aWinRate * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right tabular-nums">{(r.bWinRate * 100).toFixed(0)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const SideTradeList: React.FC<{ title: string; trades: Trade[] }> = ({ title, trades }) => {
  // Group by date (YYYY-MM-DD) using shared helper for parity with main TradeTable
  const groups = useMemo(() => {
    const map = new Map<string, Trade[]>();
    trades.forEach((t) => {
      const k = getTradeLocalDateKey(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a > b ? -1 : 1));
  }, [trades]);

  return (
    <div className="rounded-lg bg-muted/15 border border-border/30 p-3 max-h-96 overflow-y-auto">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{title}</div>
      {groups.length === 0 && (
        <div className="text-xs text-muted-foreground py-8 text-center">No trades in this period.</div>
      )}
      <div className="space-y-2">
        {groups.map(([date, ts]) => {
          const total = ts.reduce((s, t) => s + (t.result || 0), 0);
          const wins = ts.filter((t) => t.result > 0).length;
          const wr = ts.length ? (wins / ts.length) * 100 : 0;
          return (
            <div key={date} className="rounded-md bg-card/60 border border-border/30 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{format(parseLocalDateKey(date), "MMM d, yyyy")}</span>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums font-semibold",
                    total > 0 ? "text-emerald-500" : total < 0 ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {formatPnL(total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{ts.length} trade{ts.length === 1 ? "" : "s"}</span>
                <span className="tabular-nums">Win {wr.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BestWorstBlock: React.FC<{ title: string; bw: { best: Trade | null; worst: Trade | null } }> = ({ title, bw }) => (
  <div className="rounded-lg bg-muted/15 border border-border/30 p-3">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{title}</div>
    {!bw.best && !bw.worst && (
      <div className="text-xs text-muted-foreground">No trades.</div>
    )}
    {bw.best && (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{bw.best.pair} · {bw.best.direction}</div>
            <div className="text-[10px] text-muted-foreground">
              {format(new Date(bw.best.openTime || bw.best.date), "MMM d")}
            </div>
          </div>
        </div>
        <span className="text-xs font-mono tabular-nums font-semibold text-emerald-500">
          {formatPnL(bw.best.result)}
        </span>
      </div>
    )}
    {bw.worst && bw.worst.id !== bw.best?.id && (
      <div className="flex items-center justify-between gap-3 py-1.5 border-t border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{bw.worst.pair} · {bw.worst.direction}</div>
            <div className="text-[10px] text-muted-foreground">
              {format(new Date(bw.worst.openTime || bw.worst.date), "MMM d")}
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
