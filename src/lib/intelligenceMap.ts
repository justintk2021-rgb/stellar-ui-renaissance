import { Trade } from "@/types/trade";
import { getTradeLocalDateKey } from "@/lib/tradeFormat";

export type NodeType = "trade" | "setup" | "behavior" | "weekday" | "direction";
export type NodeSentiment = "positive" | "negative" | "neutral";

export interface MapNode {
  id: string;
  label: string;
  type: NodeType;
  sentiment: NodeSentiment;
  size: number;
  x: number;
  y: number;
  meta: {
    count?: number;
    pnl?: number;
    pair?: string;
    date?: string;
    notes?: string;
    detail?: string;
    winRate?: number;
  };
}

export interface MapEdge {
  from: string;
  to: string;
  strength: number;
}

export interface IntelligenceInsight {
  id: string;
  title: string;
  detail: string;
  sentiment: NodeSentiment | "advice";
  priority: number;
}

export interface IntelligenceSummary {
  healthScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  momentum: "improving" | "declining" | "stable";
  totalTrades: number;
  winRate: number;
  netPnL: number;
  profitFactor: number;
  expectancy: number;
  positiveSignals: number;
  negativeSignals: number;
}

export interface IntelligenceGraph {
  nodes: MapNode[];
  edges: MapEdge[];
  insights: IntelligenceInsight[];
  summary: IntelligenceSummary;
}

export interface BreakdownRow {
  id: string;
  label: string;
  category: NodeType;
  count: number;
  pnl: number;
  winRate: number;
  sentiment: NodeSentiment;
  detail?: string;
}

export interface HealthPillar {
  label: string;
  score: number;
  detail: string;
}

export interface IntelligenceBreakdown {
  pairs: BreakdownRow[];
  sessions: BreakdownRow[];
  weekdays: BreakdownRow[];
  directions: BreakdownRow[];
  strengths: BreakdownRow[];
  weaknesses: BreakdownRow[];
}

export function extractBreakdown(nodes: MapNode[]): IntelligenceBreakdown {
  const toRow = (n: MapNode): BreakdownRow => ({
    id: n.id,
    label: n.label,
    category: n.type,
    count: n.meta.count ?? 0,
    pnl: n.meta.pnl ?? 0,
    winRate: n.meta.winRate ?? 0,
    sentiment: n.sentiment,
    detail: n.meta.detail,
  });

  const pairs = nodes.filter((n) => n.type === "trade").map(toRow).sort((a, b) => b.pnl - a.pnl);
  const sessions = nodes.filter((n) => n.type === "setup").map(toRow).sort((a, b) => b.pnl - a.pnl);
  const weekdays = nodes.filter((n) => n.type === "weekday").map(toRow).sort((a, b) => b.pnl - a.pnl);
  const directions = nodes.filter((n) => n.type === "direction").map(toRow);
  const behaviors = nodes.filter((n) => n.type === "behavior" && n.id !== "core").map(toRow);

  return {
    pairs,
    sessions,
    weekdays,
    directions,
    strengths: behaviors.filter((b) => b.sentiment === "positive"),
    weaknesses: behaviors.filter((b) => b.sentiment === "negative"),
  };
}

export function buildHealthPillars(summary: IntelligenceSummary): HealthPillar[] {
  const pfScore =
    summary.profitFactor >= 999
      ? 100
      : Math.min(100, Math.max(0, (summary.profitFactor / 2.5) * 100));
  const wrScore = Math.min(100, summary.winRate * 1.15);
  const expScore = Math.min(100, Math.max(0, 50 + summary.expectancy * 3));
  const momScore =
    summary.momentum === "improving" ? 90 : summary.momentum === "declining" ? 25 : 58;
  const sampleScore = Math.min(100, summary.totalTrades * 3.5);

  return [
    { label: "Win Rate", score: Math.round(wrScore), detail: `${summary.winRate.toFixed(1)}%` },
    {
      label: "Profit Factor",
      score: Math.round(pfScore),
      detail: summary.profitFactor >= 999 ? "∞" : summary.profitFactor.toFixed(2),
    },
    { label: "Expectancy", score: Math.round(expScore), detail: `$${summary.expectancy.toFixed(0)}/trade` },
    { label: "Momentum", score: Math.round(momScore), detail: summary.momentum },
    { label: "Sample Size", score: Math.round(sampleScore), detail: `${summary.totalTrades} trades` },
  ];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function letterGrade(score: number): IntelligenceSummary["grade"] {
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 45) return "D";
  return "F";
}

function tradeDayOfWeek(t: Trade): number {
  const d = t.openTime ? new Date(t.openTime) : new Date(t.date);
  return isNaN(d.getTime()) ? 0 : d.getDay();
}

export function buildIntelligenceGraph(trades: Trade[]): IntelligenceGraph {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const insights: IntelligenceInsight[] = [];

  const emptySummary: IntelligenceSummary = {
    healthScore: 0,
    grade: "F",
    momentum: "stable",
    totalTrades: 0,
    winRate: 0,
    netPnL: 0,
    profitFactor: 0,
    expectancy: 0,
    positiveSignals: 0,
    negativeSignals: 0,
  };

  if (trades.length === 0) {
    nodes.push(
      { id: "core", label: "Your Trading", type: "behavior", sentiment: "neutral", size: 26, x: 50, y: 50, meta: { detail: "Log trades to unlock your intelligence map" } },
      { id: "d1", label: "Discipline", type: "behavior", sentiment: "positive", size: 12, x: 25, y: 30, meta: { detail: "Follow your plan" } },
      { id: "d2", label: "Edge", type: "behavior", sentiment: "positive", size: 12, x: 75, y: 32, meta: { detail: "Repeat what works" } },
      { id: "d3", label: "Risk", type: "behavior", sentiment: "neutral", size: 11, x: 22, y: 72, meta: { detail: "Size consistently" } },
      { id: "d4", label: "Sessions", type: "setup", sentiment: "neutral", size: 11, x: 78, y: 70, meta: { detail: "Track when you trade best" } },
    );
    ["d1", "d2", "d3", "d4"].forEach((id) => edges.push({ from: "core", to: id, strength: 0.45 }));
    insights.push({
      id: "empty",
      title: "Get started",
      detail: "Add at least 10 closed trades to unlock personalized behavior detection, pair edges, and session analysis.",
      sentiment: "advice",
      priority: 100,
    });
    return { nodes, edges, insights, summary: emptySummary };
  }

  // ===== Aggregations =====
  const pairAgg = new Map<string, { count: number; pnl: number; wins: number }>();
  const sessionAgg = new Map<string, { count: number; pnl: number; wins: number; losses: number }>();
  const dowAgg = new Map<number, { count: number; pnl: number; wins: number }>();
  const pairSessionAgg = new Map<string, Map<string, { count: number; pnl: number; wins: number }>>();

  trades.forEach((t) => {
    const pair = t.pair || "Unknown";
    const session = t.session || "Other";
    const dow = tradeDayOfWeek(t);
    const r = t.result || 0;

    const p = pairAgg.get(pair) || { count: 0, pnl: 0, wins: 0 };
    p.count++; p.pnl += r; if (r > 0) p.wins++;
    pairAgg.set(pair, p);

    const s = sessionAgg.get(session) || { count: 0, pnl: 0, wins: 0, losses: 0 };
    s.count++; s.pnl += r;
    if (r > 0) s.wins++; else if (r < 0) s.losses++;
    sessionAgg.set(session, s);

    const d = dowAgg.get(dow) || { count: 0, pnl: 0, wins: 0 };
    d.count++; d.pnl += r; if (r > 0) d.wins++;
    dowAgg.set(dow, d);

    if (!pairSessionAgg.has(pair)) pairSessionAgg.set(pair, new Map());
    const inner = pairSessionAgg.get(pair)!;
    const ps = inner.get(session) || { count: 0, pnl: 0, wins: 0 };
    ps.count++; ps.pnl += r; if (r > 0) ps.wins++;
    inner.set(session, ps);
  });

  const wins = trades.filter((t) => (t.result || 0) > 0);
  const losses = trades.filter((t) => (t.result || 0) < 0);
  const totalWins = wins.length;
  const totalLosses = losses.length;
  const sumWins = wins.reduce((s, t) => s + (t.result || 0), 0);
  const sumLosses = Math.abs(losses.reduce((s, t) => s + (t.result || 0), 0));
  const avgWin = totalWins ? sumWins / totalWins : 0;
  const avgLoss = totalLosses ? sumLosses / totalLosses : 0;
  const winRate = (totalWins / trades.length) * 100;
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? Infinity : 0;
  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
  const totalPnl = trades.reduce((s, t) => s + (t.result || 0), 0);

  const chronological = [...trades].sort((a, b) =>
    getTradeLocalDateKey(a).localeCompare(getTradeLocalDateKey(b)),
  );

  let maxLossStreak = 0;
  let maxWinStreak = 0;
  let curLoss = 0;
  let curWin = 0;
  chronological.forEach((t) => {
    const r = t.result || 0;
    if (r < 0) { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
    else if (r > 0) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
    else { curWin = 0; curLoss = 0; }
  });

  let revengeCount = 0;
  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const cur = chronological[i];
    if ((prev.result || 0) < 0 && getTradeLocalDateKey(cur) === getTradeLocalDateKey(prev)) revengeCount++;
  }
  const revengeRate = (revengeCount / trades.length) * 100;

  const absResults = trades.map((t) => Math.abs(t.result || 0)).filter((v) => v > 0);
  const meanAbs = absResults.length ? absResults.reduce((s, v) => s + v, 0) / absResults.length : 0;
  const variance = absResults.length
    ? absResults.reduce((s, v) => s + (v - meanAbs) ** 2, 0) / absResults.length
    : 0;
  const cv = meanAbs > 0 ? Math.sqrt(variance) / meanAbs : 0;

  const bigLosses = avgLoss > 0 ? losses.filter((t) => Math.abs(t.result || 0) > 3 * avgLoss).length : 0;
  const bigLossRate = (bigLosses / trades.length) * 100;

  const recencyN = Math.max(5, Math.floor(trades.length * 0.2));
  const recent = chronological.slice(-recencyN);
  const recentWinRate = recent.length ? (recent.filter((t) => (t.result || 0) > 0).length / recent.length) * 100 : winRate;
  const recentPnl = recent.reduce((s, t) => s + (t.result || 0), 0);

  const longs = trades.filter((t) => t.direction === "Long");
  const shorts = trades.filter((t) => t.direction === "Short");
  const longWinRate = longs.length ? (longs.filter((t) => (t.result || 0) > 0).length / longs.length) * 100 : 0;
  const shortWinRate = shorts.length ? (shorts.filter((t) => (t.result || 0) > 0).length / shorts.length) * 100 : 0;
  const longPnl = longs.reduce((s, t) => s + (t.result || 0), 0);
  const shortPnl = shorts.reduce((s, t) => s + (t.result || 0), 0);

  const pairs = Array.from(pairAgg.entries()).sort((a, b) => b[1].count - a[1].count);
  const topPairCount = pairs[0]?.[1].count ?? 0;
  const concentration = (topPairCount / trades.length) * 100;

  const momentum: IntelligenceSummary["momentum"] =
    trades.length >= 15 && recentWinRate > winRate + 6 && recentPnl > 0 ? "improving"
      : trades.length >= 15 && recentWinRate < winRate - 6 && recentPnl < 0 ? "declining"
        : "stable";

  // Health score 0-100
  let healthScore = 0;
  healthScore += Math.min(28, winRate * 0.35);
  const pfScore = !Number.isFinite(profitFactor) ? 25 : profitFactor >= 2 ? 25 : profitFactor >= 1.5 ? 20 : profitFactor >= 1 ? 14 : profitFactor >= 0.8 ? 8 : 0;
  healthScore += pfScore;
  healthScore += cv < 0.5 ? 14 : cv < 0.8 ? 10 : cv < 1.2 ? 5 : 0;
  healthScore += bigLossRate < 5 ? 12 : bigLossRate < 10 ? 6 : 0;
  healthScore += momentum === "improving" ? 10 : momentum === "stable" ? 5 : 0;
  healthScore += totalPnl > 0 ? 8 : totalPnl < 0 ? -5 : 0;
  healthScore -= revengeRate >= 25 ? 8 : revengeRate >= 15 ? 4 : 0;
  healthScore -= maxLossStreak >= 5 ? 6 : maxLossStreak >= 4 ? 3 : 0;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  const summary: IntelligenceSummary = {
    healthScore,
    grade: letterGrade(healthScore),
    momentum,
    totalTrades: trades.length,
    winRate,
    netPnL: totalPnl,
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 999,
    expectancy,
    positiveSignals: 0,
    negativeSignals: 0,
  };

  // Core node
  const coreSentiment: NodeSentiment = totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral";
  nodes.push({
    id: "core",
    label: `Health ${healthScore}`,
    type: "behavior",
    sentiment: coreSentiment,
    size: 28,
    x: 50,
    y: 48,
    meta: {
      count: trades.length,
      pnl: totalPnl,
      winRate,
      detail: `${trades.length} trades · ${winRate.toFixed(1)}% WR · PF ${Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"} · Grade ${summary.grade}`,
    },
  });

  // Pair nodes — top 8 in expanded layout positions
  const pairsTop = pairs.slice(0, 8);
  const maxPairCount = Math.max(...pairsTop.map(([, v]) => v.count), 1);
  pairsTop.forEach(([pair, v], i) => {
    const angle = (Math.PI * 2 * i) / pairsTop.length - Math.PI / 2;
    const radius = 38;
    const x = 50 + Math.cos(angle) * radius;
    const y = 48 + Math.sin(angle) * radius * 0.55;
    const pairWinRate = v.count ? (v.wins / v.count) * 100 : 0;
    const id = `pair-${pair}`;
    nodes.push({
      id,
      label: pair,
      type: "trade",
      sentiment: v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral",
      size: 10 + (v.count / maxPairCount) * 16,
      x,
      y,
      meta: {
        count: v.count,
        pnl: v.pnl,
        pair,
        winRate: pairWinRate,
        detail: `${v.count} trades · ${pairWinRate.toFixed(0)}% WR · ${v.pnl >= 0 ? "+" : ""}$${v.pnl.toFixed(0)}`,
      },
    });
    edges.push({ from: "core", to: id, strength: 0.35 + (v.count / maxPairCount) * 0.65 });
  });

  // Session nodes
  const sessions = Array.from(sessionAgg.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  const maxSessionCount = Math.max(...sessions.map(([, v]) => v.count), 1);
  sessions.forEach(([session, v], i) => {
    const x = 14 + (i * 18);
    const y = 18 + (i % 2) * 8;
    const sessionWinRate = v.count ? (v.wins / v.count) * 100 : 0;
    const id = `session-${session}`;
    nodes.push({
      id,
      label: session,
      type: "setup",
      sentiment: v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral",
      size: 10 + (v.count / maxSessionCount) * 12,
      x,
      y,
      meta: {
        count: v.count,
        pnl: v.pnl,
        winRate: sessionWinRate,
        detail: `${session} · ${v.count} trades · ${sessionWinRate.toFixed(0)}% WR · ${v.pnl >= 0 ? "+" : ""}$${v.pnl.toFixed(0)}`,
      },
    });
    edges.push({ from: "core", to: id, strength: 0.3 + (v.count / maxSessionCount) * 0.5 });
  });

  // Weekday nodes — only days with 2+ trades
  const dowEntries = Array.from(dowAgg.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].pnl - a[1].pnl);
  dowEntries.slice(0, 5).forEach(([dow, v], i) => {
    const x = 86 - i * 8;
    const y = 82 - (i % 3) * 10;
    const wr = v.count ? (v.wins / v.count) * 100 : 0;
    const id = `dow-${dow}`;
    nodes.push({
      id,
      label: DAY_NAMES[dow],
      type: "weekday",
      sentiment: v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral",
      size: 10 + Math.min(v.count, 20) * 0.4,
      x,
      y,
      meta: {
        count: v.count,
        pnl: v.pnl,
        winRate: wr,
        detail: `${DAY_NAMES[dow]}s · ${v.count} trades · ${wr.toFixed(0)}% WR · ${v.pnl >= 0 ? "+" : ""}$${v.pnl.toFixed(0)}`,
      },
    });
    edges.push({ from: "core", to: id, strength: 0.4 });
  });

  // Direction nodes
  if (longs.length >= 3) {
    nodes.push({
      id: "dir-long",
      label: "Long",
      type: "direction",
      sentiment: longPnl > 0 ? "positive" : longPnl < 0 ? "negative" : "neutral",
      size: 12 + Math.min(longs.length, 30) * 0.2,
      x: 28,
      y: 82,
      meta: {
        count: longs.length,
        pnl: longPnl,
        winRate: longWinRate,
        detail: `${longs.length} longs · ${longWinRate.toFixed(0)}% WR · ${longPnl >= 0 ? "+" : ""}$${longPnl.toFixed(0)}`,
      },
    });
    edges.push({ from: "core", to: "dir-long", strength: 0.5 });
  }
  if (shorts.length >= 3) {
    nodes.push({
      id: "dir-short",
      label: "Short",
      type: "direction",
      sentiment: shortPnl > 0 ? "positive" : shortPnl < 0 ? "negative" : "neutral",
      size: 12 + Math.min(shorts.length, 30) * 0.2,
      x: 72,
      y: 82,
      meta: {
        count: shorts.length,
        pnl: shortPnl,
        winRate: shortWinRate,
        detail: `${shorts.length} shorts · ${shortWinRate.toFixed(0)}% WR · ${shortPnl >= 0 ? "+" : ""}$${shortPnl.toFixed(0)}`,
      },
    });
    edges.push({ from: "core", to: "dir-short", strength: 0.5 });
  }

  // Pair × session affinity
  const renderedPairIds = new Set(pairsTop.map(([p]) => `pair-${p}`));
  const renderedSessionIds = new Set(sessions.map(([s]) => `session-${s}`));
  pairsTop.forEach(([pair]) => {
    const inner = pairSessionAgg.get(pair);
    if (!inner) return;
    let bestSession: string | null = null;
    let bestPnl = -Infinity;
    inner.forEach((stats, sess) => {
      if (stats.count >= 2 && stats.pnl > bestPnl) {
        bestPnl = stats.pnl;
        bestSession = sess;
      }
    });
    if (bestSession && renderedPairIds.has(`pair-${pair}`) && renderedSessionIds.has(`session-${bestSession}`)) {
      edges.push({ from: `pair-${pair}`, to: `session-${bestSession}`, strength: 0.6 });
    }
  });

  const sessionsRanked = Array.from(sessionAgg.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([s, v]) => ({
      session: s,
      count: v.count,
      pnl: v.pnl,
      wr: v.count ? (v.wins / v.count) * 100 : 0,
      avg: v.count ? v.pnl / v.count : 0,
    }));
  const bestSession = sessionsRanked.slice().sort((a, b) => b.avg - a.avg)[0];
  const worstSession = sessionsRanked.slice().sort((a, b) => a.avg - b.avg)[0];
  const bestDow = dowEntries[0];
  const worstDow = dowEntries.slice().sort((a, b) => a[1].pnl - b[1].pnl)[0];

  const sample = trades.length;
  const behaviorDefs: { label: string; sentiment: NodeSentiment; visible: boolean; detail: string; priority: number }[] = [
    { label: "Statistical Edge", sentiment: "positive", visible: sample >= 10 && profitFactor >= 1.5 && expectancy > 0, detail: `PF ${Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"} · +$${expectancy.toFixed(0)}/trade expectancy`, priority: 90 },
    { label: "Discipline", sentiment: "positive", visible: sample >= 10 && winRate >= 55 && cv < 0.6, detail: `${winRate.toFixed(0)}% WR with stable sizing (CV ${cv.toFixed(2)})`, priority: 85 },
    { label: "Risk Control", sentiment: "positive", visible: sample >= 10 && avgWin >= avgLoss && bigLossRate < 5, detail: `R:R ${(avgWin / Math.max(avgLoss, 1)).toFixed(2)} · ${bigLossRate.toFixed(0)}% outsized losses`, priority: 80 },
    { label: "Hot Streak", sentiment: "positive", visible: maxWinStreak >= 5, detail: `${maxWinStreak} wins in a row — stay process-focused`, priority: 75 },
    { label: "Momentum Up", sentiment: "positive", visible: momentum === "improving", detail: `Recent ${recencyN} trades: ${recentWinRate.toFixed(0)}% WR vs ${winRate.toFixed(0)}% overall`, priority: 88 },
    { label: "Revenge Trading", sentiment: "negative", visible: sample >= 15 && revengeRate >= 20, detail: `${revengeRate.toFixed(0)}% of trades follow a same-day loss`, priority: 92 },
    { label: "Tilt Risk", sentiment: "negative", visible: maxLossStreak >= 4, detail: `${maxLossStreak}-trade loss streak detected`, priority: 90 },
    { label: "Oversized Losses", sentiment: "negative", visible: sample >= 10 && bigLossRate >= 8, detail: `${bigLossRate.toFixed(0)}% of trades exceed 3× avg loss`, priority: 86 },
    { label: "Inconsistent Size", sentiment: "negative", visible: sample >= 10 && cv >= 1.0, detail: `Bet sizing varies heavily (CV ${cv.toFixed(2)})`, priority: 82 },
    { label: "Momentum Down", sentiment: "negative", visible: momentum === "declining", detail: `Recent slump: ${recentWinRate.toFixed(0)}% WR · $${recentPnl.toFixed(0)} P&L`, priority: 91 },
    { label: "Over-Concentrated", sentiment: "negative", visible: sample >= 15 && concentration >= 55, detail: `${concentration.toFixed(0)}% of trades in ${pairs[0]?.[0] ?? "one pair"}`, priority: 78 },
    { label: "Small Sample", sentiment: "neutral", visible: sample > 0 && sample < 10, detail: `${sample} trades — patterns still forming`, priority: 70 },
  ].filter((b) => b.visible);

  behaviorDefs.sort((a, b) => b.priority - a.priority);
  const topBehaviors = behaviorDefs.slice(0, 8);
  summary.positiveSignals = topBehaviors.filter((b) => b.sentiment === "positive").length;
  summary.negativeSignals = topBehaviors.filter((b) => b.sentiment === "negative").length;

  topBehaviors.forEach((b, i) => {
    const angle = Math.PI + (Math.PI / (topBehaviors.length + 1)) * (i + 1);
    const x = 50 + Math.cos(angle) * 32;
    const y = 48 + Math.sin(angle) * 28;
    const id = `behavior-${b.label.replace(/\s+/g, "-")}`;
    nodes.push({
      id,
      label: b.label,
      type: "behavior",
      sentiment: b.sentiment,
      size: 11 + (b.priority / 100) * 4,
      x,
      y,
      meta: { detail: b.detail },
    });
    edges.push({ from: "core", to: id, strength: 0.45 + (b.priority / 200) });
    insights.push({
      id,
      title: b.label,
      detail: b.detail,
      sentiment: b.sentiment,
      priority: b.priority,
    });
  });

  // Ranked insights for side panel
  if (bestSession && bestSession.pnl > 0) {
    insights.push({
      id: "ins-best-session",
      title: `${bestSession.session} is your edge`,
      detail: `${bestSession.wr.toFixed(0)}% WR · +$${bestSession.avg.toFixed(0)}/trade over ${bestSession.count} trades`,
      sentiment: "positive",
      priority: 84,
    });
  }
  if (worstSession && worstSession.pnl < 0 && worstSession.count >= 5) {
    insights.push({
      id: "ins-worst-session",
      title: `Reduce ${worstSession.session} exposure`,
      detail: `${worstSession.wr.toFixed(0)}% WR · $${worstSession.avg.toFixed(0)}/trade avg · ${worstSession.count} trades`,
      sentiment: "negative",
      priority: 87,
    });
  }
  if (bestDow && bestDow[1].pnl > 0) {
    insights.push({
      id: "ins-best-dow",
      title: `${DAY_NAMES[bestDow[0]]}s perform best`,
      detail: `${bestDow[1].count} trades · +$${bestDow[1].pnl.toFixed(0)} total P&L`,
      sentiment: "positive",
      priority: 76,
    });
  }
  if (worstDow && worstDow[1].pnl < 0 && worstDow[0] !== bestDow?.[0]) {
    insights.push({
      id: "ins-worst-dow",
      title: `Watch ${DAY_NAMES[worstDow[0]]}s`,
      detail: `${worstDow[1].count} trades · $${worstDow[1].pnl.toFixed(0)} P&L — use lighter size or stricter filters`,
      sentiment: "advice",
      priority: 83,
    });
  }
  if (longs.length >= 5 && shorts.length >= 5 && Math.abs(longWinRate - shortWinRate) >= 18) {
    const better = longWinRate > shortWinRate ? "Long" : "Short";
    insights.push({
      id: "ins-direction",
      title: `${better} side is stronger`,
      detail: `Long ${longWinRate.toFixed(0)}% WR vs Short ${shortWinRate.toFixed(0)}% WR`,
      sentiment: "advice",
      priority: 74,
    });
  }
  const topPair = pairs[0];
  if (topPair && topPair[1].pnl > 0) {
    insights.push({
      id: "ins-top-pair",
      title: `${topPair[0]} is your top pair`,
      detail: `${topPair[1].count} trades · ${((topPair[1].wins / topPair[1].count) * 100).toFixed(0)}% WR · +$${topPair[1].pnl.toFixed(0)}`,
      sentiment: "positive",
      priority: 72,
    });
  }

  insights.sort((a, b) => b.priority - a.priority);

  return { nodes, edges, insights: insights.slice(0, 10), summary };
}

export const LAYER_LABELS: Record<NodeType, string> = {
  trade: "Pairs",
  setup: "Sessions",
  behavior: "Behaviors",
  weekday: "Weekdays",
  direction: "Direction",
};

export const SENTIMENT_COLORS = {
  positive: "hsl(142 76% 50%)",
  negative: "hsl(0 75% 58%)",
  neutral: "hsl(210 90% 62%)",
} as const;
