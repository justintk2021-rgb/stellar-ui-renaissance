import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useEffect, useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { motion } from "framer-motion";
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
      const isPositive = data.value >= 0;
      return (
        <motion.div 
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn(
            "backdrop-blur-xl border rounded-xl px-4 py-3 shadow-2xl",
            isPositive 
              ? "bg-primary/10 border-primary/30" 
              : "bg-destructive/10 border-destructive/30"
          )}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">{data.formattedDate}</p>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isPositive ? "bg-primary" : "bg-destructive"
            )} />
            <p className={cn(
              "text-lg font-bold font-mono",
              isPositive ? "text-primary" : "text-destructive"
            )}>
              {isPositive ? '+' : ''}${data.value.toFixed(2)}
            </p>
          </div>
        </motion.div>
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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2 glass rounded-2xl p-6 border border-border/40 shadow-lg"
        >
          <Tabs defaultValue="cumulative" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/30">
                <TabsTrigger 
                  value="cumulative" 
                  className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  Cumulative P&L
                </TabsTrigger>
                <TabsTrigger 
                  value="daily" 
                  className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  Daily P&L
                </TabsTrigger>
              </TabsList>
              <InfoTooltip content="Track your profit and loss over time" />
            </div>
            
            <TabsContent value="cumulative" className="mt-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="h-[300px] rounded-xl bg-gradient-to-b from-muted/20 to-transparent p-2"
              >
                {chartData.cumulative.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData.cumulative} 
                      margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                    >
                      <defs>
                        <linearGradient id="areaGradientCumulative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="lineGradientCumulative" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area 
                        type="monotone"
                        dataKey="value" 
                        stroke="url(#lineGradientCumulative)"
                        strokeWidth={2.5}
                        fill="url(#areaGradientCumulative)"
                        animationBegin={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        dot={{
                          r: 4,
                          fill: "hsl(var(--background))",
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(var(--primary))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm">No trade data to display</p>
                  </div>
                )}
              </motion.div>
            </TabsContent>
            
            <TabsContent value="daily" className="mt-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="h-[300px] rounded-xl bg-gradient-to-b from-muted/20 to-transparent p-2"
              >
                {chartData.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData.daily}
                      margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                    >
                      <defs>
                        <linearGradient id="areaGradientDaily" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="lineGradientDaily" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area 
                        type="monotone"
                        dataKey="value" 
                        stroke="url(#lineGradientDaily)"
                        strokeWidth={2.5}
                        fill="url(#areaGradientDaily)"
                        animationBegin={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        dot={{
                          r: 4,
                          fill: "hsl(var(--background))",
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(var(--primary))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm">No trade data to display</p>
                  </div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
