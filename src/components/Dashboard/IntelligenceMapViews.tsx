import {
  Network,
  BarChart3,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SENTIMENT_COLORS,
  type BreakdownRow,
  type HealthPillar,
  type IntelligenceInsight,
  type IntelligenceSummary,
} from "@/lib/intelligenceMap";

export type IntelligenceViewMode = "network" | "breakdown" | "health" | "signals";

export const INTELLIGENCE_VIEWS: {
  id: IntelligenceViewMode;
  label: string;
  icon: typeof Network;
  description: string;
}[] = [
  {
    id: "network",
    label: "Network",
    icon: Network,
    description: "How pairs, sessions, and behaviors connect",
  },
  {
    id: "breakdown",
    label: "Breakdown",
    icon: BarChart3,
    description: "P&L and win rate by category",
  },
  {
    id: "health",
    label: "Health",
    icon: Activity,
    description: "Overall trading fitness score",
  },
  {
    id: "signals",
    label: "Signals",
    icon: Zap,
    description: "Strengths to keep and leaks to fix",
  },
];

export function ViewTabBar({
  active,
  onChange,
}: {
  active: IntelligenceViewMode;
  onChange: (v: IntelligenceViewMode) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 overflow-x-auto">
      {INTELLIGENCE_VIEWS.map((v) => {
        const Icon = v.icon;
        const isActive = active === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function PnlBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const positive = value >= 0;
  return (
    <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden min-w-[60px]">
      <div
        className={cn("h-full rounded-full transition-all", positive ? "bg-emerald-500" : "bg-red-500")}
        style={{ width: `${Math.max(pct, value !== 0 ? 8 : 0)}%` }}
      />
    </div>
  );
}

function BreakdownRowItem({ row, maxPnl }: { row: BreakdownRow; maxPnl: number }) {
  return (
    <div className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{row.label}</span>
          {row.count > 0 && (
            <span className="text-[9px] text-muted-foreground shrink-0">{row.count} trades</span>
          )}
        </div>
        {row.detail && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{row.detail}</p>
        )}
      </div>
      {row.winRate > 0 && (
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-10 text-right">
          {row.winRate.toFixed(0)}%
        </span>
      )}
      <PnlBar value={row.pnl} max={maxPnl} />
      <span
        className={cn(
          "text-xs font-mono font-semibold shrink-0 w-14 text-right",
          row.pnl >= 0 ? "text-emerald-500" : "text-red-500",
        )}
      >
        {row.pnl >= 0 ? "+" : ""}${Math.abs(row.pnl) >= 1000 ? `${(row.pnl / 1000).toFixed(1)}k` : row.pnl.toFixed(0)}
      </span>
    </div>
  );
}

function BreakdownSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: BreakdownRow[];
  emptyText: string;
}) {
  const maxPnl = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1);
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
        <p className="text-xs font-semibold text-foreground mb-1">{title}</p>
        <p className="text-[11px] text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/30 bg-background/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/20 bg-muted/10">
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      <div className="py-1">
        {rows.map((row) => (
          <BreakdownRowItem key={row.id} row={row} maxPnl={maxPnl} />
        ))}
      </div>
    </div>
  );
}

export function BreakdownView({
  pairs,
  sessions,
  weekdays,
  directions,
}: {
  pairs: BreakdownRow[];
  sessions: BreakdownRow[];
  weekdays: BreakdownRow[];
  directions: BreakdownRow[];
}) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Compare where your edge comes from — green bars are profit, red are loss.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownSection title="Pairs" rows={pairs} emptyText="Log trades with pair symbols to see breakdown." />
        <BreakdownSection title="Sessions" rows={sessions} emptyText="Tag trades with sessions (London, NY…) to analyze timing." />
        <BreakdownSection title="Weekdays" rows={weekdays} emptyText="Need more trades across different days of the week." />
        <BreakdownSection title="Direction" rows={directions} emptyText="Need both long and short trades to compare bias." />
      </div>
    </div>
  );
}

function HealthRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 72 ? SENTIMENT_COLORS.positive : score >= 45 ? "hsl(var(--primary))" : SENTIMENT_COLORS.negative;

  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity={0.35} />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">Grade {grade}</span>
      </div>
    </div>
  );
}

export function HealthView({
  summary,
  pillars,
}: {
  summary: IntelligenceSummary;
  pillars: HealthPillar[];
}) {
  const MomentumIcon =
    summary.momentum === "improving" ? TrendingUp : summary.momentum === "declining" ? TrendingDown : Activity;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="flex flex-col items-center gap-3">
          <HealthRing score={summary.healthScore} grade={summary.grade} />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MomentumIcon className="w-3.5 h-3.5" />
            Momentum: <span className="text-foreground capitalize">{summary.momentum}</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-3">
          <p className="text-xs text-muted-foreground">Five pillars of your trading health</p>
          {pillars.map((p) => (
            <div key={p.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{p.label}</span>
                <span className="text-muted-foreground font-mono">{p.detail}</span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    p.score >= 70 ? "bg-emerald-500" : p.score >= 45 ? "bg-primary" : "bg-red-500",
                  )}
                  style={{ width: `${p.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Net P&L", value: `$${summary.netPnL.toFixed(0)}`, pos: summary.netPnL >= 0 },
          { label: "Win Rate", value: `${summary.winRate.toFixed(1)}%`, pos: summary.winRate >= 50 },
          {
            label: "Profit Factor",
            value: summary.profitFactor >= 999 ? "∞" : summary.profitFactor.toFixed(2),
            pos: summary.profitFactor >= 1,
          },
          { label: "Expectancy", value: `$${summary.expectancy.toFixed(0)}`, pos: summary.expectancy >= 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/30 bg-background/50 px-3 py-2.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={cn("text-lg font-bold font-mono mt-0.5", s.pos ? "text-emerald-500" : "text-red-500")}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalCard({ row, variant }: { row: BreakdownRow; variant: "strength" | "weakness" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        variant === "strength" ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5",
      )}
    >
      <div className="flex items-start gap-2">
        {variant === "strength" ? (
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{row.label}</p>
          {row.detail && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{row.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SignalsView({
  strengths,
  weaknesses,
  positiveCount,
  negativeCount,
}: {
  strengths: BreakdownRow[];
  weaknesses: BreakdownRow[];
  positiveCount: number;
  negativeCount: number;
}) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-xs text-muted-foreground mb-4">
        Detected patterns from your trade history — {positiveCount} strengths, {negativeCount} areas to address.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-semibold text-foreground">Your Edge</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">{strengths.length}</span>
          </div>
          <div className="space-y-2">
            {strengths.length ? (
              strengths.map((s) => <SignalCard key={s.id} row={s} variant="strength" />)
            ) : (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/40 p-4 text-center">
                Keep trading — strengths appear with more data and consistent results.
              </p>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold text-foreground">Fix These</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">{weaknesses.length}</span>
          </div>
          <div className="space-y-2">
            {weaknesses.length ? (
              weaknesses.map((w) => <SignalCard key={w.id} row={w} variant="weakness" />)
            ) : (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/40 p-4 text-center">
                No major leaks detected — stay disciplined.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InsightsSidebar({
  summary,
  insights,
}: {
  summary: IntelligenceSummary;
  insights: IntelligenceInsight[];
}) {
  const gradeColors: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    B: "bg-primary/15 text-primary border-primary/30",
    C: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    D: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    F: "bg-red-500/15 text-red-500 border-red-500/30",
  };

  return (
    <div className="flex flex-col min-h-0 h-full bg-muted/5 overflow-hidden">
      <div className="shrink-0 p-4 pb-3 border-b border-border/20">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Trading health</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg border", gradeColors[summary.grade])}>
            Grade {summary.grade} · {summary.healthScore}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: "Win rate", value: `${summary.winRate.toFixed(1)}%` },
            { label: "Profit factor", value: summary.profitFactor >= 999 ? "∞" : summary.profitFactor.toFixed(2) },
            { label: "Expectancy", value: `$${summary.expectancy.toFixed(0)}` },
            { label: "Net P&L", value: `$${summary.netPnL.toFixed(0)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-background/50 border border-border/30 px-2.5 py-2">
              <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
              <p className="text-sm font-semibold font-mono text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2 sticky top-0 bg-muted/5 pb-2 z-10">
          <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Key insights</p>
          <span className="text-[9px] text-muted-foreground/70 ml-auto tabular-nums">{insights.length}</span>
        </div>
        <div className="space-y-2">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                ins.sentiment === "positive" && "border-emerald-500/25 bg-emerald-500/5",
                ins.sentiment === "negative" && "border-red-500/25 bg-red-500/5",
                ins.sentiment === "advice" && "border-primary/25 bg-primary/5",
                ins.sentiment === "neutral" && "border-border/40 bg-muted/20",
              )}
            >
              <p className="font-semibold text-foreground">{ins.title}</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">{ins.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
