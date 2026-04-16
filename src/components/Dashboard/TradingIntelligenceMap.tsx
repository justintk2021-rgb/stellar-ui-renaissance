import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Trade } from "@/types/trade";
import { Brain, Info } from "lucide-react";

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

  // Behavior signals derived from data
  const totalWins = trades.filter((t) => (t.result || 0) > 0).length;
  const totalLosses = trades.filter((t) => (t.result || 0) < 0).length;
  const avgWin = totalWins ? trades.filter((t) => (t.result || 0) > 0).reduce((s, t) => s + (t.result || 0), 0) / totalWins : 0;
  const avgLoss = totalLosses ? Math.abs(trades.filter((t) => (t.result || 0) < 0).reduce((s, t) => s + (t.result || 0), 0)) / totalLosses : 0;
  const winRate = trades.length ? (totalWins / trades.length) * 100 : 0;

  // Core node
  const totalPnl = trades.reduce((s, t) => s + (t.result || 0), 0);
  const coreSentiment: NodeSentiment = totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral";
  nodes.push({
    id: "core",
    label: "Your Trading",
    type: "behavior",
    sentiment: coreSentiment,
    size: 26,
    x: 50,
    y: 50,
    meta: { count: trades.length, pnl: totalPnl, detail: `${trades.length} trades · ${winRate.toFixed(1)}% win rate` },
  });

  // Place pair nodes around the top half
  const pairs = Array.from(pairAgg.entries()).slice(0, 6);
  const maxPairCount = Math.max(...pairs.map(([, v]) => v.count), 1);
  pairs.forEach(([pair, v], i) => {
    const angle = (Math.PI / (pairs.length + 1)) * (i + 1);
    const x = 50 + Math.cos(angle) * 38;
    const y = 28 - Math.sin(angle) * 8;
    const sentiment: NodeSentiment = v.pnl > 0 ? "positive" : v.pnl < 0 ? "negative" : "neutral";
    const id = `pair-${pair}`;
    nodes.push({
      id,
      label: pair,
      type: "trade",
      sentiment,
      size: 10 + (v.count / maxPairCount) * 14,
      x,
      y,
      meta: { count: v.count, pnl: v.pnl, pair, detail: `${v.count} trades · ${v.wins}/${v.count} wins` },
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
    nodes.push({
      id,
      label: session,
      type: "setup",
      sentiment: "neutral",
      size: 10 + (v.count / maxSessionCount) * 10,
      x,
      y,
      meta: { count: v.count, pnl: v.pnl, detail: `${session} session · ${v.count} trades` },
    });
    edges.push({ from: "core", to: id, strength: 0.3 + (v.count / maxSessionCount) * 0.5 });
  });

  // Behavior nodes at the bottom
  const behaviors: { label: string; sentiment: NodeSentiment; visible: boolean; detail: string }[] = [
    { label: "Discipline", sentiment: "positive", visible: winRate >= 50, detail: `Strong win rate of ${winRate.toFixed(1)}%` },
    { label: "Risk Control", sentiment: "positive", visible: avgWin >= avgLoss && avgLoss > 0, detail: `Avg win ($${avgWin.toFixed(0)}) ≥ avg loss ($${avgLoss.toFixed(0)})` },
    { label: "Overtrading", sentiment: "negative", visible: trades.length > 50 && winRate < 45, detail: "High volume with low win rate" },
    { label: "Cut Winners Early", sentiment: "negative", visible: avgWin > 0 && avgLoss > 0 && avgWin < avgLoss, detail: "Avg loss exceeds avg win" },
    { label: "Consistency", sentiment: "positive", visible: trades.length >= 10 && winRate >= 55, detail: "Sustained edge over many trades" },
  ].filter((b) => b.visible);

  behaviors.forEach((b, i) => {
    const angle = (Math.PI / (behaviors.length + 1)) * (i + 1);
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
  const topPair = pairs[0];
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
  const [size, setSize] = useState({ w: 800, h: 420 });

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

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const activeId = hoveredId || selectedId;
  const activeNode = activeId ? nodeById[activeId] : null;

  const toX = (p: number) => (p / 100) * size.w;
  const toY = (p: number) => (p / 100) * size.h;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={`rounded-2xl bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl overflow-hidden ${compact ? "flex flex-col flex-1 min-h-0" : ""}`}
    >
      {/* Header */}
      <div className={compact ? "flex items-center justify-between p-3 pb-2" : "flex items-center justify-between p-5 pb-3"}>
        <div className="flex items-center gap-2">
          <div className={compact ? "w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center" : "w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"}>
            <Brain className={compact ? "w-3.5 h-3.5 text-primary" : "w-5 h-5 text-primary"} />
          </div>
          <div>
            <h3 className={compact ? "text-xs font-semibold text-foreground leading-tight" : "text-base font-semibold text-foreground"}>
              Intelligence Map
            </h3>
            {!compact && <p className="text-xs text-muted-foreground">Your trading mind, visualized</p>}
          </div>
        </div>
        {!compact && (
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <Legend color={COLORS.positive} label="Profitable" />
            <Legend color={COLORS.negative} label="Losing" />
            <Legend color={COLORS.neutral} label="Setup" />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full ${compact ? "flex-1 min-h-[200px]" : "h-[420px]"} bg-gradient-to-b from-background/40 to-background/10`}
        onClick={() => setSelectedId(null)}
      >
        <svg width={size.w} height={size.h} className="absolute inset-0">
          <defs>
            {(["positive", "negative", "neutral"] as NodeSentiment[]).map((s) => (
              <radialGradient key={s} id={`grad-${s}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={COLORS[s]} stopOpacity="0.95" />
                <stop offset="100%" stopColor={COLORS[s]} stopOpacity="0.4" />
              </radialGradient>
            ))}
            <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const isActive = activeId === e.from || activeId === e.to;
            const stroke = b.sentiment === "negative" || a.sentiment === "negative"
              ? COLORS.negative
              : b.sentiment === "positive" || a.sentiment === "positive"
              ? COLORS.positive
              : COLORS.neutral;
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={toX(a.x)}
                  y1={toY(a.y)}
                  x2={toX(b.x)}
                  y2={toY(b.y)}
                  stroke={stroke}
                  strokeOpacity={isActive ? 0.6 : 0.18}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray="4 6"
                  style={{
                    transition: "stroke-opacity 200ms ease, stroke-width 200ms ease",
                  }}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-20"
                    dur={`${4 + (i % 3)}s`}
                    repeatCount="indefinite"
                  />
                </line>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const cx = toX(n.x);
            const cy = toY(n.y);
            const isActive = activeId === n.id;
            const isCore = n.id === "core";
            const sizeFactor = compact ? 0.6 : 1;
            const r = Math.max(4, n.size * sizeFactor);
            return (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedId((prev) => (prev === n.id ? null : n.id));
                }}
              >
                {/* Soft halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + (isActive ? 8 : 5)}
                  fill={COLORS[n.sentiment]}
                  opacity={isActive ? 0.18 : 0.08}
                  style={{ transition: "all 220ms ease" }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={`url(#grad-${n.sentiment})`}
                  stroke={COLORS[n.sentiment]}
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  filter="url(#node-glow)"
                >
                  {isCore && (
                    <animate
                      attributeName="r"
                      values={`${r};${r + 1.5};${r}`}
                      dur="3.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                {/* Label - hidden in compact mode unless active */}
                {(!compact || isActive) && (
                  <text
                    x={cx}
                    y={cy + r + (compact ? 10 : 14)}
                    textAnchor="middle"
                    fill="hsl(var(--foreground))"
                    fillOpacity={isActive ? 1 : 0.7}
                    fontSize={compact ? 8 : isCore ? 12 : 10}
                    fontWeight={isCore ? 600 : 500}
                    style={{ transition: "fill-opacity 200ms ease", pointerEvents: "none" }}
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Detail panel */}
        {activeNode && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-sm rounded-xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: COLORS[activeNode.sentiment] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{activeNode.label}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {activeNode.type}
                  </span>
                </div>
                {activeNode.meta.detail && (
                  <p className="text-xs text-muted-foreground mt-1">{activeNode.meta.detail}</p>
                )}
                {typeof activeNode.meta.pnl === "number" && (
                  <p
                    className="text-xs font-mono mt-1"
                    style={{ color: activeNode.meta.pnl >= 0 ? COLORS.positive : COLORS.negative }}
                  >
                    Net P&L: {activeNode.meta.pnl >= 0 ? "+" : ""}${activeNode.meta.pnl.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty hint */}
        {!activeNode && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-muted-foreground/70 pointer-events-none">
            <Info className="w-3.5 h-3.5" />
            Hover or tap a node to inspect
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      <span>{label}</span>
    </div>
  );
}
