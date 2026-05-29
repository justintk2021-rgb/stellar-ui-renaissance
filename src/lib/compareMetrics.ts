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

const fmtPctPoints = (n: number) =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)} pp`;

const fmtPF = (n: number) =>
  !isFinite(n) ? "∞" : n.toFixed(2);

export type InsightTone = "positive" | "negative" | "neutral" | "advice";

export interface CompareInsight {
  id: string;
  title: string;
  analysis: string;
  advice?: string;
  tone: InsightTone;
}

const pushInsight = (
  list: CompareInsight[],
  insight: CompareInsight,
  max = 5,
) => {
  if (list.length < max) list.push(insight);
};

const bestBucket = (buckets: { label: string; count: number; pnl: number }[]) => {
  const active = buckets.filter((b) => b.count > 0);
  if (!active.length) return null;
  return active.reduce((best, b) => (b.pnl > best.pnl ? b : best), active[0]);
};

const worstBucket = (buckets: { label: string; count: number; pnl: number }[]) => {
  const active = buckets.filter((b) => b.count > 0);
  if (!active.length) return null;
  return active.reduce((worst, b) => (b.pnl < worst.pnl ? b : worst), active[0]);
};

const riskReward = (stats: PeriodStats) => {
  if (!stats.avgLoss) return stats.avgWin > 0 ? Infinity : 0;
  return stats.avgWin / Math.abs(stats.avgLoss);
};

/** Rich, actionable comparison insights between two periods. */
export const buildCompareInsights = (
  aStats: PeriodStats,
  bStats: PeriodStats,
  aTrades: Trade[],
  bTrades: Trade[],
  aLabel: string,
  bLabel: string,
  opts?: { aDays?: number; bDays?: number },
): CompareInsight[] => {
  const out: CompareInsight[] = [];
  const aDays = opts?.aDays ?? aStats.uniqueDays;
  const bDays = opts?.bDays ?? bStats.uniqueDays;
  const lengthMismatch = aDays !== bDays && aDays > 0 && bDays > 0;

  if (aStats.totalTrades === 0 && bStats.totalTrades === 0) {
    return [{
      id: "empty",
      title: "No data",
      analysis: "Neither period has trades yet.",
      advice: "Log 5–10 trades in each month before comparing.",
      tone: "neutral",
    }];
  }

  if (aStats.totalTrades === 0 || bStats.totalTrades === 0) {
    const empty = aStats.totalTrades === 0 ? aLabel : bLabel;
    const active = aStats.totalTrades === 0 ? bLabel : aLabel;
    return [{
      id: "one-sided",
      title: "One-sided",
      analysis: `${empty} has no trades; only ${active} has data.`,
      advice: "Pick two active months for a fair comparison.",
      tone: "neutral",
    }];
  }

  const pnlDelta = computeDelta(aStats.netPnL, bStats.netPnL, "netPnL");
  const wrDelta = computeDelta(aStats.winRate, bStats.winRate, "winRate");
  const pfDelta = computeDelta(
    isFinite(aStats.profitFactor) ? aStats.profitFactor : 0,
    isFinite(bStats.profitFactor) ? bStats.profitFactor : 0,
    "profitFactor",
  );
  const expDelta = computeDelta(aStats.expectancy, bStats.expectancy, "expectancy");
  const tradeDelta = computeDelta(aStats.totalTrades, bStats.totalTrades, "neutral");
  const aDaily = aDays ? aStats.netPnL / aDays : 0;
  const bDaily = bDays ? bStats.netPnL / bDays : 0;

  // —— 1. Executive summary ——
  const winner =
    bStats.netPnL > aStats.netPnL ? bLabel :
    aStats.netPnL > bStats.netPnL ? aLabel : null;

  let summaryAnalysis = winner
    ? `${winner} ahead by ${fmtMoney(Math.abs(pnlDelta.abs))} (${fmtMoney(aStats.netPnL)} → ${fmtMoney(bStats.netPnL)}).`
    : `Near breakeven (${fmtMoney(aStats.netPnL)} vs ${fmtMoney(bStats.netPnL)}).`;

  if (lengthMismatch) {
    summaryAnalysis += ` Per day: ${fmtMoney(aDaily)} vs ${fmtMoney(bDaily)}.`;
  }

  summaryAnalysis += ` WR ${(aStats.winRate * 100).toFixed(0)}% → ${(bStats.winRate * 100).toFixed(0)}%.`;

  let summaryAdvice: string | undefined;
  if (pnlDelta.direction === "improved") {
    summaryAdvice = `Note what worked in ${bLabel} and repeat it.`;
  } else if (pnlDelta.direction === "regressed") {
    summaryAdvice = `Compare logs — find setups you stopped taking in ${bLabel}.`;
  }

  pushInsight(out, {
    id: "summary",
    title: "Overview",
    analysis: summaryAnalysis,
    advice: summaryAdvice,
    tone: pnlDelta.direction === "improved" ? "positive" : pnlDelta.direction === "regressed" ? "negative" : "neutral",
  });

  // —— 2. Edge & consistency ——
  const aPF = aStats.profitFactor;
  const bPF = bStats.profitFactor;
  const edgeAnalysis =
    `PF ${fmtPF(aPF)} → ${fmtPF(bPF)} · Exp ${fmtMoney(aStats.expectancy)} → ${fmtMoney(bStats.expectancy)}.`;

  let edgeAdvice: string | undefined;
  if (bPF < 1 && isFinite(bPF)) {
    edgeAdvice = "Cut weak setups until PF is back above 1.";
  } else if (pfDelta.direction === "improved" && bPF >= 1.5) {
    edgeAdvice = "Strong edge — keep sizing steady.";
  } else if (wrDelta.direction === "regressed" && expDelta.direction !== "regressed") {
    edgeAdvice = "Lower WR but better expectancy — let winners run.";
  } else if (wrDelta.direction === "improved" && expDelta.direction === "regressed") {
    edgeAdvice = "More wins, smaller payoffs — review exits.";
  }

  pushInsight(out, {
    id: "edge",
    title: "Edge",
    analysis: edgeAnalysis,
    advice: edgeAdvice,
    tone: pfDelta.direction === "improved" ? "positive" : pfDelta.direction === "regressed" ? "negative" : "neutral",
  });

  // —— 3. Risk / reward ——
  const aRR = riskReward(aStats);
  const bRR = riskReward(bStats);
  const rrDelta = computeDelta(isFinite(aRR) ? aRR : 0, isFinite(bRR) ? bRR : 0, "higher-better");

  if (aStats.avgWin > 0 || aStats.avgLoss < 0 || bStats.avgWin > 0 || bStats.avgLoss < 0) {
    let rrAdvice: string | undefined;
    const avgLossDelta = computeDelta(aStats.avgLoss, bStats.avgLoss, "avgLoss");

    if (avgLossDelta.direction === "regressed") {
      rrAdvice = `Avg loss up to ${fmtMoney(bStats.avgLoss)} — tighten stops or size.`;
    } else if (bRR < 1 && isFinite(bRR)) {
      rrAdvice = "R:R below 1:1 — improve entries or targets.";
    } else if (rrDelta.direction === "improved" && bRR >= 1.5) {
      rrAdvice = "Solid R:R — keep exit discipline.";
    }

    pushInsight(out, {
      id: "risk-reward",
      title: "R:R",
      analysis:
        `Win ${fmtMoney(aStats.avgWin)} → ${fmtMoney(bStats.avgWin)} · ` +
        `Loss ${fmtMoney(aStats.avgLoss)} → ${fmtMoney(bStats.avgLoss)} · ` +
        `R:R ${isFinite(aRR) ? aRR.toFixed(1) : "∞"} → ${isFinite(bRR) ? bRR.toFixed(1) : "∞"}.`,
      advice: rrAdvice,
      tone: rrDelta.direction === "improved" ? "positive" : avgLossDelta.direction === "regressed" ? "negative" : "neutral",
    });
  }

  // —— 4. Trade frequency ——
  if (
    tradeDelta.pct !== null &&
    Math.abs(tradeDelta.pct) >= 15 &&
    (aStats.totalTrades >= 3 || bStats.totalTrades >= 3)
  ) {
    const freqUp = tradeDelta.abs > 0;
    const pnlPerTradeA = aStats.expectancy;
    const pnlPerTradeB = bStats.expectancy;
    let freqAdvice: string | undefined;

    if (freqUp && pnlDelta.direction === "regressed") {
      freqAdvice = "More trades, worse P&L — cap daily volume.";
    } else if (freqUp && pnlDelta.direction === "improved") {
      freqAdvice = "Higher volume worked — watch quality weekly.";
    } else if (!freqUp && pnlDelta.direction === "improved") {
      freqAdvice = "Fewer trades, better results — stay selective.";
    }

    pushInsight(out, {
      id: "frequency",
      title: "Volume",
      analysis:
        `${aStats.totalTrades} → ${bStats.totalTrades} trades (${freqUp ? "+" : ""}${tradeDelta.pct?.toFixed(0)}%) · ` +
        `${aStats.avgTradesPerDay.toFixed(1)} → ${bStats.avgTradesPerDay.toFixed(1)}/day.`,
      advice: freqAdvice,
      tone: freqUp && pnlDelta.direction === "regressed" ? "negative" : "neutral",
    });
  }

  // —— 5. Pair / asset breakdown ——
  const assetRows = buildGroupBreakdown(aTrades, bTrades, (t) => t.pair);
  const topGainer = assetRows.find((r) => r.pnlDelta > 0 && (r.aTrades > 0 || r.bTrades > 0));
  const topLoser = assetRows.find((r) => r.pnlDelta < 0 && (r.aTrades > 0 || r.bTrades > 0));

  if (topGainer || topLoser) {
    const parts: string[] = [];
    if (topGainer) {
      parts.push(
        `${topGainer.key} +${fmtMoney(topGainer.pnlDelta)} (${fmtMoney(topGainer.aPnL)} → ${fmtMoney(topGainer.bPnL)})`,
      );
    }
    if (topLoser) {
      parts.push(
        `${topLoser.key} ${fmtMoney(topLoser.pnlDelta)} (${fmtMoney(topLoser.aPnL)} → ${fmtMoney(topLoser.bPnL)})`,
      );
    }

    let pairAdvice: string | undefined;
    if (topLoser && topLoser.bPnL < 0 && topLoser.bTrades >= 3) {
      pairAdvice = `Reduce size or pause ${topLoser.key}.`;
    }
    if (topGainer && topGainer.bPnL > 0 && !pairAdvice) {
      pairAdvice = `Lean into ${topGainer.key} setups.`;
    }

    pushInsight(out, {
      id: "pairs",
      title: "Pairs",
      analysis: parts.join(" · "),
      advice: pairAdvice,
      tone: topLoser && !topGainer ? "negative" : topGainer && !topLoser ? "positive" : "neutral",
    });
  }

  // —— 6. Session timing ——
  const aSessions = buildSessionBuckets(aTrades);
  const bSessions = buildSessionBuckets(bTrades);
  const aBest = bestBucket(aSessions);
  const bBest = bestBucket(bSessions);
  const aWorst = worstBucket(aSessions);
  const bWorst = worstBucket(bSessions);

  if (aBest && bBest && (aBest.count >= 2 || bBest.count >= 2)) {
    const sessionShift = aBest.label !== bBest.label;
    let sessionAdvice: string | undefined;

    if (sessionShift && bBest.pnl > 0) {
      sessionAdvice = `Edge moved to ${bBest.label} — protect that window.`;
    }
    if (bWorst && bWorst.pnl < 0 && bWorst.count >= 2) {
      sessionAdvice = (sessionAdvice ? sessionAdvice + " " : "") +
        `Cut size in ${bWorst.label} (${fmtMoney(bWorst.pnl)}).`;
    }

    pushInsight(out, {
      id: "sessions",
      title: "Sessions",
      analysis: sessionShift
        ? `Best: ${aBest.label} → ${bBest.label} (${fmtMoney(bBest.pnl)}).`
        : `${bBest.label} still strongest (${fmtMoney(bBest.pnl)}).`,
      advice: sessionAdvice,
      tone: bBest.pnl > 0 && sessionShift ? "advice" : "neutral",
    });
  }

  // —— 7. Day-of-week pattern ——
  const aDow = buildDayOfWeekBuckets(aTrades);
  const bDow = buildDayOfWeekBuckets(bTrades);
  const aBestDay = bestBucket(aDow.map((d) => ({ label: d.day, count: d.count, pnl: d.pnl })));
  const bBestDay = bestBucket(bDow.map((d) => ({ label: d.day, count: d.count, pnl: d.pnl })));
  const bWorstDay = worstBucket(bDow.map((d) => ({ label: d.day, count: d.count, pnl: d.pnl })));

  if (bWorstDay && bWorstDay.pnl < 0 && bWorstDay.count >= 2) {
    pushInsight(out, {
      id: "dow",
      title: "Weekdays",
      analysis: `${bWorstDay.label}s weakest (${fmtMoney(bWorstDay.pnl)})${bBestDay ? ` · ${bBestDay.label}s best (${fmtMoney(bBestDay.pnl)}).` : "."}`,
      advice: `Light size on ${bWorstDay.label}s; plan A+ setups on ${bBestDay?.label ?? "strong"} days.`,
      tone: "advice",
    });
  }

  // —— 8. Profit concentration / consistency ——
  const concentrationFor = (trades: Trade[], label: string) => {
    if (trades.length < 4) return null;
    const winners = trades.filter((t) => t.result > 0).sort((a, b) => b.result - a.result);
    if (winners.length < 3) return null;
    const top3 = winners.slice(0, 3).reduce((s, t) => s + t.result, 0);
    const grossWin = winners.reduce((s, t) => s + t.result, 0);
    if (grossWin <= 0) return null;
    const share = top3 / grossWin;
    if (share >= 0.65) return { label, share, count: winners.length };
    return null;
  };

  const bConc = concentrationFor(bTrades, bLabel);
  if (bConc) {
    pushInsight(out, {
      id: "concentration",
      title: "Consistency",
      analysis: `${(bConc.share * 100).toFixed(0)}% of profit from top 3 winners.`,
      advice: "Don't scale up on a few big wins — repeat the process.",
      tone: "advice",
    });
  }

  // —— 9. Direction bias ——
  if (Math.abs(aStats.longRatio - bStats.longRatio) >= 0.2 && aStats.totalTrades >= 5 && bStats.totalTrades >= 5) {
    const longDelta = computeDelta(aStats.longRatio, bStats.longRatio, "neutral");
    pushInsight(out, {
      id: "direction",
      title: "Bias",
      analysis:
        `Long ${(aStats.longRatio * 100).toFixed(0)}% → ${(bStats.longRatio * 100).toFixed(0)}%.`,
      advice: longDelta.abs > 0.25
        ? "Trade the setup, not a directional habit."
        : undefined,
      tone: "neutral",
    });
  }

  // —— 10. Holding time ——
  if (aStats.avgHoldingMinutes > 0 && bStats.avgHoldingMinutes > 0) {
    const holdDelta = computeDelta(aStats.avgHoldingMinutes, bStats.avgHoldingMinutes, "neutral");
    if (holdDelta.pct !== null && Math.abs(holdDelta.pct) >= 25) {
      const fmtHold = (m: number) =>
        m < 60 ? `${Math.round(m)}m` : `${(m / 60).toFixed(1)}h`;
      pushInsight(out, {
        id: "holding",
        title: "Hold time",
        analysis: `${fmtHold(aStats.avgHoldingMinutes)} → ${fmtHold(bStats.avgHoldingMinutes)} (${holdDelta.pct > 0 ? "+" : ""}${holdDelta.pct.toFixed(0)}%).`,
        advice: holdDelta.abs > 0 && pnlDelta.direction === "regressed"
          ? "Longer holds, worse P&L — review exit rules."
          : holdDelta.abs < 0 && pnlDelta.direction === "improved"
            ? "Shorter holds helped — keep exits decisive."
            : undefined,
        tone: "neutral",
      });
    }
  }

  // Length mismatch note as final advice insight
  if (lengthMismatch && out.length < 5) {
    pushInsight(out, {
      id: "length-note",
      title: "Period length",
      analysis: `${aDays} vs ${bDays} days — per-day figures normalize totals.`,
      advice: "Use full months or equal windows for fair compares.",
      tone: "neutral",
    });
  }

  return out.slice(0, 5);
};

/** @deprecated Use buildCompareInsights — kept for compatibility */
export const buildInsights = (
  aStats: PeriodStats,
  bStats: PeriodStats,
  aTrades: Trade[],
  bTrades: Trade[],
  aLabel: string,
  bLabel: string,
): string[] =>
  buildCompareInsights(aStats, bStats, aTrades, bTrades, aLabel, bLabel).map(
    (i) => (i.advice ? `${i.analysis} ${i.advice}` : i.analysis),
  );

export { fmtPct, fmtMoney };
