import { useState } from "react";
import { Trade, DailyStats } from "@/types/trade";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, BarChart3, Clock, Crosshair, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TradeChartEditor } from "./TradeChartEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
                {/* NET P&L Header */}
                <div className={cn(
                  "p-4 rounded-xl border",
                  dayMetrics.netPnL >= 0 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-destructive/10 border-destructive/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {dayMetrics.netPnL >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-primary" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-destructive" />
                      )}
                      <span className="text-sm font-medium text-muted-foreground">NET P&L</span>
                    </div>
                    <span className={cn(
                      "text-2xl font-bold font-mono",
                      dayMetrics.netPnL >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {dayMetrics.netPnL >= 0 ? '+' : ''}${dayMetrics.netPnL.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricRow icon={BarChart3} label="Total Trades" value={dayMetrics.totalTrades.toString()} />
                  <MetricRow icon={Target} label="Win Rate" value={`${dayMetrics.winRate.toFixed(1)}%`} isPositive={dayMetrics.winRate >= 50} />
                  <MetricRow label="Wins" value={dayMetrics.wins.toString()} isPositive />
                  <MetricRow label="Losses" value={dayMetrics.losses.toString()} isNegative />
                  <MetricRow label="Gross Profit" value={`$${dayMetrics.grossProfit.toFixed(2)}`} isPositive />
                  <MetricRow label="Gross Loss" value={`$${Math.abs(dayMetrics.grossLoss).toFixed(2)}`} isNegative />
                  <MetricRow label="Avg Win" value={`$${dayMetrics.avgWin.toFixed(2)}`} isPositive />
                  <MetricRow label="Avg Loss" value={`$${Math.abs(dayMetrics.avgLoss).toFixed(2)}`} isNegative />
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
                  <>
                    <TradeChartEditor
                      pair={selectedTradeForChart.pair}
                      direction={selectedTradeForChart.direction}
                      existingImage={selectedTradeForChart.chartImage}
                      onSaveImage={(imageDataUrl) => {
                        if (onUpdateTrade) {
                          onUpdateTrade(selectedTradeForChart.id, { chartImage: imageDataUrl });
                        }
                      }}
                    />
                    {selectedTradeForChart.chartImage && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saved Chart</span>
                        <div className="rounded-xl overflow-hidden border border-border/50">
                          <img 
                            src={selectedTradeForChart.chartImage} 
                            alt="Trade chart" 
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <LineChart className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Select a trade from the Metrics tab to add entry, TP & SL levels
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
