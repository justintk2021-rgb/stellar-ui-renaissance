import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Trade } from "@/types/trade";
import {
  Brain,
  Sparkles,
  MousePointerClick,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Filter,
} from "lucide-react";
import {
  buildIntelligenceGraph,
  buildHealthPillars,
  extractBreakdown,
  LAYER_LABELS,
  SENTIMENT_COLORS,
  type MapNode,
  type MapEdge,
  type NodeType,
} from "@/lib/intelligenceMap";
import {
  ViewTabBar,
  BreakdownView,
  HealthView,
  SignalsView,
  InsightsSidebar,
  INTELLIGENCE_VIEWS,
  type IntelligenceViewMode,
} from "@/components/Dashboard/IntelligenceMapViews";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TradingIntelligenceMapProps {
  trades: Trade[];
  compact?: boolean;
}

type LayerFilter = Record<NodeType, boolean>;

const DEFAULT_LAYERS: LayerFilter = {
  trade: true,
  setup: true,
  behavior: true,
  weekday: true,
  direction: true,
};

function filterGraph(
  nodes: MapNode[],
  edges: MapEdge[],
  layers: LayerFilter,
): { nodes: MapNode[]; edges: MapEdge[] } {
  const visible = new Set(
    nodes.filter((n) => n.id === "core" || layers[n.type]).map((n) => n.id),
  );
  return {
    nodes: nodes.filter((n) => visible.has(n.id)),
    edges: edges.filter((e) => visible.has(e.from) && visible.has(e.to)),
  };
}

function MapCanvas({
  nodes,
  edges,
  height,
  compact,
  activeId,
  onSelect,
  onHover,
  showAllLabels,
  interactive = true,
}: {
  nodes: MapNode[];
  edges: MapEdge[];
  height: number;
  compact?: boolean;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  showAllLabels?: boolean;
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const gradPrefix = compact ? "im-c" : "im-e";

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [height]);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const toX = (p: number) => (p / 100) * size.w;
  const toY = (p: number) => (p / 100) * size.h;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height }}
      onClick={() => interactive && onSelect(null)}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <svg width={size.w} height={size.h} className="absolute inset-0">
        <defs>
          {(["positive", "negative", "neutral"] as const).map((s) => (
            <radialGradient key={s} id={`${gradPrefix}-grad-${s}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={SENTIMENT_COLORS[s]} stopOpacity="1" />
              <stop offset="60%" stopColor={SENTIMENT_COLORS[s]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={SENTIMENT_COLORS[s]} stopOpacity="0.2" />
            </radialGradient>
          ))}
        </defs>

        {edges.map((e, i) => {
          const a = nodeById[e.from];
          const b = nodeById[e.to];
          if (!a || !b) return null;
          const isConnected = activeId === e.from || activeId === e.to;
          const isDimmed = activeId && !isConnected;
          const stroke =
            b.sentiment === "negative" || a.sentiment === "negative"
              ? SENTIMENT_COLORS.negative
              : b.sentiment === "positive" || a.sentiment === "positive"
                ? SENTIMENT_COLORS.positive
                : SENTIMENT_COLORS.neutral;
          const x1 = toX(a.x);
          const y1 = toY(a.y);
          const x2 = toX(b.x);
          const y2 = toY(b.y);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const curveAmt = Math.min(50, len * 0.18) * (i % 2 === 0 ? 1 : -1);
          const cx1 = mx + (-dy / len) * curveAmt;
          const cy1 = my + (dx / len) * curveAmt;
          const path = `M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`;
          return (
            <path
              key={`edge-${i}`}
              d={path}
              fill="none"
              stroke={stroke}
              strokeOpacity={isConnected ? 0.75 : isDimmed ? 0.06 : 0.18}
              strokeWidth={isConnected ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {nodes.map((n) => {
          const cx = toX(n.x);
          const cy = toY(n.y);
          const isActive = activeId === n.id;
          const isDimmed = activeId && !isActive;
          const isCore = n.id === "core";
          const sizeFactor = compact ? 0.65 : 1;
          const r = Math.max(5, n.size * sizeFactor);
          const showLabel = showAllLabels || !compact || isActive || isCore;
          return (
            <g
              key={n.id}
              style={{ cursor: interactive ? "pointer" : "default", opacity: isDimmed ? 0.35 : 1 }}
              onMouseEnter={() => interactive && onHover(n.id)}
              onMouseLeave={() => interactive && onHover(null)}
              onClick={(ev) => {
                if (!interactive) return;
                ev.stopPropagation();
                onSelect(isActive ? null : n.id);
              }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r + (isActive ? 8 : 5)}
                fill={SENTIMENT_COLORS[n.sentiment]}
                opacity={isActive ? 0.2 : 0.08}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? r + 1.5 : r}
                fill={`url(#${gradPrefix}-grad-${n.sentiment})`}
                stroke={SENTIMENT_COLORS[n.sentiment]}
                strokeOpacity={isActive ? 1 : 0.7}
                strokeWidth={isCore ? 2 : isActive ? 1.5 : 1}
              />
              {showLabel && (
                <text
                  x={cx}
                  y={cy + r + (compact ? 11 : 15)}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fillOpacity={isActive ? 1 : isDimmed ? 0.3 : 0.75}
                  fontSize={compact ? (isCore ? 9 : 8) : isCore ? 13 : 10}
                  fontWeight={isCore ? 700 : 500}
                  style={{ pointerEvents: "none" }}
                >
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodeDetail({ node }: { node: MapNode }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div
        className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
        style={{ backgroundColor: SENTIMENT_COLORS[node.sentiment], boxShadow: `0 0 8px ${SENTIMENT_COLORS[node.sentiment]}` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{node.label}</p>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{LAYER_LABELS[node.type]}</span>
        </div>
        {node.meta.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{node.meta.detail}</p>}
      </div>
      {typeof node.meta.pnl === "number" && (
        <span
          className="text-xs font-mono font-semibold shrink-0 px-2 py-0.5 rounded-md"
          style={{
            color: node.meta.pnl >= 0 ? SENTIMENT_COLORS.positive : SENTIMENT_COLORS.negative,
            backgroundColor: `${node.meta.pnl >= 0 ? SENTIMENT_COLORS.positive : SENTIMENT_COLORS.negative}18`,
          }}
        >
          {node.meta.pnl >= 0 ? "+" : ""}${node.meta.pnl.toFixed(0)}
        </span>
      )}
    </div>
  );
}

function HealthBadge({ summary }: { summary: import("@/lib/intelligenceMap").IntelligenceSummary }) {
  const gradeColors: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    B: "bg-primary/15 text-primary border-primary/30",
    C: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    D: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    F: "bg-red-500/15 text-red-500 border-red-500/30",
  };
  const MomentumIcon =
    summary.momentum === "improving" ? TrendingUp : summary.momentum === "declining" ? TrendingDown : Minus;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg border", gradeColors[summary.grade])}>
        Grade {summary.grade} · {summary.healthScore}
      </span>
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <MomentumIcon className="w-3 h-3" />
        {summary.momentum}
      </span>
    </div>
  );
}

function LayerToggles({ layers, onChange }: { layers: LayerFilter; onChange: (l: LayerFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(LAYER_LABELS) as NodeType[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange({ ...layers, [type]: !layers[type] })}
          className={cn(
            "text-[10px] px-2 py-1 rounded-full border transition-colors",
            layers[type]
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-muted/30 text-muted-foreground border-border/40",
          )}
        >
          {LAYER_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

export function TradingIntelligenceMap({ trades, compact = false }: TradingIntelligenceMapProps) {
  const graph = useMemo(() => buildIntelligenceGraph(trades), [trades]);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<IntelligenceViewMode>("network");
  const [compactHoverId, setCompactHoverId] = useState<string | null>(null);
  const [expandedHoverId, setExpandedHoverId] = useState<string | null>(null);
  const [expandedSelectedId, setExpandedSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerFilter>(DEFAULT_LAYERS);

  const breakdown = useMemo(() => extractBreakdown(graph.nodes), [graph.nodes]);
  const healthPillars = useMemo(() => buildHealthPillars(graph.summary), [graph.summary]);
  const activeViewMeta = INTELLIGENCE_VIEWS.find((v) => v.id === viewMode);

  const filtered = useMemo(
    () => filterGraph(graph.nodes, graph.edges, layers),
    [graph.nodes, graph.edges, layers],
  );

  const nodeById = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const compactActiveId = compactHoverId;
  const expandedActiveId = expandedHoverId || expandedSelectedId;
  const expandedActiveNode = expandedActiveId ? nodeById[expandedActiveId] : null;

  const openExpanded = useCallback(() => {
    setCompactHoverId(null);
    setExpanded(true);
  }, []);

  const handleExpandedChange = useCallback((open: boolean) => {
    setExpanded(open);
    if (!open) {
      setExpandedHoverId(null);
      setExpandedSelectedId(null);
      setViewMode("network");
    }
  }, []);

  return (
    <>
      <div
        className={cn(
          "group relative rounded-2xl bg-gradient-to-br from-card/60 via-card/40 to-card/20 backdrop-blur-xl border border-border/40 shadow-xl overflow-hidden",
          compact ? "flex flex-col flex-1 min-h-0 cursor-pointer" : "",
          expanded && "opacity-60",
        )}
        onClick={compact && !expanded ? openExpanded : undefined}
        role={compact ? "button" : undefined}
        tabIndex={compact && !expanded ? 0 : undefined}
        onKeyDown={compact && !expanded ? (e) => { if (e.key === "Enter" || e.key === " ") openExpanded(); } : undefined}
      >
        <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl opacity-60" />

        <div className={cn("relative flex items-center justify-between", compact ? "px-3 pt-3 pb-2" : "px-5 pt-5 pb-3")}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("relative bg-primary/10 flex items-center justify-center shrink-0", compact ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl")}>
              <Brain className={cn("text-primary", compact ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className={cn("font-semibold text-foreground truncate", compact ? "text-xs" : "text-base")}>
                  Intelligence Map
                </h3>
                <Sparkles className={cn("text-primary/60 shrink-0", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
              </div>
              {compact ? (
                <HealthBadge summary={graph.summary} />
              ) : (
                <p className="text-xs text-muted-foreground">Your trading mind, visualized</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openExpanded(); }}
            className={cn(
              "shrink-0 rounded-lg border border-border/40 bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-colors flex items-center gap-1 text-muted-foreground hover:text-primary",
              compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-xs",
            )}
            aria-label="Expand intelligence map"
          >
            <Maximize2 className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {!compact && "Expand"}
          </button>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {expanded ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center bg-muted/10 text-muted-foreground",
                compact ? "h-[200px]" : "h-[420px]",
              )}
            >
              <Maximize2 className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs">Viewing expanded map</p>
            </div>
          ) : (
            <MapCanvas
              nodes={filtered.nodes}
              edges={filtered.edges}
              height={compact ? 200 : 420}
              compact={compact}
              activeId={compactActiveId}
              onSelect={() => {}}
              onHover={setCompactHoverId}
            />
          )}
        </div>

        <div
          className={cn(
            "relative border-t border-border/30 bg-background/30 backdrop-blur-sm flex items-center",
            compact ? "px-3 py-2 min-h-[52px]" : "px-5 py-3 min-h-[60px]",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {expanded ? (
            <p className="text-[10px] text-muted-foreground">Close expanded view to interact here</p>
          ) : compactActiveId && nodeById[compactActiveId] ? (
            <NodeDetail node={nodeById[compactActiveId]} />
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                <MousePointerClick className="w-3 h-3 shrink-0" />
                <span>{compact ? "Click to expand" : "Click nodes to inspect"}</span>
              </div>
              {graph.summary.totalTrades > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {graph.summary.positiveSignals}↑ {graph.summary.negativeSignals}↓
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={handleExpandedChange}>
        <DialogContent className="glass border-border/40 max-w-6xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold">Intelligence Map</DialogTitle>
                <p className="text-[11px] text-muted-foreground truncate">
                  {graph.summary.totalTrades} trades · {graph.summary.winRate.toFixed(1)}% WR · ${graph.summary.netPnL.toFixed(0)} net
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-2.5 border-b border-border/20 bg-muted/5 space-y-2">
            <ViewTabBar active={viewMode} onChange={setViewMode} />
            {activeViewMeta && (
              <p className="text-[11px] text-muted-foreground">{activeViewMeta.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] max-h-[min(85vh,720px)] min-h-0 overflow-hidden">
            <div className="flex flex-col min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-border/30">
              {viewMode === "network" && (
                <>
                  <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-border/20 bg-muted/10">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Filter className="w-3 h-3" />
                      Layers
                    </div>
                    <LayerToggles layers={layers} onChange={setLayers} />
                  </div>
                  <div className="flex-1 min-h-[320px] lg:min-h-[440px]">
                    <MapCanvas
                      nodes={filtered.nodes}
                      edges={filtered.edges}
                      height={440}
                      activeId={expandedActiveId}
                      onSelect={setExpandedSelectedId}
                      onHover={setExpandedHoverId}
                      showAllLabels
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-border/20 min-h-[68px]">
                    {expandedActiveNode ? (
                      <NodeDetail node={expandedActiveNode} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Select a node to inspect connections and stats.</p>
                    )}
                  </div>
                </>
              )}

              {viewMode === "breakdown" && (
                <BreakdownView
                  pairs={breakdown.pairs}
                  sessions={breakdown.sessions}
                  weekdays={breakdown.weekdays}
                  directions={breakdown.directions}
                />
              )}

              {viewMode === "health" && (
                <HealthView summary={graph.summary} pillars={healthPillars} />
              )}

              {viewMode === "signals" && (
                <SignalsView
                  strengths={breakdown.strengths}
                  weaknesses={breakdown.weaknesses}
                  positiveCount={graph.summary.positiveSignals}
                  negativeCount={graph.summary.negativeSignals}
                />
              )}
            </div>

            <div className="hidden lg:flex flex-col min-h-0 max-h-[min(85vh,720px)]">
              <InsightsSidebar summary={graph.summary} insights={graph.insights} />
            </div>
          </div>

          {/* Mobile insights — below main view */}
          <div className="lg:hidden max-h-[240px] overflow-hidden border-t border-border/30">
            <InsightsSidebar summary={graph.summary} insights={graph.insights} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
