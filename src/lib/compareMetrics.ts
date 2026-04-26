import { Trade } from "@/types/trade";
import { getTradeLocalDateKey, sumPnL } from "@/lib/tradeFormat";

/**
 * Aggregated stats for a single comparison period.
 * Always computed at full precision; round only at the display layer.
 */
export interface PeriodStats {
  netPnL: number;
  winRate: number; // 0..1
  profitFactor: number; // gross wins / |gross losses|, Infinity if no losses
  avgWin: number;
  avgLoss: number; // negative number (or 0)
  expectancy: number; // avg P&L per trade
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  uniqueDays: number;
  avgTradesPerDay: number;
  avgHoldingMinutes: number; // 0 if no open/close times
  longRatio: number; // 0..1 share of long trades
  shortRatio: number; // 0..1
}

export const computePeriodStats = (trades: Trade[]): PeriodStats => {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result > 0).length;
  const losses = trades.filter((t) => t.result < 0).length;
  const breakeven = trades.filter((t) => t.result === 0).length;
  const grossWin = trades
    .filter((t) => t.result > 0)
    .reduce((s, t) => s + t.result, 0);
  const grossLoss = trades
    .filter((t) => t.result < 0)
    .reduce((s, t) => s + t.result, 0);
  const netPnL = sumPnL(trades);
  const winRate = totalTrades ? wins / totalTrades : 0;
  const avgWin = wins ? grossWin / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;
  const expectancy = totalTrades ? netPnL / totalTrades : 0;
  const profitFactor =
    grossLoss === 0
      ? grossWin > 0
        ? Infinity
        : 0
      : grossWin / Math.abs(grossLoss);

  const dayKeys = new Set(trades.map(getTradeLocalDateKey).filter(Boolean));
  const uniqueDays = dayKeys.size;
  const avgTradesPerDay = uniqueDays ? totalTrades / uniqueDays : 0;

  // Holding time
  const withTimes = trades.filter((t) => t.openTime && t.closeTime);
  const avgHoldingMinutes = withTimes.length
    ? withTimes.reduce((s, t) => {
        const open = new Date(t.openTime!).getTime();
        const close = new Date(t.closeTime!).getTime();
        return s + Math.max(0, (close - open) / 60000);
      }, 0) / withTimes.length
    : 0;

  const longs = trades.filter((t) => t.direction === "Long").length;
  const shorts = trades.filter((t) => t.direction === "Short").length;
  const dirTotal = longs + shorts;
  const longRatio = dirTotal ? longs / dirTotal : 0;
  const shortRatio = dirTotal ? shorts / dirTotal : 0;

  return {
    netPnL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    totalTrades,
    wins,
    losses,
    breakeven,
    uniqueDays,
    avgTradesPerDay,
    avgHoldingMinutes,
    longRatio,
    shortRatio,
  };
};

/**
 * Per-metric directionality: when value goes UP from A to B,
 * is that an improvement (true) or a regression (false)?
 * Used to decide delta color (--win vs --loss).
 */
export type MetricDirection = "higher-better" | "lower-better" | "neutral";

export const METRIC_DIRECTION: Record<string, MetricDirection> = {
  netPnL: "higher-better",
  winRate: "higher-better",
  profitFactor: "higher-better",
  avgWin: "higher-better",
  avgLoss: "higher-better", // less negative = better
  expectancy: "higher-better",
  totalTrades: "neutral",
  avgTradesPerDay: "neutral",
  avgHoldingMinutes: "neutral",
};

export interface Delta {
  abs: number;
  pct: number | null; // null when A is 0 (undefined % change)
  direction: "improved" | "regressed" | "unchanged";
}

export const computeDelta = (
  a: number,
  b: number,
  metric: keyof typeof METRIC_DIRECTION | MetricDirection = "neutral",
): Delta => {
  const dir: MetricDirection =
    typeof metric === "string" && (metric === "higher-better" || metric === "lower-better" || metric === "neutral")
      ? metric
      : METRIC_DIRECTION[metric as string] || "neutral";
  const abs = b - a;
  const pct = a === 0 ? null : (abs / Math.abs(a)) * 100;
  let direction: Delta["direction"] = "unchanged";
  // Threshold to avoid coloring near-zero floating-point noise
  if (Math.abs(abs) > 1e-9) {
    if (dir === "higher-better") direction = abs > 0 ? "improved" : "regressed";
    else if (dir === "lower-better") direction = abs < 0 ? "improved" : "regressed";
    else direction = "unchanged";
  }
  return { abs, pct, direction };
};

/* ------------------------- Cumulative equity curve ------------------------- */

export interface EquityPoint {
  /** Position along the X axis: trade ordinal (1..N). Used so periods of
   *  different lengths render on the same axis. */
  step: number;
  cumulative: number;
  /** Full ISO timestamp (open time or trade.date) for tooltip. */
  ts: string;
}

export const buildEquityCurve = (trades: Trade[]): EquityPoint[] => {
  const sorted = [...trades].sort((a, b) => {
    const ta = a.openTime ? new Date(a.openTime).getTime() : new Date(a.date).getTime();
    const tb = b.openTime ? new Date(b.openTime).getTime() : new Date(b.date).getTime();
    return ta - tb;
  });
  let cum = 0;
  const points: EquityPoint[] = [{ step: 0, cumulative: 0, ts: sorted[0]?.openTime || sorted[0]?.date || "" }];
  sorted.forEach((t, i) => {
    cum += t.result || 0;
    points.push({
      step: i + 1,
      cumulative: cum,
      ts: t.openTime || t.date,
    });
  });
  return points;
};

/* --------------------------- Per-asset / per-tag --------------------------- */

export interface GroupRow {
  key: string;
  aPnL: number;
  bPnL: number;
  aTrades: number;
  bTrades: number;
  aWinRate: number;
  bWinRate: number;
  pnlDelta: number;
}

const groupBy = (trades: Trade[], keyFn: (t: Trade) => string | undefined) => {
  const map = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const k = keyFn(t);
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  });
  return map;
};

const winRateOf = (ts: Trade[]) =>
  ts.length ? ts.filter((t) => t.result > 0).length / ts.length : 0;

export const buildGroupBreakdown = (
  aTrades: Trade[],
  bTrades: Trade[],
  keyFn: (t: Trade) => string | undefined,
): GroupRow[] => {
  const aMap = groupBy(aTrades, keyFn);
  const bMap = groupBy(bTrades, keyFn);
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
  const rows: GroupRow[] = [];
  allKeys.forEach((key) => {
    const a = aMap.get(key) || [];
    const b = bMap.get(key) || [];
    const aPnL = sumPnL(a);
    const bPnL = sumPnL(b);
    rows.push({
      key,
      aPnL,
      bPnL,
      aTrades: a.length,
      bTrades: b.length,
      aWinRate: winRateOf(a),
      bWinRate: winRateOf(b),
      pnlDelta: bPnL - aPnL,
    });
  });
  // Sort by absolute pnl delta — biggest movers first
  rows.sort((x, y) => Math.abs(y.pnlDelta) - Math.abs(x.pnlDelta));
  return rows;
};

/* ---------------------- Day-of-week / hour-of-day buckets ------------------ */

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const buildDayOfWeekBuckets = (trades: Trade[]) => {
  const buckets = Array(7).fill(0).map((_, i) => ({ day: DAY_LABELS[i], count: 0, pnl: 0 }));
  trades.forEach((t) => {
    const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
    if (isNaN(d.getTime())) return;
    const i = d.getDay();
    buckets[i].count += 1;
    buckets[i].pnl += t.result || 0;
  });
  return buckets;
};

/** 4 buckets: Asia (00-08), London (08-13), NY (13-20), Late (20-24) */
export const buildSessionBuckets = (trades: Trade[]) => {
  const buckets = [
    { label: "Asia", count: 0, pnl: 0 },
    { label: "London", count: 0, pnl: 0 },
    { label: "NY", count: 0, pnl: 0 },
    { label: "Late", count: 0, pnl: 0 },
  ];
  trades.forEach((t) => {
    const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
    if (isNaN(d.getTime())) return;
    const h = d.getHours();
    const i = h < 8 ? 0 : h < 13 ? 1 : h < 20 ? 2 : 3;
    buckets[i].count += 1;
    buckets[i].pnl += t.result || 0;
  });
  return buckets;
};

/* --------------------------- Best / worst trades --------------------------- */

export const bestAndWorst = (trades: Trade[]): { best: Trade | null; worst: Trade | null } => {
  if (!trades.length) return { best: null, worst: null };
  let best = trades[0];
  let worst = trades[0];
  trades.forEach((t) => {
    if (t.result > best.result) best = t;
    if (t.result < worst.result) worst = t;
  });
  return { best, worst };
};

/* ------------------------- Auto-generated insights ------------------------- */

const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

const fmtMoney = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export const buildInsights = (
  aStats: PeriodStats,
  bStats: PeriodStats,
  aTrades: Trade[],
  bTrades: Trade[],
  aLabel: string,
  bLabel: string,
): string[] => {
  const out: string[] = [];

  // 1) Win rate change
  const wrDelta = computeDelta(aStats.winRate, bStats.winRate, "winRate");
  if (Math.abs(wrDelta.abs) > 0.005) {
    const verb = wrDelta.direction === "improved" ? "rose" : "dropped";
    // Try to attribute to top regressing asset
    const assetRows = buildGroupBreakdown(aTrades, bTrades, (t) => t.pair);
    const topNeg = assetRows.find((r) => r.pnlDelta < 0);
    const detail = topNeg && wrDelta.direction === "regressed"
      ? `, driven mainly by losses on ${topNeg.key}`
      : "";
    out.push(
      `Your win rate ${verb} ${Math.abs(wrDelta.abs * 100).toFixed(1)}% in ${bLabel} vs ${aLabel}${detail}.`,
    );
  }

  // 2) Trade count vs avg win
  const tradeDelta = computeDelta(aStats.totalTrades, bStats.totalTrades, "neutral");
  const avgWinDelta = computeDelta(aStats.avgWin, bStats.avgWin, "avgWin");
  if (
    aStats.totalTrades > 0 &&
    bStats.totalTrades > 0 &&
    tradeDelta.pct !== null &&
    Math.abs(tradeDelta.pct) >= 20 &&
    avgWinDelta.pct !== null &&
    Math.abs(avgWinDelta.pct) >= 15
  ) {
    const tDir = tradeDelta.abs > 0 ? "more" : "fewer";
    const wDir = avgWinDelta.abs > 0 ? "larger" : "smaller";
    const expWord = bStats.expectancy >= aStats.expectancy ? "up" : "down";
    out.push(
      `You took ${Math.abs(tradeDelta.pct).toFixed(0)}% ${tDir} trades in ${bLabel} but with ${Math.abs(avgWinDelta.pct).toFixed(0)}% ${wDir} average wins — expectancy is ${expWord}.`,
    );
  }

  // 3) Concentration insight on the better period
  const concentrationFor = (trades: Trade[], label: string) => {
    if (trades.length < 3) return null;
    const winners = trades.filter((t) => t.result > 0).sort((a, b) => b.result - a.result);
    if (winners.length < 3) return null;
    const top3 = winners.slice(0, 3).reduce((s, t) => s + t.result, 0);
    const grossWin = winners.reduce((s, t) => s + t.result, 0);
    if (grossWin <= 0) return null;
    const share = top3 / grossWin;
    if (share >= 0.7) {
      // Day-of-week pattern of those top3
      const days = winners.slice(0, 3).map((t) => {
        const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
        return DAY_LABELS[d.getDay()];
      });
      const sameDay = days.every((d) => d === days[0]);
      if (sameDay) {
        return `${label}'s gains came almost entirely from 3 trades on ${days[0]}s.`;
      }
      return `${label}'s gains came almost entirely from its top 3 trades.`;
    }
    return null;
  };
  const ai = concentrationFor(aTrades, aLabel);
  if (ai && out.length < 3) out.push(ai);
  if (out.length < 3) {
    const bi = concentrationFor(bTrades, bLabel);
    if (bi) out.push(bi);
  }

  // 4) Net P&L sign flip — high signal
  if (
    out.length < 3 &&
    Math.sign(aStats.netPnL) !== Math.sign(bStats.netPnL) &&
    aStats.totalTrades > 0 &&
    bStats.totalTrades > 0
  ) {
    out.unshift(
      `Net P&L flipped from ${fmtMoney(aStats.netPnL)} in ${aLabel} to ${fmtMoney(bStats.netPnL)} in ${bLabel}.`,
    );
  }

  // Fallback if nothing generated
  if (out.length === 0) {
    if (aStats.totalTrades === 0 && bStats.totalTrades === 0) {
      out.push("No trades in either period yet — log some trades to compare.");
    } else {
      const pnlDelta = computeDelta(aStats.netPnL, bStats.netPnL, "netPnL");
      out.push(
        `Net P&L ${pnlDelta.direction === "improved" ? "improved" : pnlDelta.direction === "regressed" ? "fell" : "was unchanged"} by ${fmtMoney(Math.abs(pnlDelta.abs))} from ${aLabel} to ${bLabel}.`,
      );
    }
  }

  return out.slice(0, 3);
};

export { fmtPct, fmtMoney };
