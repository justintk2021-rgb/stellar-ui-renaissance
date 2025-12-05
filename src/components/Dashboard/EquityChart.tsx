import { useMemo } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface EquityChartProps {
  trades: Trade[];
  startBalance: number;
  onSetBalance: () => void;
}

export function EquityChart({ trades, startBalance, onSetBalance }: EquityChartProps) {
  const { chartData, currentBalance, change } = useMemo(() => {
    const sortedTrades = [...trades].sort((a, b) => {
      if (a.date === b.date) return parseInt(a.id) - parseInt(b.id);
      return a.date < b.date ? -1 : 1;
    });

    let equity = startBalance;
    const data = [{ name: "Start", value: startBalance, date: "" }];
    
    sortedTrades.forEach((trade, index) => {
      equity += trade.result || 0;
      data.push({
        name: `Trade ${index + 1}`,
        value: equity,
        date: trade.date,
      });
    });

    if (data.length === 1) {
      data.push({ name: "Current", value: startBalance, date: "" });
    }

    return {
      chartData: data,
      currentBalance: equity,
      change: equity - startBalance,
    };
  }, [trades, startBalance]);

  const isPositive = change >= 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-xs text-muted-foreground">{data.name}</p>
          <p className="text-sm font-bold font-mono text-foreground">
            ${data.value.toFixed(2)}
          </p>
          {data.date && (
            <p className="text-xs text-muted-foreground mt-1">{data.date}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold">Account Growth</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Equity curve based on your trade P/L
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</div>
              <div className="text-sm font-bold font-mono">${startBalance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
              <div className="text-sm font-bold font-mono">${currentBalance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change</div>
              <div className={`text-sm font-bold font-mono ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSetBalance}
            className="text-xs border-border/50 hover:border-primary/50 hover:bg-primary/10"
          >
            <Settings2 className="w-3 h-3 mr-1" />
            Set Balance
          </Button>
        </div>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden border border-secondary/30 bg-card/50">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
          >
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  stopOpacity={0.4}
                />
                <stop
                  offset="50%"
                  stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  stopOpacity={0.1}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop
                  offset="0%"
                  stopColor={isPositive ? "hsl(160, 84%, 50%)" : "hsl(var(--destructive))"}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? "hsl(var(--primary))" : "hsl(350, 89%, 60%)"}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              width={70}
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={startBalance}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#lineGradient)"
              strokeWidth={2.5}
              fill="url(#equityGradient)"
              dot={{
                r: 4,
                fill: "hsl(var(--background))",
                stroke: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))",
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
