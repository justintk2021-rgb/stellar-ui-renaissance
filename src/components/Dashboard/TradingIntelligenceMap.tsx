import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trade } from "@/types/trade";
import { Brain, Sparkles, MousePointerClick } from "lucide-react";

interface TradingIntelligenceMapProps {
  trades: Trade[];
  compact?: boolean;
}

type NodeType = "trade" | "setup" | "behavior";
type NodeSentiment = "positive" | "negative" | "neutral";

interface MapNode {
  id: string;
  label: string;
  type: NodeType;
  sentiment: NodeSentiment;
  size: number; // 8 - 28
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  meta: {
    count?: number;
    pnl?: number;
    pair?: string;
    date?: string;
    notes?: string;
    detail?: string;
  };
}

interface MapEdge {
  from: string;
  to: string;
  strength: number; // 0-1
}

const COLORS = {
  positive: "hsl(142 76% 50%)",
  negative: "hsl(0 75% 58%)",
  neutral: "hsl(210 90% 62%)",
} as const;

function buildGraph(trades: Trade[]): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  if (trades.length === 0) {
    // Demo skeleton so the visualization isn't empty
    const demo: MapNode[] = [
      { id: "core", label: "Your Trading", type: "behavior", sentiment: "neutral", size: 24, x: 50, y: 50, meta: { detail: "Add trades to populate your intelligence map" } },
      { id: "d1", label: "Discipline", type: "behavior", sentiment: "positive", size: 14, x: 22, y: 28, meta: {} },
      { id: "d2", label: "Patience", type: "behavior", sentiment: "positive", size: 14, x: 78, y: 30, meta: {} },
      { id: "d3", label: "FOMO", type: "behavior", sentiment: "negative", size: 12, x: 18, y: 72, meta: {} },
      { id: "d4", label: "Break & Retest", type: "setup", sentiment: "neutral", size: 14, x: 80, y: 70, meta: {} },
    ];
    demo.slice(1).forEach((n) => edges.push({ from: "core", to: n.id, strength: 0.5 }));
    return { nodes: demo, edges };
  }

  // Aggregate by pair
  const pairAgg = new Map<string, { count: number; pnl: number; wins: number }>();
  trades.forEach((t) => {
    const key = t.pair || "Unknown";
    const cur = pairAgg.get(key) || { count: 0, pnl: 0, wins: 0 };
    cur.count += 1;
    cur.pnl += t.result || 0;
    if ((t.result || 0) > 0) cur.wins += 1;
    pairAgg.set(key, cur);
  });

  // Aggregate by session (setup proxy)
  const sessionAgg = new Map<string, { count: number; pnl: number }>();
  trades.forEach((t) => {
    const key = t.session || "Other";
    const cur = sessionAgg.get(key) || { count: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += t.result || 0;
    sessionAgg.set(key, cur);
  });

  // ===== Core stats =====
  const wins = trades.filter((t) => (t.result || 0) > 0);
  const losses = trades.filter((t) => (t.result || 0) < 0);
  const totalWins = wins.length;
  const totalLosses = losses.length;
  const sumWins = wins.reduce((s, t) => s + (t.result || 0), 0);
  const sumLosses = Math.abs(losses.reduce((s, t) => s + (t.result || 0), 0));
  const avgWin = totalWins ? sumWins / totalWins : 0;
  const avgLoss = totalLosses ? sumLosses / totalLosses : 0;
  const winRate = trades.length ? (totalWins / trades.length) * 100 : 0;
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? Infinity : 0;
  const expectancy = trades.length
    ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss
    : 0;
  const totalPnl = trades.reduce((s, t) => s + (t.result || 0), 0);

  // Sort once chronologically (oldest -> newest) for streak/recency analysis
  const chronological = [...trades].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return da - db;
  });

  // ===== Streak analysis (revenge trading & hot streaks) =====
  let maxLossStreak = 0;
  let maxWinStreak = 0;
  let curLoss = 0;
  let curWin = 0;
  chronological.forEach((t) => {
    const r = t.result || 0;
    if (r < 0) {
      curLoss += 1;
      curWin = 0;
      maxLossStreak = Math.max(maxLossStreak, curLoss);
    } else if (r > 0) {
      curWin += 1;
      curLoss = 0;
      maxWinStreak = Math.max(maxWinStreak, curWin);
    } else {
      curWin = 0;
      curLoss = 0;
    }
  });

  // Revenge trading: trades taken on same day right after a loss
  let revengeCount = 0;
  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const cur = chronological[i];
    if ((prev.result || 0) < 0 && (cur.date || "").slice(0, 10) === (prev.date || "").slice(0, 10)) {
      revengeCount += 1;
    }
  }
  const revengeRate = chronological.length ? (revengeCount / chronological.length) * 100 : 0;

  // ===== Risk consistency (bet-size variance via |result|) =====
  const absResults = trades.map((t) => Math.abs(t.result || 0)).filter((v) => v > 0);
  const meanAbs = absResults.length ? absResults.reduce((s, v) => s + v, 0) / absResults.length : 0;
  const variance = absResults.length
    ? absResults.reduce((s, v) => s + (v - meanAbs) ** 2, 0) / absResults.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const cv = meanAbs > 0 ? stdDev / meanAbs : 0; // coefficient of variation

  // Catastrophic losses: any loss > 3x avg loss
  const bigLosses = avgLoss > 0 ? losses.filter((t) => Math.abs(t.result || 0) > 3 * avgLoss).length : 0;
  const bigLossRate = trades.length ? (bigLosses / trades.length) * 100 : 0;

  // ===== Recency analysis: last 20% vs overall =====
  const recencyN = Math.max(5, Math.floor(chronological.length * 0.2));
  const recent = chronological.slice(-recencyN);
  const recentWins = recent.filter((t) => (t.result || 0) > 0).length;
  const recentWinRate = recent.length ? (recentWins / recent.length) * 100 : winRate;
  const recentPnl = recent.reduce((s, t) => s + (t.result || 0), 0);

  // ===== Direction bias =====
  const longs = trades.filter((t) => t.direction === "Long");
  const shorts = trades.filter((t) => t.direction === "Short");
  const longWinRate = longs.length
    ? (longs.filter((t) => (t.result || 0) > 0).length / longs.length) * 100
    : 0;
  const shortWinRate = shorts.length
    ? (shorts.filter((t) => (t.result || 0) > 0).length / shorts.length) * 100
    : 0;
  const directionGap = Math.abs(longWinRate - shortWinRate);

  // ===== Pair concentration =====
  const pairs = Array.from(pairAgg.entries()).sort((a, b) => b[1].count - a[1].count);
  const topPairCount = pairs[0] ? pairs[0][1].count : 0;
  const concentration = trades.length ? (topPairCount / trades.length) * 100 : 0;

  // Core node
  const coreSentiment: NodeSentiment = totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral";
  nodes.push({
    id: "core",
    label: "Your Trading",
    type: "behavior",
    sentiment: coreSentiment,
    size: 26,
    x: 50,
    y: 50,
    meta: { count: trades.length, pnl: totalPnl, detail: `${trades.length} trades · ${winRate.toFixed(1)}% WR · PF ${profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}` },
  });

  // Place pair nodes around the top half
  const pairsTop = pairs.slice(0, 6);
  const maxPairCount = Math.max(...pairsTop.map(([, v]) => v.count), 1);
  pairsTop.forEach(([pair, v], i) => {
    const angle = (Math.PI / (pairsTop.length + 1)) * (i + 1);
    const x = 50 + Math.cos(angle) * 38;
    const y = 28 - Math.sin(angle) * 8;
    const sentiment: NodeSentiment = v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral";
    const id = `pair-${pair}`;
    const pairWinRate = v.count ? (v.wins / v.count) * 100 : 0;
    nodes.push({
      id,
      label: pair,
      type: "trade",
      sentiment,
      size: 10 + (v.count / maxPairCount) * 14,
      x,
      y,
      meta: { count: v.count, pnl: v.pnl, pair, detail: `${v.count} trades · ${pairWinRate.toFixed(0)}% WR · ${v.pnl >= 0 ? "+" : ""}$${v.pnl.toFixed(0)}` },
    });
    edges.push({ from: "core", to: id, strength: 0.4 + (v.count / maxPairCount) * 0.6 });
  });

  // Session nodes (setups) on the sides
  const sessions = Array.from(sessionAgg.entries()).slice(0, 4);
  const maxSessionCount = Math.max(...sessions.map(([, v]) => v.count), 1);
  sessions.forEach(([session, v], i) => {
    const onLeft = i % 2 === 0;
    const x = onLeft ? 12 + (i * 4) : 88 - (i * 4);
    const y = 50 + (i % 2 === 0 ? -6 : 6) * (i + 1);
    const id = `session-${session}`;
    const sentiment: NodeSentiment = v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral";
    nodes.push({
      id,
      label: session,
      type: "setup",
      sentiment,
      size: 10 + (v.count / maxSessionCount) * 10,
      x,
      y,
      meta: { count: v.count, pnl: v.pnl, detail: `${session} · ${v.count} trades · ${v.pnl >= 0 ? "+" : ""}$${v.pnl.toFixed(0)}` },
    });
    edges.push({ from: "core", to: id, strength: 0.3 + (v.count / maxSessionCount) * 0.5 });
  });

  // ===== Behavior signals (data-driven, evidence-based) =====
  const sample = trades.length;
  const behaviors: { label: string; sentiment: NodeSentiment; visible: boolean; detail: string }[] = ([
    // Positive traits
    {
      label: "Edge",
      sentiment: "positive",
      visible: sample >= 10 && profitFactor >= 1.5 && expectancy > 0,
      detail: `Profit factor ${profitFactor.toFixed(2)} · expectancy +$${expectancy.toFixed(0)}/trade`,
    },
    {
      label: "Discipline",
      sentiment: "positive",
      visible: sample >= 10 && winRate >= 55 && cv < 0.6,
      detail: `${winRate.toFixed(0)}% WR with consistent risk (CV ${cv.toFixed(2)})`,
    },
    {
      label: "Risk Control",
      sentiment: "positive",
      visible: sample >= 10 && avgWin >= avgLoss && bigLossRate < 5,
      detail: `R:R ${(avgWin / Math.max(avgLoss, 1)).toFixed(2)} · only ${bigLossRate.toFixed(0)}% outsized losses`,
    },
    {
      label: "Hot Streak",
      sentiment: "positive",
      visible: maxWinStreak >= 5,
      detail: `Best win streak: ${maxWinStreak} in a row`,
    },
    {
      label: "Improving",
      sentiment: "positive",
      visible: sample >= 20 && recentWinRate > winRate + 5 && recentPnl > 0,
      detail: `Recent ${recencyN}: ${recentWinRate.toFixed(0)}% WR (vs ${winRate.toFixed(0)}% overall)`,
    },
    {
      label: "Consistency",
      sentiment: "positive",
      visible: sample >= 20 && cv < 0.5 && winRate >= 50,
      detail: `Stable bet sizing (CV ${cv.toFixed(2)}) over ${sample} trades`,
    },

    // Negative traits
    {
      label: "Revenge Trading",
      sentiment: "negative",
      visible: sample >= 15 && revengeRate >= 25,
      detail: `${revengeRate.toFixed(0)}% of trades follow a same-day loss`,
    },
    {
      label: "Tilt Risk",
      sentiment: "negative",
      visible: maxLossStreak >= 4,
      detail: `Worst loss streak: ${maxLossStreak} in a row`,
    },
    {
      label: "Oversized Losses",
      sentiment: "negative",
      visible: sample >= 10 && bigLossRate >= 8,
      detail: `${bigLossRate.toFixed(0)}% of trades are >3× avg loss`,
    },
    {
      label: "Inconsistent Sizing",
      sentiment: "negative",
      visible: sample >= 10 && cv >= 1.0,
      detail: `Risk varies wildly (CV ${cv.toFixed(2)})`,
    },
    {
      label: "Cuts Winners Early",
      sentiment: "negative",
      visible: sample >= 10 && avgWin > 0 && avgLoss > 0 && avgWin < avgLoss * 0.7,
      detail: `Avg win ($${avgWin.toFixed(0)}) much smaller than avg loss ($${avgLoss.toFixed(0)})`,
    },
    {
      label: "Overtrading",
      sentiment: "negative",
      visible: sample >= 30 && winRate < 45 && profitFactor < 1,
      detail: `${sample} trades but only ${winRate.toFixed(0)}% WR · PF ${profitFactor.toFixed(2)}`,
    },
    {
      label: "Slumping",
      sentiment: "negative",
      visible: sample >= 20 && recentWinRate < winRate - 10 && recentPnl < 0,
      detail: `Recent ${recencyN}: ${recentWinRate.toFixed(0)}% WR (down from ${winRate.toFixed(0)}%)`,
    },
    {
      label: "Over-Concentrated",
      sentiment: "negative",
      visible: sample >= 15 && concentration >= 60,
      detail: `${concentration.toFixed(0)}% of trades in one pair`,
    },
    {
      label: "Direction Bias",
      sentiment: "negative",
      visible:
        sample >= 20 &&
        longs.length >= 5 &&
        shorts.length >= 5 &&
        directionGap >= 20,
      detail: `Long ${longWinRate.toFixed(0)}% vs Short ${shortWinRate.toFixed(0)}% WR`,
    },

    // Neutral / informational
    {
      label: "Small Sample",
      sentiment: "neutral",
      visible: sample > 0 && sample < 10,
      detail: `Only ${sample} trades — patterns not yet reliable`,
    },
  ] as { label: string; sentiment: NodeSentiment; visible: boolean; detail: string }[]).filter((b) => b.visible);

  // Cap to top 7 to keep the canvas readable
  const topBehaviors = behaviors.slice(0, 7);

  topBehaviors.forEach((b, i) => {
    const angle = (Math.PI / (topBehaviors.length + 1)) * (i + 1);
    const x = 50 - Math.cos(angle) * 36;
    const y = 78 + Math.sin(angle) * 6;
    const id = `behavior-${b.label}`;
    nodes.push({
      id,
      label: b.label,
      type: "behavior",
      sentiment: b.sentiment,
      size: 12,
      x,
      y,
      meta: { detail: b.detail },
    });
    edges.push({ from: "core", to: id, strength: 0.5 });
  });

  // Cross-connections: link top pair to dominant session
  const topPair = pairsTop[0];
  const topSession = sessions[0];
  if (topPair && topSession) {
    edges.push({ from: `pair-${topPair[0]}`, to: `session-${topSession[0]}`, strength: 0.4 });
  }

  return { nodes, edges };
}

export function TradingIntelligenceMap({ trades, compact = false }: TradingIntelligenceMapProps) {
  const { nodes, edges } = useMemo(() => buildGraph(trades), [trades]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 420 });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Pause expensive animations when off-screen for perf
  useEffect(() => {
    if (!wrapperRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setIsVisible(e.isIntersecting);
      },
      { threshold: 0.05 }
    );
    io.observe(wrapperRef.current);
    return () => io.disconnect();
  }, []);

  // Respect reduced motion preference
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const animationsEnabled = isVisible && !prefersReducedMotion;

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const activeId = hoveredId || selectedId;
  const activeNode = activeId ? nodeById[activeId] : null;

  const toX = (p: number) => (p / 100) * size.w;
  const toY = (p: number) => (p / 100) * size.h;

  return (
    <motion.div
      ref={wrapperRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className={`group relative rounded-2xl bg-gradient-to-br from-card/60 via-card/40 to-card/20 backdrop-blur-xl border border-border/40 shadow-xl overflow-hidden ${compact ? "flex flex-col flex-1 min-h-0" : ""}`}
    >
      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl opacity-60" />

      {/* Header */}
      <div className={`relative flex items-center justify-between ${compact ? "px-3 pt-3 pb-2" : "px-5 pt-5 pb-3"}`}>
        <div className="flex items-center gap-2.5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`relative ${compact ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl"} bg-primary/10 flex items-center justify-center overflow-hidden`}
          >
            <Brain className={compact ? "w-4 h-4 text-primary relative z-10" : "w-5 h-5 text-primary relative z-10"} />
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/20 to-primary/0"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className={compact ? "text-xs font-semibold text-foreground leading-tight" : "text-base font-semibold text-foreground"}>
                Intelligence Map
              </h3>
              <Sparkles className={compact ? "w-2.5 h-2.5 text-primary/60" : "w-3 h-3 text-primary/60"} />
            </div>
            {!compact && <p className="text-xs text-muted-foreground">Your trading mind, visualized</p>}
          </div>
        </div>
        {!compact && (
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            <Legend color={COLORS.positive} label="Profitable" />
            <Legend color={COLORS.negative} label="Losing" />
            <Legend color={COLORS.neutral} label="Setup" />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full ${compact ? "flex-1 min-h-[200px]" : "h-[420px]"} overflow-hidden`}
        onClick={() => setSelectedId(null)}
      >
        {/* Subtle grid backdrop */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <svg width={size.w} height={size.h} className="absolute inset-0">
          <defs>
            {(["positive", "negative", "neutral"] as NodeSentiment[]).map((s) => (
              <radialGradient key={s} id={`grad-${s}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={COLORS[s]} stopOpacity="1" />
                <stop offset="60%" stopColor={COLORS[s]} stopOpacity="0.6" />
                <stop offset="100%" stopColor={COLORS[s]} stopOpacity="0.2" />
              </radialGradient>
            ))}
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const isActive = activeId === e.from || activeId === e.to;
            const isDimmed = activeId && !isActive;
            const stroke =
              b.sentiment === "negative" || a.sentiment === "negative"
                ? COLORS.negative
                : b.sentiment === "positive" || a.sentiment === "positive"
                ? COLORS.positive
                : COLORS.neutral;
            const x1 = toX(a.x);
            const y1 = toY(a.y);
            const x2 = toX(b.x);
            const y2 = toY(b.y);
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeOpacity={isActive ? 0.7 : isDimmed ? 0.06 : 0.2}
                  strokeWidth={isActive ? 1.6 : 1}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity 300ms ease, stroke-width 300ms ease" }}
                />
                {/* Pulse only on the active edges to keep things lightweight */}
                {isActive && animationsEnabled && (
                  <circle r={2.5} fill={stroke} opacity={0.9}>
                    <animateMotion dur="2.4s" repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n, idx) => {
            const cx = toX(n.x);
            const cy = toY(n.y);
            const isActive = activeId === n.id;
            const isDimmed = activeId && !isActive;
            const isCore = n.id === "core";
            const sizeFactor = compact ? 0.6 : 1;
            const r = Math.max(4, n.size * sizeFactor);
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: isDimmed ? 0.35 : 1, scale: 1 }}
                transition={{
                  delay: 0.15 + idx * 0.04,
                  type: "spring",
                  stiffness: 180,
                  damping: 14,
                }}
                style={{ cursor: "pointer", transformOrigin: `${cx}px ${cy}px` }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedId((prev) => (prev === n.id ? null : n.id));
                }}
              >
                <g>
                  {/* Outer pulse ring on active only — no continuous per-node animations */}
                  {isActive && animationsEnabled && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={COLORS[n.sentiment]}
                      strokeOpacity={0.6}
                      strokeWidth={1.5}
                    >
                      <animate attributeName="r" values={`${r};${r + 14}`} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Soft halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + (isActive ? 10 : 6)}
                    fill={COLORS[n.sentiment]}
                    opacity={isActive ? 0.22 : 0.1}
                    style={{ transition: "all 250ms ease" }}
                  />
                  {/* Core node (no SVG blur filter — too expensive for paint) */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? r + 1.5 : r}
                    fill={`url(#grad-${n.sentiment})`}
                    stroke={COLORS[n.sentiment]}
                    strokeOpacity={isActive ? 1 : 0.7}
                    strokeWidth={isActive ? 1.5 : 1}
                    style={{ transition: "all 250ms ease" }}
                  />
                  {/* Label */}
                  {(!compact || isActive || isCore) && (
                    <text
                      x={cx}
                      y={cy + r + (compact ? 10 : 14)}
                      textAnchor="middle"
                      fill="hsl(var(--foreground))"
                      fillOpacity={isActive ? 1 : isDimmed ? 0.3 : 0.75}
                      fontSize={compact ? (isCore ? 9 : 8) : isCore ? 12 : 10}
                      fontWeight={isCore ? 600 : 500}
                      style={{ transition: "fill-opacity 200ms ease", pointerEvents: "none" }}
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Detail / hint footer - outside canvas so it never blocks nodes */}
      <div
        className={`relative border-t border-border/30 bg-background/30 backdrop-blur-sm ${
          compact ? "px-3 py-2 min-h-[48px]" : "px-5 py-3 min-h-[60px]"
        } flex items-center`}
      >
        <AnimatePresence mode="wait">
          {activeNode ? (
            <motion.div
              key={activeNode.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2.5 w-full min-w-0"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: COLORS[activeNode.sentiment],
                  boxShadow: `0 0 10px ${COLORS[activeNode.sentiment]}`,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{activeNode.label}</p>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                    {activeNode.type}
                  </span>
                </div>
                {activeNode.meta.detail && (
                  <p className="text-[10px] text-muted-foreground truncate">{activeNode.meta.detail}</p>
                )}
              </div>
              {typeof activeNode.meta.pnl === "number" && (
                <motion.span
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] font-mono font-semibold shrink-0 px-2 py-0.5 rounded-md"
                  style={{
                    color: activeNode.meta.pnl >= 0 ? COLORS.positive : COLORS.negative,
                    backgroundColor: `${activeNode.meta.pnl >= 0 ? COLORS.positive : COLORS.negative}1a`,
                  }}
                >
                  {activeNode.meta.pnl >= 0 ? "+" : ""}${activeNode.meta.pnl.toFixed(2)}
                </motion.span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70"
            >
              <MousePointerClick className="w-3 h-3" />
              Hover a node to inspect
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span>{label}</span>
    </div>
  );
}
