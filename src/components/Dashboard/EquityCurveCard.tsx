import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon, TrendingDown, TrendingUp, CalendarDays } from "lucide-react";
import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import {
  buildDailyPnLMap,
  formatPnL,
  parseLocalDateKey,
} from "@/lib/tradeFormat";

interface EquityCurveCardProps {
  trades: Trade[];
  brokerDayTotals?: Map<string, number> | null;
  className?: string;
}

type Range = "30d" | "90d" | "all";

const RANGES: { id: Range; label: string }[] = [
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "All" },
];

function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: { label: string; equity: number; day: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/50 bg-popover/80 backdrop-blur-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-muted-foreground mb-0.5">{p.label}</p>
      <p className={cn("text-sm font-bold font-mono", p.equity >= 0 ? "text-primary" : "text-destructive")}>
        {formatPnL(p.equity)}
      </p>
      <p className={cn("text-[11px] font-mono", p.day >= 0 ? "text-primary/80" : "text-destructive/80")}>
        day {formatPnL(p.day)}
      </p>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  positive,
  delay,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  positive: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 backdrop-blur px-3 py-2"
    >
      <div
        className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
          positive ? "bg-primary/15" : "bg-destructive/15",
        )}
      >
        <Icon className={cn("w-3.5 h-3.5", positive ? "text-primary" : "text-destructive")} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-1">{label}</p>
        <p className={cn("text-xs font-bold font-mono leading-none", positive ? "text-primary" : "text-destructive")}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

/** Animated cumulative P&L area chart built from daily totals. */
export function EquityCurveCard({ trades, brokerDayTotals = null, className }: EquityCurveCardProps) {
  const [range, setRange] = useState<Range>("30d");

  const data = useMemo(() => {
    const byDay = buildDailyPnLMap(trades, brokerDayTotals);
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (!days.length) return [];

    const cutoff = (() => {
      if (range === "all") return null;
      const d = new Date();
      d.setDate(d.getDate() - (range === "30d" ? 30 : 90));
      return d;
    })();

    let equity = 0;
    const rows: { label: string; equity: number; day: number }[] = [];
    for (const [key, pnl] of days) {
      equity += pnl;
      const date = parseLocalDateKey(key);
      if (cutoff && date < cutoff) continue;
      rows.push({
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        equity: Math.round(equity * 100) / 100,
        day: Math.round(pnl * 100) / 100,
      });
    }
    return rows;
  }, [trades, brokerDayTotals, range]);

  const summary = useMemo(() => {
    if (!data.length) return null;
    const last = data[data.length - 1].equity;
    const first = data[0].equity - data[0].day;
    const change = last - first;
    const bestDay = Math.max(...data.map((d) => d.day));
    const worstDay = Math.min(...data.map((d) => d.day));
    return { last, change, bestDay, worstDay, days: data.length };
  }, [data]);

  const positive = (summary?.last ?? 0) >= 0;
  const stroke = positive ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn("flex flex-col", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <LineChartIcon className="w-4 h-4 text-primary" />
          </span>
          Equity Curve
        </h3>
        <div className="flex items-center gap-0.5 p-1 rounded-xl border border-border/40 bg-card/60 backdrop-blur">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "relative px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors",
                range === r.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {range === r.id && (
                <motion.span
                  layoutId="equityRange"
                  className="absolute inset-0 rounded-lg bg-primary/15 border border-primary/25"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Big number + stat chips */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Cumulative P&L</p>
          <p
            className={cn(
              "text-3xl font-bold font-mono tracking-tight",
              positive ? "text-primary" : "text-destructive",
            )}
            style={{ textShadow: `0 0 24px ${positive ? "hsl(var(--primary) / 0.45)" : "hsl(var(--destructive) / 0.45)"}` }}
          >
            {formatPnL(summary?.last ?? 0)}
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <StatChip
              icon={summary.change >= 0 ? TrendingUp : TrendingDown}
              label="Range"
              value={formatPnL(summary.change)}
              positive={summary.change >= 0}
              delay={0.15}
            />
            <StatChip icon={TrendingUp} label="Best day" value={formatPnL(summary.bestDay)} positive delay={0.22} />
            <StatChip
              icon={TrendingDown}
              label="Worst day"
              value={formatPnL(summary.worstDay)}
              positive={summary.worstDay >= 0}
              delay={0.29}
            />
            <StatChip
              icon={CalendarDays}
              label="Trading days"
              value={`${summary.days}`}
              positive
              delay={0.36}
            />
          </div>
        )}
      </div>

      {/* Chart */}
      <div
        className="flex-1 min-h-[200px] rounded-2xl border border-border/40 bg-card/40 p-2"
        style={{ filter: `drop-shadow(0 4px 16px ${positive ? "hsl(var(--primary) / 0.18)" : "hsl(var(--destructive) / 0.18)"})` }}
      >
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 12 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 6"
                stroke="hsl(var(--border) / 0.35)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                dy={4}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "hsl(var(--muted-foreground) / 0.4)", strokeDasharray: 4 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={stroke}
                strokeWidth={2.5}
                fill="url(#equityFill)"
                animationDuration={1200}
                animationEasing="ease-out"
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: stroke }}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Not enough data yet — log or sync more trades
          </div>
        )}
      </div>
    </motion.div>
  );
}
