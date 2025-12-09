import { useMemo, useState, useRef, useEffect } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Check, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface EquityChartProps {
  trades: Trade[];
  startBalance: number;
  onSetBalance: (balance: number) => void;
}

export function EquityChart({ trades, startBalance, onSetBalance }: EquityChartProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(startBalance.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep editValue in sync with startBalance when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(startBalance.toString());
    }
  }, [startBalance, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(startBalance.toString());
    setIsEditing(true);
  };

  const handleConfirm = () => {
    const value = parseFloat(editValue);
    if (!isNaN(value) && value >= 0) {
      onSetBalance(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(startBalance.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  };

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
            {/* Start Balance - Editable */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</div>
              {isEditing ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-sm font-bold font-mono">$</span>
                  <Input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-24 h-6 text-sm font-bold font-mono px-1 py-0 bg-background/50 border-primary/50"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-primary hover:bg-primary/20"
                    onClick={handleConfirm}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    onClick={handleCancel}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="text-sm font-bold font-mono hover:text-primary transition-colors cursor-pointer flex items-center gap-1 group"
                >
                  ${startBalance.toFixed(2)}
                  <Settings2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
              <div className="text-sm font-bold font-mono">${currentBalance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">PnL</div>
              <div className={`text-sm font-bold font-mono ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden border border-secondary/30 bg-card/50">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
          >
            <defs>
              <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.6} />
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
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value >= startBalance ? "url(#barGradientPositive)" : "url(#barGradientNegative)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
