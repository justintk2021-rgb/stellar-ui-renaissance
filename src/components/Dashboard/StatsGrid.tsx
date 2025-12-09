import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useEffect, useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatsGridProps {
  trades: Trade[];
}

// Animated number component
function AnimatedNumber({ 
  value, 
  decimals = 2, 
  prefix = '', 
  suffix = '',
  className = '',
  duration = 1200
}: { 
  value: number; 
  decimals?: number; 
  prefix?: string; 
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const { formattedValue, isAnimating } = useCountUp({
    end: value,
    duration,
    decimals,
    prefix,
    suffix
  });

  return (
    <span className={cn(
      className,
      "transition-all duration-200",
      isAnimating && "scale-105"
    )}>
      {formattedValue}
    </span>
  );
}

// Large Circular progress component for winrate display
function LargeCircularProgress({ 
  value, 
  size = 160,
  winners,
  losers,
  label
}: { 
  value: number; 
  size?: number;
  winners: number;
  losers: number;
  label: string;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(animatedValue, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--destructive) / 0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--primary))"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline">
            <AnimatedNumber 
              value={animatedValue} 
              decimals={0} 
              className="text-4xl font-bold" 
              duration={1000} 
            />
            <span className="text-xl font-bold text-muted-foreground">%</span>
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <div className="flex flex-col">
            <span className="text-xl font-bold">{winners}</span>
            <span className="text-xs text-muted-foreground">winners</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <div className="flex flex-col">
            <span className="text-xl font-bold">{losers}</span>
            <span className="text-xs text-muted-foreground">losers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger>
          <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{content}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

export function StatsGrid({ trades }: StatsGridProps) {
  const stats = trades.reduce(
    (acc, trade) => {
      const pl = trade.result || 0;
      acc.net += pl;
      if (pl > 0) {
        acc.wins++;
        acc.totalWinAmount += pl;
      } else if (pl < 0) {
        acc.losses++;
        acc.totalLossAmount += Math.abs(pl);
      }
      return acc;
    },
    { wins: 0, losses: 0, net: 0, totalWinAmount: 0, totalLossAmount: 0 }
  );

  // Calculate day-based stats
  const tradingDays = new Map<string, number>();
  trades.forEach((trade) => {
    const date = trade.date;
    const current = tradingDays.get(date) || 0;
    tradingDays.set(date, current + (trade.result || 0));
  });

  const profitableDays = Array.from(tradingDays.values()).filter((pnl) => pnl > 0).length;
  const losingDays = Array.from(tradingDays.values()).filter((pnl) => pnl < 0).length;
  const totalDays = tradingDays.size;
  const dayWinRate = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;

  const winRate = trades.length > 0 ? (stats.wins / trades.length) * 100 : 0;
  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;
  
  // Profit Factor = Total Wins / Total Losses
  const profitFactor = stats.totalLossAmount > 0 ? stats.totalWinAmount / stats.totalLossAmount : stats.totalWinAmount > 0 ? Infinity : 0;

  // Chart data
  const chartData = useMemo(() => {
    if (trades.length === 0) return { cumulative: [], daily: [] };
    
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Group by date for daily P&L
    const dailyMap = new Map<string, number>();
    sortedTrades.forEach(trade => {
      const current = dailyMap.get(trade.date) || 0;
      dailyMap.set(trade.date, current + (trade.result || 0));
    });
    
    // Cumulative data
    let cumulative = 0;
    const cumulativeData = Array.from(dailyMap.entries()).map(([date, pnl]) => {
      cumulative += pnl;
      return {
        date,
        value: cumulative,
        formattedDate: format(parseISO(date), 'MM/dd/yyyy')
      };
    });
    
    // Daily data
    const dailyData = Array.from(dailyMap.entries()).map(([date, pnl]) => ({
      date,
      value: pnl,
      formattedDate: format(parseISO(date), 'MM/dd/yyyy')
    }));
    
    return { cumulative: cumulativeData, daily: dailyData };
  }, [trades]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground">{data.formattedDate}</p>
          <p className={cn(
            "text-sm font-bold",
            data.value >= 0 ? "text-primary" : "text-destructive"
          )}>
            ${data.value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Net P&L - Large Card */}
        <div className="glass rounded-xl p-5 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Total Net P&L</span>
            <InfoTooltip content="Total profit and loss across all trades" />
          </div>
          <div className="flex items-center gap-2">
            <AnimatedNumber 
              value={stats.net} 
              decimals={2} 
              prefix="$" 
              className={cn(
                "text-3xl font-bold font-mono",
                stats.net >= 0 ? "text-primary" : "text-destructive"
              )}
            />
            {stats.net >= 0 ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Trades in total: {trades.length}</p>
        </div>

        {/* Profit Factor */}
        <div className="glass rounded-xl p-5 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Profit Factor</span>
            <InfoTooltip content="Ratio of gross profit to gross loss. Above 1.5 is considered good." />
          </div>
          {profitFactor === Infinity ? (
            <span className="text-3xl font-bold font-mono text-primary">∞</span>
          ) : (
            <AnimatedNumber 
              value={profitFactor} 
              decimals={2}
              className={cn(
                "text-3xl font-bold font-mono",
                profitFactor >= 1 ? "text-primary" : "text-destructive"
              )}
            />
          )}
        </div>

        {/* Average Winning Trade */}
        <div className="glass rounded-xl p-5 border-2 border-primary/50 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Average Winning Trade</span>
            <InfoTooltip content="Average profit per winning trade" />
          </div>
          <AnimatedNumber 
            value={avgWin} 
            decimals={2} 
            prefix="$" 
            className="text-3xl font-bold font-mono text-primary"
          />
        </div>

        {/* Average Losing Trade */}
        <div className="glass rounded-xl p-5 border-2 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Average Losing Trade</span>
            <InfoTooltip content="Average loss per losing trade" />
          </div>
          <AnimatedNumber 
            value={avgLoss} 
            decimals={2} 
            prefix="-$" 
            className="text-3xl font-bold font-mono text-destructive"
          />
        </div>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Win Rate Cards */}
        <div className="space-y-4">
          {/* Winning % By Trades */}
          <div className="glass rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Winning % By Trades</span>
              <InfoTooltip content="Percentage of winning trades out of total trades" />
            </div>
            <LargeCircularProgress 
              value={winRate}
              winners={stats.wins}
              losers={stats.losses}
              label="WINRATE"
            />
          </div>

          {/* Winning % By Days */}
          <div className="glass rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Winning % By Days</span>
              <InfoTooltip content="Percentage of profitable trading days" />
            </div>
            <LargeCircularProgress 
              value={dayWinRate}
              winners={profitableDays}
              losers={losingDays}
              label="WINRATE"
            />
          </div>
        </div>

        {/* Right Column - P&L Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-5 border border-border/40">
          <Tabs defaultValue="cumulative" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="cumulative" className="text-xs">
                  Daily Net Cumulative P&L
                </TabsTrigger>
                <TabsTrigger value="daily" className="text-xs">
                  Net Daily P&L
                </TabsTrigger>
              </TabsList>
              <InfoTooltip content="Track your profit and loss over time" />
            </div>
            
            <TabsContent value="cumulative" className="mt-0">
              <div className="h-[280px]">
                {chartData.cumulative.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.cumulative}>
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.cumulative.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.value >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No trade data to display
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="daily" className="mt-0">
              <div className="h-[280px]">
                {chartData.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.daily}>
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.daily.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.value >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No trade data to display
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
