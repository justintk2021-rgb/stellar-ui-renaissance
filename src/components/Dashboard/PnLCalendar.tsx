import { useState, useMemo } from "react";
import { Trade, DailyStats, NotebookEntry } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3, Clock, MoreVertical, FileText, StickyNote, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import { toast } from "sonner";

interface PnLCalendarProps {
  trades: Trade[];
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void;
  notebookEntries?: NotebookEntry[];
  onSaveEntry?: (entry: NotebookEntry) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Format large numbers as K format
const formatPnL = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(2)}K`;
  }
  return `${value < 0 ? '-' : ''}$${absValue.toFixed(0)}`;
};

export function PnLCalendar({ trades, onUpdateTrade, notebookEntries = [], onSaveEntry }: PnLCalendarProps) {
  const { checklists } = useChecklists();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  const [noteDialogDate, setNoteDialogDate] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // Get daily notes (non-trade linked entries by date)
  const dailyNotes: Record<string, NotebookEntry[]> = {};
  notebookEntries.forEach((entry) => {
    if (!entry.tradeId && entry.date) {
      if (!dailyNotes[entry.date]) {
        dailyNotes[entry.date] = [];
      }
      dailyNotes[entry.date].push(entry);
    }
  });

  const dailyStats: Record<string, DailyStats & { winRate: number }> = {};
  const dailyTrades: Record<string, Trade[]> = {};
  
  trades.forEach((trade) => {
    if (!trade.date) return;
    if (!dailyStats[trade.date]) {
      dailyStats[trade.date] = { pnl: 0, trades: 0, winRate: 0 };
      dailyTrades[trade.date] = [];
    }
    dailyStats[trade.date].pnl += trade.result || 0;
    dailyStats[trade.date].trades += 1;
    dailyTrades[trade.date].push(trade);
  });

  // Calculate win rate for each day
  Object.keys(dailyTrades).forEach((date) => {
    const dayTrades = dailyTrades[date];
    const wins = dayTrades.filter(t => t.result > 0).length;
    dailyStats[date].winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const weeks: { pnl: number; days: number }[] = [];
    let currentWeek = { pnl: 0, days: 0 };
    let dayOfWeek = firstDayIndex;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const stat = dailyStats[dateStr];
      
      if (stat) {
        currentWeek.pnl += stat.pnl;
        currentWeek.days += 1;
      }

      dayOfWeek++;
      if (dayOfWeek === 7 || day === daysInMonth) {
        weeks.push({ ...currentWeek });
        currentWeek = { pnl: 0, days: 0 };
        dayOfWeek = 0;
      }
    }

    return weeks;
  }, [dailyStats, year, month, firstDayIndex, daysInMonth]);

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    let totalPnL = 0;
    let tradingDays = 0;

    Object.keys(dailyStats).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date.getFullYear() === year && date.getMonth() === month) {
        totalPnL += dailyStats[dateStr].pnl;
        tradingDays += 1;
      }
    });

    return { totalPnL, tradingDays };
  }, [dailyStats, year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToThisMonth = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleDayClick = (dateStr: string, hasTrades: boolean) => {
    if (hasTrades) {
      setSelectedDate(dateStr);
    }
  };

  const selectedTrades = selectedDate ? dailyTrades[selectedDate] || [] : [];

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
    pairs: [...new Set(selectedTrades.map(t => t.pair).filter(Boolean))],
  } : null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const openNoteDialog = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Check if there's an existing note for this date
    const existingNote = dailyNotes[dateStr]?.[0];
    if (existingNote) {
      setNoteTitle(existingNote.title);
      setNoteContent(existingNote.content);
    } else {
      setNoteTitle(`Daily Note - ${formatDate(dateStr)}`);
      setNoteContent("");
    }
    setNoteDialogDate(dateStr);
  };

  const saveNote = () => {
    if (!noteDialogDate || !onSaveEntry) return;
    
    const existingNote = dailyNotes[noteDialogDate]?.[0];
    const now = new Date().toISOString();
    
    const entry: NotebookEntry = {
      id: existingNote?.id || `daily-note-${noteDialogDate}-${Date.now()}`,
      title: noteTitle || `Daily Note - ${formatDate(noteDialogDate)}`,
      content: noteContent,
      category: "daily-journal",
      date: noteDialogDate,
      createdAt: existingNote?.createdAt || now,
      updatedAt: now,
    };
    
    onSaveEntry(entry);
    setNoteDialogDate(null);
    setNoteTitle("");
    setNoteContent("");
    toast.success("Note saved!");
  };

  // Check if current view is this month
  const isCurrentMonth = () => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  };

  // Check if a date is today
  const isToday = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  };

  return (
    <>
      <div className="glass rounded-2xl border border-border/40 shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-base font-semibold min-w-[140px]">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToThisMonth}
              className={cn(
                "text-xs h-7",
                isCurrentMonth() && "bg-primary/10 border-primary/30"
              )}
            >
              This month
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Monthly stats: </span>
              <span className={cn(
                "font-bold font-mono",
                monthlyStats.totalPnL >= 0 ? "text-primary" : "text-destructive"
              )}>
                {formatPnL(monthlyStats.totalPnL)}
              </span>
              <span className="text-sm text-muted-foreground ml-2">
                {monthlyStats.tradingDays} days
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Calendar Grid */}
          <div className="flex-1 p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border/30 mb-2">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px]" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const stat = dailyStats[dateStr];
                const hasTrades = !!stat;
                const hasNote = !!dailyNotes[dateStr]?.length;
                const today = isToday(dateStr);

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(dateStr, hasTrades)}
                    className={cn(
                      "relative min-h-[90px] rounded-xl p-2 transition-all duration-200 group border",
                      stat
                        ? stat.pnl > 0
                          ? "bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30 hover:border-emerald-500/50 cursor-pointer shadow-sm"
                          : stat.pnl < 0
                          ? "bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/30 hover:border-rose-500/50 cursor-pointer shadow-sm"
                          : "bg-muted/30 border-border/40 hover:bg-muted/50 cursor-pointer"
                        : "bg-card/50 border-border/30 hover:bg-muted/20 hover:border-border/50"
                    )}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-xs",
                        today 
                          ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center font-medium" 
                          : "text-muted-foreground"
                      )}>
                        {day}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {hasNote && (
                          <StickyNote className="w-3 h-3 text-secondary" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-background/50 transition-all">
                              <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => openNoteDialog(dateStr, e)}>
                              <FileText className="w-4 h-4 mr-2" />
                              {hasNote ? "Edit Note" : "Add Note"}
                            </DropdownMenuItem>
                            {hasTrades && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); }}>
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Trades
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Trade stats */}
                    {stat && (
                      <div className="flex flex-col items-center justify-center mt-2">
                        <span className={cn(
                          "text-base font-bold font-mono",
                          stat.pnl > 0 ? "text-emerald-600 dark:text-emerald-400" : stat.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}>
                          {formatPnL(stat.pnl)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {stat.trades} trade{stat.trades !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {stat.winRate.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Stats Sidebar */}
          <div className="w-32 border-l border-border/30 p-3 space-y-2">
            {weeklyStats.map((week, index) => (
              <div 
                key={index} 
                className={cn(
                  "p-2 rounded-lg border text-center",
                  week.pnl > 0 
                    ? "bg-emerald-500/10 border-emerald-500/20" 
                    : week.pnl < 0 
                    ? "bg-rose-500/10 border-rose-500/20"
                    : "bg-muted/20 border-border/30"
                )}
              >
                <div className="text-[10px] text-muted-foreground mb-1">
                  Week {index + 1}
                </div>
                <div className={cn(
                  "text-sm font-bold font-mono",
                  week.pnl > 0 ? "text-emerald-600 dark:text-emerald-400" : week.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                )}>
                  {formatPnL(week.pnl)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {week.days} day{week.days !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={!!noteDialogDate} onOpenChange={() => { setNoteDialogDate(null); setNoteTitle(""); setNoteContent(""); }}>
        <DialogContent className="sm:max-w-md glass border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader className="pb-4 border-b border-border/30">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {noteDialogDate && formatDate(noteDialogDate)}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Add a note for this day</p>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                className="bg-background/50 border-border/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Content</label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your thoughts, observations, market analysis..."
                className="min-h-[150px] bg-background/50 border-border/50 resize-none"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={saveNote}
                className="flex-1"
                disabled={!noteContent.trim()}
              >
                Save Note
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setNoteDialogDate(null); setNoteTitle(""); setNoteContent(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trade Details Modal */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
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
            <div className="space-y-5">
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
                  <div className="mb-1">
                    <span className="text-xs text-muted-foreground">Win Rate</span>
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
                  <div className="mb-1">
                    <span className="text-xs text-muted-foreground">Avg Win</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-primary">
                    ${dayMetrics.avgWin.toFixed(2)}
                  </span>
                </div>

                {/* Avg Loss */}
                <div className="p-4 rounded-xl border-2 border-destructive/40 bg-destructive/5">
                  <div className="mb-1">
                    <span className="text-xs text-muted-foreground">Avg Loss</span>
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
                  <div className="mb-3">
                    <span className="text-sm font-medium">Win/Loss Breakdown</span>
                  </div>
                  <DayCircularProgress 
                    value={dayMetrics.winRate}
                    winners={dayMetrics.wins}
                    losers={dayMetrics.losses}
                  />
                </div>

                {/* Cumulative P&L Chart */}
                <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
                  <div className="mb-3">
                    <span className="text-sm font-medium">Cumulative P&L</span>
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
              </div>

              {/* Individual Trades */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Details</span>
                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {selectedTrades.map((trade) => {
                    const tradeChecklist = trade.checklistId 
                      ? checklists.find(c => c.id === trade.checklistId) 
                      : null;
                    
                    return (
                      <div 
                        key={trade.id}
                        className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2"
                      >
                        <div className="flex items-center justify-between">
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
                          </div>
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            trade.result >= 0 ? "text-primary" : "text-destructive"
                          )}>
                            {trade.result >= 0 ? '+' : ''}${trade.result.toFixed(2)}
                          </span>
                        </div>
                        {tradeChecklist && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                            <span className="text-[10px] text-muted-foreground">Checklist:</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                              {tradeChecklist.name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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
    
    // Add starting point at 0
    const data = [{ trade: 0, value: 0, pair: 'Start', result: 0 }];
    
    let cumulative = 0;
    trades.forEach((trade, index) => {
      cumulative += trade.result || 0;
      data.push({
        trade: index + 1,
        value: cumulative,
        pair: trade.pair,
        result: trade.result,
      });
    });
    
    return data;
  }, [trades]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.trade === 0) return null;
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

  if (trades.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
        No trades to display
      </div>
    );
  }

  const minValue = Math.min(...chartData.map(d => d.value));
  const maxValue = Math.max(...chartData.map(d => d.value));
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.1, 10);

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dayCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="trade" 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value === 0 ? '' : `#${value}`}
          />
          <YAxis 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `$${value}`}
            tickLine={false}
            axisLine={false}
            width={50}
            domain={[minValue - padding, maxValue + padding]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="natural" 
            dataKey="value" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2.5}
            fill="url(#dayCumulativeGradient)" 
            dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
