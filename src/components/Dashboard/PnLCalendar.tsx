import { useState, useMemo } from "react";
import { Trade, DailyStats } from "@/types/trade";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, BarChart3, Clock, Crosshair, LineChart, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TradingViewChart } from "./TradingViewChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
interface PnLCalendarProps {
  trades: Trade[];
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PnLCalendar({ trades, onUpdateTrade }: PnLCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTradeForChart, setSelectedTradeForChart] = useState<Trade | null>(null);

  const dailyStats: Record<string, DailyStats> = {};
  const dailyTrades: Record<string, Trade[]> = {};
  
  trades.forEach((trade) => {
    if (!trade.date) return;
    if (!dailyStats[trade.date]) {
      dailyStats[trade.date] = { pnl: 0, trades: 0 };
      dailyTrades[trade.date] = [];
    }
    dailyStats[trade.date].pnl += trade.result || 0;
    dailyStats[trade.date].trades += 1;
    dailyTrades[trade.date].push(trade);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (dateStr: string, hasTrades: boolean) => {
    if (hasTrades) {
      setSelectedDate(dateStr);
    }
  };

  const selectedTrades = selectedDate ? dailyTrades[selectedDate] || [] : [];
  const selectedStats = selectedDate ? dailyStats[selectedDate] : null;

  // Calculate metrics for selected day
  const dayMetrics = selectedTrades.length > 0 ? {
    totalTrades: selectedTrades.length,
    wins: selectedTrades.filter(t => t.result > 0).length,
    losses: selectedTrades.filter(t => t.result < 0).length,
    breakeven: selectedTrades.filter(t => t.result === 0).length,
    grossProfit: selectedTrades.filter(t => t.result > 0).reduce((sum, t) => sum + t.result, 0),
    grossLoss: selectedTrades.filter(t => t.result < 0).reduce((sum, t) => sum + t.result, 0),
    netPnL: selectedTrades.reduce((sum, t) => sum + t.result, 0),
    winRate: (selectedTrades.filter(t => t.result > 0).length / selectedTrades.length) * 100,
    avgWin: selectedTrades.filter(t => t.result > 0).length > 0 
      ? selectedTrades.filter(t => t.result > 0).reduce((sum, t) => sum + t.result, 0) / selectedTrades.filter(t => t.result > 0).length 
      : 0,
    avgLoss: selectedTrades.filter(t => t.result < 0).length > 0 
      ? selectedTrades.filter(t => t.result < 0).reduce((sum, t) => sum + t.result, 0) / selectedTrades.filter(t => t.result < 0).length 
      : 0,
    sessions: [...new Set(selectedTrades.map(t => t.session).filter(Boolean))],
    strategies: [...new Set(selectedTrades.map(t => t.strategy).filter(Boolean))],
    pairs: [...new Set(selectedTrades.map(t => t.pair).filter(Boolean))],
  } : null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">PnL Calendar</h3>
            <p className="text-xs text-muted-foreground mt-1">Click a day with trades to view metrics</p>
          </div>
          <Badge variant="outline" className="border-secondary/40 text-muted-foreground text-xs">
            Calendar
          </Badge>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={prevMonth}
            className="w-8 h-8 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-4 py-1.5 rounded-full border border-border/50 bg-muted/30 text-sm font-medium min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="w-8 h-8 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground pb-2">
              {day}
            </div>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const stat = dailyStats[dateStr];
            const hasTrades = !!stat;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(dateStr, hasTrades)}
                className={cn(
                  "min-h-[72px] rounded-xl border p-2 flex flex-col gap-1 transition-all duration-200",
                  stat
                    ? stat.pnl > 0
                      ? "calendar-cell-positive cursor-pointer hover:scale-105 hover:shadow-lg"
                      : stat.pnl < 0
                      ? "calendar-cell-negative cursor-pointer hover:scale-105 hover:shadow-lg"
                      : "calendar-cell-flat cursor-pointer hover:scale-105 hover:shadow-lg"
                    : "border-border/30 bg-muted/20"
                )}
              >
                <span className="text-xs text-muted-foreground">{day}</span>
                {stat && (
                  <>
                    <span className={cn(
                      "text-sm font-bold font-mono",
                      stat.pnl > 0 ? "text-primary" : stat.pnl < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {stat.pnl > 0 ? '+' : ''}{stat.pnl.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {stat.trades} trade{stat.trades !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trade Details Modal */}
      <Dialog open={!!selectedDate} onOpenChange={() => { setSelectedDate(null); setSelectedTradeForChart(null); }}>
        <DialogContent className="sm:max-w-2xl glass border-border/50 bg-card/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold">
                  {selectedDate && formatDate(selectedDate)}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">Daily Trade Summary</p>
              </div>
            </div>
          </DialogHeader>

          {dayMetrics && (
            <Tabs defaultValue="metrics" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="metrics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="chart" className="flex items-center gap-2">
                  <LineChart className="w-4 h-4" />
                  Chart Editor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="metrics" className="space-y-5">
                {/* Top Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* NET P&L */}
                  <div className={cn(
                    "p-4 rounded-xl border",
                    dayMetrics.netPnL >= 0 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">Net P&L</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Total profit/loss for the day</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xl font-bold font-mono",
                        dayMetrics.netPnL >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        {dayMetrics.netPnL >= 0 ? '+' : ''}${dayMetrics.netPnL.toFixed(2)}
                      </span>
                      {dayMetrics.netPnL >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-primary" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="p-4 rounded-xl border border-border/30 bg-muted/20">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">Win Rate</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Percentage of winning trades</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <span className={cn(
                      "text-xl font-bold font-mono",
                      dayMetrics.winRate >= 50 ? "text-primary" : "text-destructive"
                    )}>
                      {dayMetrics.winRate.toFixed(1)}%
                    </span>
                  </div>

                  {/* Avg Win */}
                  <div className="p-4 rounded-xl border-2 border-primary/40 bg-primary/5">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">Avg Win</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Average winning trade amount</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-xl font-bold font-mono text-primary">
                      ${dayMetrics.avgWin.toFixed(2)}
                    </span>
                  </div>

                  {/* Avg Loss */}
                  <div className="p-4 rounded-xl border-2 border-destructive/40 bg-destructive/5">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">Avg Loss</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Average losing trade amount</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-xl font-bold font-mono text-destructive">
                      -${Math.abs(dayMetrics.avgLoss).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Main Content - Win Rate Circle + Chart */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Win Rate Circular Display */}
                  <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Win/Loss Breakdown</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Distribution of wins vs losses</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <DayCircularProgress 
                      value={dayMetrics.winRate}
                      winners={dayMetrics.wins}
                      losers={dayMetrics.losses}
                    />
                  </div>

                  {/* Cumulative P&L Chart */}
                  <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Cumulative P&L</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Running total P&L throughout the day</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <DayCumulativeChart trades={selectedTrades} />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricRow icon={BarChart3} label="Total Trades" value={dayMetrics.totalTrades.toString()} />
                  <MetricRow label="Wins" value={dayMetrics.wins.toString()} isPositive />
                  <MetricRow label="Losses" value={dayMetrics.losses.toString()} isNegative />
                  <MetricRow label="Breakeven" value={dayMetrics.breakeven.toString()} />
                  <MetricRow label="Gross Profit" value={`$${dayMetrics.grossProfit.toFixed(2)}`} isPositive />
                  <MetricRow label="Gross Loss" value={`$${Math.abs(dayMetrics.grossLoss).toFixed(2)}`} isNegative />
                </div>

                {/* Tags Section */}
                <div className="space-y-3">
                  {dayMetrics.pairs.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Pairs:</span>
                      {dayMetrics.pairs.map((pair) => (
                        <Badge key={pair} variant="outline" className="text-xs border-secondary/50 bg-secondary/10">
                          {pair}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {dayMetrics.sessions.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Sessions:</span>
                      {dayMetrics.sessions.map((session) => (
                        <Badge key={session} variant="outline" className="text-xs border-border/50">
                          {session}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {dayMetrics.strategies.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Crosshair className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Setups:</span>
                      {dayMetrics.strategies.map((strategy) => (
                        <Badge key={strategy} variant="outline" className="text-xs border-primary/50 bg-primary/10 text-primary">
                          {strategy}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Trades */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Details</span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {selectedTrades.map((trade) => (
                      <div 
                        key={trade.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              trade.direction === 'Long' 
                                ? "border-primary/50 text-primary" 
                                : "border-destructive/50 text-destructive"
                            )}
                          >
                            {trade.direction}
                          </Badge>
                          <span className="text-sm font-medium">{trade.pair}</span>
                          {trade.strategy && (
                            <span className="text-xs text-muted-foreground">• {trade.strategy}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            trade.result >= 0 ? "text-primary" : "text-destructive"
                          )}>
                            {trade.result >= 0 ? '+' : ''}${trade.result.toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTradeForChart(trade)}
                            className="h-7 px-2 text-xs"
                          >
                            <LineChart className="w-3 h-3 mr-1" />
                            Chart
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chart" className="space-y-4">
                {selectedTradeForChart ? (
                  <TradingViewChart
                    pair={selectedTradeForChart.pair}
                    direction={selectedTradeForChart.direction}
                    existingImage={selectedTradeForChart.chartImage}
                    onSaveImage={(imageDataUrl) => {
                      if (onUpdateTrade) {
                        onUpdateTrade(selectedTradeForChart.id, { chartImage: imageDataUrl });
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <LineChart className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Select a trade from the Metrics tab to view chart
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => selectedTrades.length > 0 && setSelectedTradeForChart(selectedTrades[0])}
                    >
                      Select First Trade
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MetricRowProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  isPositive?: boolean;
  isNegative?: boolean;
}

function MetricRow({ icon: Icon, label, value, isPositive, isNegative }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={cn(
        "text-sm font-bold font-mono",
        isPositive && "text-primary",
        isNegative && "text-destructive",
        !isPositive && !isNegative && "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

// Circular progress for day metrics
function DayCircularProgress({ 
  value, 
  winners,
  losers,
}: { 
  value: number; 
  winners: number;
  losers: number;
}) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--destructive) / 0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
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
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline">
            <span className="text-2xl font-bold">{value.toFixed(0)}</span>
            <span className="text-sm font-bold text-muted-foreground">%</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Winrate</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <div className="flex flex-col">
            <span className="text-lg font-bold">{winners}</span>
            <span className="text-[10px] text-muted-foreground">winners</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <div className="flex flex-col">
            <span className="text-lg font-bold">{losers}</span>
            <span className="text-[10px] text-muted-foreground">losers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cumulative P&L chart for the day
function DayCumulativeChart({ trades }: { trades: Trade[] }) {
  const chartData = useMemo(() => {
    if (trades.length === 0) return [];
    
    let cumulative = 0;
    return trades.map((trade, index) => {
      cumulative += trade.result || 0;
      return {
        trade: index + 1,
        value: cumulative,
        pair: trade.pair,
        result: trade.result,
      };
    });
  }, [trades]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-xs text-muted-foreground">Trade #{data.trade}: {data.pair}</p>
          <p className={cn(
            "text-xs font-medium",
            data.result >= 0 ? "text-primary" : "text-destructive"
          )}>
            {data.result >= 0 ? '+' : ''}${data.result.toFixed(2)}
          </p>
          <p className={cn(
            "text-sm font-bold",
            data.value >= 0 ? "text-primary" : "text-destructive"
          )}>
            Total: ${data.value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
        No trades to display
      </div>
    );
  }

  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorDayCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="trade" 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `#${value}`}
          />
          <YAxis 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `$${value}`}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            fill="url(#colorDayCumulative)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
