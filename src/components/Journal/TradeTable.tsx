import { useState, useEffect, useRef, useMemo } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight, FileText, TrendingUp, TrendingDown, Trophy, Target, ClipboardCheck, ArrowLeft, Clock, LogIn, LogOut, Timer, Check, History } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

type HistoryPeriod = "all" | "week" | "month" | "3months" | "6months" | "year";

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "3months", label: "Last 3 months" },
  { value: "6months", label: "Last 6 months" },
  { value: "year", label: "Last year" },
];

function getPeriodCutoff(period: HistoryPeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case "week": d.setDate(d.getDate() - 7); break;
    case "month": d.setMonth(d.getMonth() - 1); break;
    case "3months": d.setMonth(d.getMonth() - 3); break;
    case "6months": d.setMonth(d.getMonth() - 6); break;
    case "year": d.setFullYear(d.getFullYear() - 1); break;
  }
  return d;
}

interface Checklist {
  id: string;
  name: string;
  items: { id: string; text: string; checked: boolean; percentage?: number }[];
  createdAt: string;
}

interface TradeTableProps {
  trades: Trade[];
  notebookEntries?: NotebookEntry[];
  checklists?: Checklist[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onSelectForNotebook: (id: string) => void;
  onClearAll?: () => void;
}

// Helper to extract plain text from HTML
const extractPlainText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// Get notebook entry for a trade
const getTradeNote = (entries: NotebookEntry[], tradeId: string): NotebookEntry | undefined => {
  return entries.find(e => e.tradeId === tradeId && !e.isDeleted);
};

// Group trades by date
const groupTradesByDate = (trades: Trade[]) => {
  const groups: Record<string, Trade[]> = {};
  trades.forEach(trade => {
    const date = trade.date || 'Unknown';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(trade);
  });
  return groups;
};

// Calculate metrics for a group of trades
const calculateGroupMetrics = (trades: Trade[]) => {
  const totalTrades = trades.length;
  const winners = trades.filter(t => (t.result || 0) > 0).length;
  const losers = trades.filter(t => (t.result || 0) < 0).length;
  const winRate = totalTrades > 0 ? (winners / totalTrades) * 100 : 0;
  
  const grossPnL = trades.reduce((sum, t) => sum + (t.result || 0), 0);
  const totalWins = trades.filter(t => (t.result || 0) > 0).reduce((sum, t) => sum + (t.result || 0), 0);
  const totalLosses = Math.abs(trades.filter(t => (t.result || 0) < 0).reduce((sum, t) => sum + (t.result || 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  return {
    totalTrades,
    winners,
    losers,
    winRate,
    grossPnL,
    profitFactor,
  };
};

// Format date for display
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Format a timestamp into a short HH:MM (date) string
const formatTimestamp = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
};

// Format a duration in ms into "1d 2h 15m" / "2h 15m" / "45m 12s" / "12s"
const formatDuration = (ms: number) => {
  if (!isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

// (Broker open/close times now live directly on the trade row, populated by
// the TradeLocker sync function — no separate fetch needed.)

// Live ticker that re-renders every second so open-trade durations update in real time
function useNowTicker(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

// Animated Line Chart Component
function AnimatedLineChart({ trades, isExpanded }: { trades: Trade[]; isExpanded: boolean }) {
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    if (isExpanded) {
      setAnimationProgress(0);
      const timeout = setTimeout(() => {
        setAnimationProgress(1);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isExpanded]);

  // Build cumulative P&L array starting from 0
  const cumulative = [0, ...trades.reduce<number[]>((acc, trade, i) => {
    const prev = i > 0 ? acc[i - 1] : 0;
    acc.push(prev + (trade.result || 0));
    return acc;
  }, [])];
  
  const maxVal = Math.max(...cumulative, 0);
  const minVal = Math.min(...cumulative, 0);
  const range = Math.max(maxVal - minVal, 1);
  
  const pointsArray = cumulative.map((val, i) => ({
    x: (i / (cumulative.length - 1)) * 100,
    y: 5 + ((maxVal - val) / range) * 40,
  }));
  
  const points = pointsArray.map(p => `${p.x},${p.y}`).join(' ');
  const zeroY = 5 + ((maxVal - 0) / range) * 40;
  const areaPath = `M0,${zeroY} L${points} L100,${zeroY} Z`;
  
  const finalValue = cumulative[cumulative.length - 1] || 0;
  const isPositive = finalValue >= 0;
  const gradientId = `gradient-${trades[0]?.id}-${Date.now()}`;

  // Calculate path length for animation
  let pathLength = 0;
  for (let i = 1; i < pointsArray.length; i++) {
    const dx = pointsArray[i].x - pointsArray[i - 1].x;
    const dy = pointsArray[i].y - pointsArray[i - 1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-40 h-20 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl overflow-hidden p-3 backdrop-blur-sm"
    >
      <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0.4" />
            <stop offset="100%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Zero line */}
        <motion.line
          x1="0"
          y1={zeroY}
          x2="100"
          y2={zeroY}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.2 }}
        />
        
        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
        
        {/* Line */}
        <motion.polyline
          points={points}
          fill="none"
          stroke={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: animationProgress }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ 
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength * (1 - animationProgress)
          }}
        />
        
        {/* End point dot */}
        <motion.circle
          cx={pointsArray[pointsArray.length - 1]?.x || 0}
          cy={pointsArray[pointsArray.length - 1]?.y || 0}
          r="3"
          fill={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3, type: "spring" }}
        />
      </svg>
    </motion.div>
  );
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  icon: Icon, 
  color = "default",
  delay = 0 
}: { 
  label: string; 
  value: string | number; 
  icon?: React.ElementType;
  color?: "default" | "primary" | "destructive";
  delay?: number;
}) {
  const colorClasses = {
    default: "text-foreground",
    primary: "text-primary",
    destructive: "text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className="group"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <motion.div 
        className={cn("text-xl font-bold tabular-nums", colorClasses[color])}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
      >
        {value}
      </motion.div>
    </motion.div>
  );
}

interface TradeRowGroupProps {
  date: string;
  trades: Trade[];
  notebookEntries: NotebookEntry[];
  checklists: Checklist[];
  now: number;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onViewNotes: (trade: Trade, allDayTrades?: Trade[]) => void;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function TradeRowGroup({ date, trades, notebookEntries, checklists, now, onEdit, onDelete, onViewNotes, index, isExpanded, onToggle }: TradeRowGroupProps) {
  const metrics = calculateGroupMetrics(trades);
  const isProfit = metrics.grossPnL >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="border-b border-border/20 last:border-b-0"
    >
      {/* Collapsed Header Row */}
      <motion.div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        whileHover={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "flex items-center gap-4 px-5 py-4 cursor-pointer transition-all duration-300",
          isExpanded && "bg-muted/30"
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, type: "spring", stiffness: 200 }}
          className={cn(
            "p-1.5 rounded-lg transition-colors duration-200",
            isExpanded ? "bg-primary/10" : "bg-muted/50"
          )}
        >
          <ChevronRight className={cn(
            "w-4 h-4 transition-colors duration-200",
            isExpanded ? "text-primary" : "text-muted-foreground"
          )} />
        </motion.div>
        
        <div className="flex-1 flex items-center gap-6 flex-wrap">
          <span className="text-sm font-semibold min-w-[180px]">{formatDate(date)}</span>
          <div className="flex items-center gap-2">
            {isProfit ? (
              <TrendingUp className="w-4 h-4 text-primary" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
            <span className={cn(
              "text-base font-bold font-mono",
              isProfit ? "text-primary" : "text-destructive"
            )}>
              {isProfit ? '+' : ''}{metrics.grossPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </span>
          </div>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-[10px] px-2 py-0.5 font-medium",
              metrics.winRate >= 50 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}
          >
            {metrics.winRate.toFixed(0)}% Win
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewNotes(trades[0], trades.length > 1 ? trades : undefined)}
              className="h-8 px-3 text-xs gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <FileText className="w-3.5 h-3.5" />
              {trades.length === 1 ? 'Note' : `Notes (${trades.length})`}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {/* Metrics Bar */}
            <div className="px-5 py-5 bg-gradient-to-br from-muted/20 via-muted/10 to-transparent border-t border-border/20">
              <div className="flex items-start gap-8 flex-wrap">
                {/* Animated Line Chart */}
                <AnimatedLineChart trades={trades} isExpanded={isExpanded} />

                {/* Metrics Grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-4">
                  <MetricCard 
                    label="Total Trades" 
                    value={metrics.totalTrades} 
                    icon={Target}
                    delay={0.1}
                  />
                  <MetricCard 
                    label="Winners" 
                    value={metrics.winners} 
                    icon={TrendingUp}
                    color="primary"
                    delay={0.15}
                  />
                  <MetricCard 
                    label="Losers" 
                    value={metrics.losers} 
                    icon={TrendingDown}
                    color="destructive"
                    delay={0.2}
                  />
                  <MetricCard 
                    label="Win Rate" 
                    value={`${metrics.winRate.toFixed(1)}%`} 
                    icon={Trophy}
                    color={metrics.winRate >= 50 ? "primary" : "destructive"}
                    delay={0.25}
                  />
                  <MetricCard 
                    label="Gross P&L" 
                    value={`$${Math.abs(metrics.grossPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    color={isProfit ? "primary" : "destructive"}
                    delay={0.3}
                  />
                  <MetricCard 
                    label="Profit Factor" 
                    value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                    delay={0.35}
                  />
                </div>
              </div>
            </div>

            {/* Individual Trades */}
            <div className="divide-y divide-border/10">
              {trades.map((trade, tradeIndex) => {
                const pl = trade.result || 0;
                const tradeIsProfit = pl >= 0;
                const checklist = trade.checklistId 
                  ? checklists.find(c => c.id === trade.checklistId)
                  : null;

                return (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + tradeIndex * 0.05 }}
                    className="px-5 py-3 pl-12 bg-card/20 hover:bg-muted/30 transition-colors duration-200"
                  >
                    <div className="grid grid-cols-[1fr_80px_auto] gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <motion.span 
                        className="text-sm font-semibold"
                        whileHover={{ scale: 1.02 }}
                      >
                        {trade.pair || '-'}
                      </motion.span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2.5 py-0.5 font-medium transition-all duration-200",
                          trade.direction === 'Long'
                            ? "border-primary/40 text-primary bg-primary/5"
                            : "border-destructive/40 text-destructive bg-destructive/5"
                        )}
                      >
                        {trade.direction}
                      </Badge>
                      {trade.session && (
                        <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
                          {trade.session}
                        </span>
                      )}
                      {trade.importedFromBroker && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium border-blue-500/40 text-blue-400 bg-blue-500/5">
                          Imported
                        </Badge>
                      )}
                      {checklist && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 font-medium bg-primary/10 text-primary gap-1"
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          {checklist.name}
                        </Badge>
                      )}
                    </div>
                    <div className={cn(
                      "text-sm font-bold font-mono flex items-center",
                      tradeIsProfit ? "text-primary" : "text-destructive"
                    )}>
                      {tradeIsProfit ? '+' : ''}{pl.toFixed(2)}
                    </div>
                    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {!trade.importedFromBroker && (
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(trade)}
                            className="w-7 h-7 rounded-lg hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </motion.div>
                      )}
                      <ConfirmDialog
                        trigger={
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                        }
                        title="Delete Trade"
                        description="Are you sure you want to delete this trade? This action cannot be undone."
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => onDelete(trade.id)}
                      />
                    </div>
                    </div>
                    {/* Time + Duration row (for imported broker trades) */}
                    {trade.importedFromBroker && (trade.openTime || trade.closeTime) && (() => {
                      const openMs = trade.openTime ? new Date(trade.openTime).getTime() : NaN;
                      const closeMs = trade.closeTime ? new Date(trade.closeTime).getTime() : null;
                      const isOpen = !closeMs;
                      const durationMs = isOpen
                        ? (isFinite(openMs) ? now - openMs : NaN)
                        : (isFinite(openMs) && closeMs ? closeMs - openMs : NaN);
                      return (
                        <div className="flex justify-center mt-2.5 mb-1.5 animate-fade-in">
                          <div className="inline-flex items-stretch gap-0 rounded-full bg-muted/40 backdrop-blur-sm px-1 py-0.5 shadow-sm">
                            {/* Open */}
                            {trade.openTime && (
                              <div className="flex items-center gap-1.5 px-3 py-1">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background/60">
                                  <LogIn className="w-3 h-3 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium">Open</span>
                                  <span className="font-mono text-xs font-semibold text-foreground">{formatTimestamp(trade.openTime)}</span>
                                </div>
                              </div>
                            )}

                            {/* Divider */}
                            <div className="w-px bg-border/50 my-1.5" />

                            {/* Close */}
                            <div className="flex items-center gap-1.5 px-3 py-1">
                              <div className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full",
                                isOpen ? "bg-primary/15" : "bg-background/60"
                              )}>
                                <LogOut className={cn(
                                  "w-3 h-3",
                                  isOpen ? "text-primary" : "text-muted-foreground"
                                )} />
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium">Close</span>
                                {trade.closeTime ? (
                                  <span className="font-mono text-xs font-semibold text-foreground">{formatTimestamp(trade.closeTime)}</span>
                                ) : (
                                  <span className="font-mono text-xs font-semibold text-primary">Still open</span>
                                )}
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="w-px bg-border/50 my-1.5" />

                            {/* Duration */}
                            <div className="flex items-center gap-1.5 px-3 py-1">
                              <div className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full",
                                isOpen ? "bg-primary/15" : "bg-background/60"
                              )}>
                                <Timer className={cn(
                                  "w-3 h-3",
                                  isOpen ? "text-primary" : "text-muted-foreground"
                                )} />
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium">Duration</span>
                                <span className={cn(
                                  "font-mono text-xs font-semibold tabular-nums",
                                  isOpen ? "text-primary" : "text-foreground"
                                )}>
                                  {formatDuration(durationMs)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Broker details row */}
                    {trade.importedFromBroker && (trade.openPrice || trade.closePrice || trade.swap || trade.commission) && (
                      <div className="flex items-center gap-4 mt-1.5 pl-0 flex-wrap">
                        {trade.openPrice != null && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="opacity-60">Open:</span>{' '}
                            <span className="font-mono font-medium text-foreground">{trade.openPrice.toFixed(trade.openPrice > 100 ? 2 : 5)}</span>
                          </span>
                        )}
                        {trade.closePrice != null && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="opacity-60">Close:</span>{' '}
                            <span className="font-mono font-medium text-foreground">{trade.closePrice.toFixed(trade.closePrice > 100 ? 2 : 5)}</span>
                          </span>
                        )}
                        {(trade.swap != null && trade.swap !== 0) && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="opacity-60">Swap:</span>{' '}
                            <span className={cn("font-mono font-medium", trade.swap < 0 ? "text-destructive" : "text-primary")}>
                              {trade.swap < 0 ? '' : '+'}{trade.swap.toFixed(2)}
                            </span>
                          </span>
                        )}
                        {(trade.commission != null && trade.commission !== 0) && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="opacity-60">Commission:</span>{' '}
                            <span className={cn("font-mono font-medium", trade.commission < 0 ? "text-destructive" : "text-foreground")}>
                              {trade.commission.toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function TradeTable({ trades, notebookEntries = [], checklists = [], onEdit, onDelete, onSelectForNotebook, onClearAll }: TradeTableProps) {
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [dayTrades, setDayTrades] = useState<Trade[] | null>(null);
  const [notesView, setNotesView] = useState<'list' | 'note'>('list');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("all");
  const [historySymbol, setHistorySymbol] = useState<string>("__all__");
  const [historyOpen, setHistoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => { if (t.pair) set.add(t.pair); });
    return Array.from(set).sort();
  }, [trades]);

  const filteredTrades = useMemo(() => {
    const cutoff = getPeriodCutoff(historyPeriod);
    return trades.filter(t => {
      if (historySymbol !== "__all__" && t.pair !== historySymbol) return false;
      if (cutoff) {
        const td = new Date(t.date);
        if (isNaN(td.getTime()) || td < cutoff) return false;
      }
      return true;
    });
  }, [trades, historyPeriod, historySymbol]);

  const isFilterActive = historyPeriod !== "all" || historySymbol !== "__all__";
  const activePeriodLabel = PERIOD_OPTIONS.find(p => p.value === historyPeriod)?.label ?? "All time";

  const groupedTrades = groupTradesByDate(filteredTrades);
  const sortedDates = Object.keys(groupedTrades).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Tick once per second so durations of still-open imported positions update
  // in real time when a row is expanded.
  const hasOpenImported = useMemo(
    () => filteredTrades.some(t => t.importedFromBroker && t.openTime && !t.closeTime),
    [filteredTrades]
  );
  const now = useNowTicker(expandedDate !== null && hasOpenImported, 1000);

  // Collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpandedDate(null);
      }
    };

    if (expandedDate) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedDate]);

  const handleCollapseAll = () => {
    setExpandedDate(null);
  };

  const handleViewNotes = (trade: Trade, allDayTrades?: Trade[]) => {
    if (allDayTrades && allDayTrades.length > 1) {
      setDayTrades(allDayTrades);
      setSelectedTrade(null);
      setNotesView('list');
      setNotesModalOpen(true);
    } else {
      setDayTrades(null);
      setSelectedTrade(trade);
      setNotesView('note');
      setNotesModalOpen(true);
    }
  };

  const handleSelectTradeFromList = (trade: Trade) => {
    setSelectedTrade(trade);
    setNotesView('note');
  };

  const handleBackToList = () => {
    setSelectedTrade(null);
    setNotesView('list');
  };

  const handleCloseModal = () => {
    setNotesModalOpen(false);
    setTimeout(() => {
      setSelectedTrade(null);
      setDayTrades(null);
      setNotesView('list');
    }, 200);
  };

  const selectedTradeNote = selectedTrade 
    ? getTradeNote(notebookEntries, selectedTrade.id)
    : null;

  return (
    <>
      <motion.div 
        ref={containerRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass rounded-2xl p-6 border border-border/30 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold">Trade Log</h3>
            <p className="text-xs text-muted-foreground mt-1">Click a row to expand details</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
              <PopoverTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isFilterActive
                      ? "bg-primary/15 text-primary hover:bg-primary/20"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                  aria-label="Trade history filter"
                >
                  <Clock className="w-4 h-4" />
                  {isFilterActive && (
                    <motion.span
                      layoutId="history-active-dot"
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                    />
                  )}
                </motion.button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-72 p-0 overflow-hidden rounded-2xl border-border/40 bg-popover/95 backdrop-blur-xl shadow-xl"
              >
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Trade History</span>
                    {isFilterActive && (
                      <button
                        onClick={() => { setHistoryPeriod("all"); setHistorySymbol("__all__"); }}
                        className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Symbol filter */}
                  <div className="px-4 py-3 border-b border-border/40">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">Symbol</span>
                      <Select value={historySymbol} onValueChange={setHistorySymbol}>
                        <SelectTrigger className="h-8 w-[150px] rounded-lg border-border/50 bg-muted/40 hover:bg-muted/60 text-sm focus:ring-1 focus:ring-ring/50 focus:ring-offset-0 transition-colors">
                          <SelectValue placeholder="All symbols" />
                        </SelectTrigger>
                        <SelectContent
                          align="end"
                          className="rounded-xl border-border/40 bg-popover/95 backdrop-blur-xl shadow-xl max-h-64"
                        >
                          <SelectItem value="__all__" className="rounded-lg text-sm">
                            All symbols
                          </SelectItem>
                          {availableSymbols.map(sym => (
                            <SelectItem key={sym} value={sym} className="rounded-lg text-sm font-mono">
                              {sym}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Period list */}
                  <div className="py-1">
                    {PERIOD_OPTIONS.map((opt, i) => {
                      const selected = historyPeriod === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => { setHistoryPeriod(opt.value); setHistoryOpen(false); }}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15, delay: i * 0.025 }}
                          whileHover={{ backgroundColor: "hsl(var(--muted) / 0.5)" }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors"
                        >
                          <span className={cn(selected ? "text-foreground font-medium" : "text-foreground/90")}>
                            {opt.label}
                          </span>
                          <AnimatePresence>
                            {selected && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                              >
                                <Check className="w-4 h-4 text-primary" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Footer summary */}
                  <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
                    <p className="text-[11px] text-muted-foreground">
                      Showing <span className="text-foreground font-medium">{filteredTrades.length}</span> of {trades.length} trades · {activePeriodLabel}
                    </p>
                  </div>
                </motion.div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">
          {/* Body */}
          <div className="max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto custom-scrollbar">
            {trades.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-20 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No trades yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Click "Add New Trade" to log your first trade.</p>
              </motion.div>
            ) : (
              sortedDates.map((date, index) => (
                <TradeRowGroup
                  key={date}
                  date={date}
                  trades={groupedTrades[date]}
                  notebookEntries={notebookEntries}
                  checklists={checklists}
                  now={now}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewNotes={handleViewNotes}
                  index={index}
                  isExpanded={expandedDate === date}
                  onToggle={() => setExpandedDate(expandedDate === date ? null : date)}
                />
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Notes Modal - supports both single trade and multi-trade day views */}
      <Dialog open={notesModalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {notesView === 'list' && dayTrades ? (
              <motion.div
                key="trade-list"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col flex-1 min-h-0"
              >
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="block">Trade Notes</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {dayTrades[0]?.date} • {dayTrades.length} trades
                      </span>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                  {dayTrades.map((trade, i) => {
                    const pl = trade.result || 0;
                    const isProfit = pl >= 0;
                    const hasNote = !!getTradeNote(notebookEntries, trade.id) || !!trade.notes;
                    return (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => { if (hasNote) handleSelectTradeFromList(trade); }}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-muted/20 border border-border/20 transition-all group",
                          hasNote && "hover:bg-muted/40 hover:border-border/40 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isProfit ? "bg-primary/10" : "bg-destructive/10"
                          )}>
                            {isProfit ? (
                              <TrendingUp className="w-5 h-5 text-primary" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-destructive" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{trade.pair}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] px-1.5 py-0 font-medium",
                                  trade.direction === 'Long'
                                    ? "border-primary/40 text-primary"
                                    : "border-destructive/40 text-destructive"
                                )}
                              >
                                {trade.direction}
                              </Badge>
                              {trade.session && (
                                <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                  {trade.session}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                isProfit ? "text-primary" : "text-destructive"
                              )}>
                                {isProfit ? '+' : ''}{pl.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {hasNote ? (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectForNotebook(trade.id);
                              handleCloseModal();
                            }}
                            className="gap-1.5 h-8"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Create Note
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : notesView === 'note' && selectedTrade ? (
              <motion.div
                key="trade-note"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col flex-1 min-h-0"
              >
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex items-center gap-3">
                    {dayTrades && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="w-8 h-8 rounded-lg hover:bg-muted/50 -ml-1"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="block">{selectedTrade.pair} • {selectedTrade.direction}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {selectedTrade.date}
                      </span>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 mt-4 rounded-lg bg-muted/20 flex flex-col overflow-hidden">
                  {selectedTradeNote ? (
                    <>
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 flex-shrink-0 bg-muted/30">
                        <h4 className="text-base font-semibold text-foreground truncate pr-3">{selectedTradeNote.title}</h4>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {new Date(selectedTradeNote.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                        {extractPlainText(selectedTradeNote.content).trim().length > 0 ? (
                          <div 
                            className="prose prose-sm dark:prose-invert max-w-none break-words"
                            dangerouslySetInnerHTML={{ __html: selectedTradeNote.content }}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground italic">This note is empty. Click "Edit in Notebook" to add content.</p>
                        )}
                      </div>
                    </>
                  ) : selectedTrade.notes ? (
                    <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{selectedTrade.notes}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center px-5 py-8">
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground italic">No note for this trade yet.</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Click "Create Note" below to add one.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40 flex-shrink-0">
                  <Button
                    variant={selectedTradeNote ? "outline" : "default"}
                    onClick={() => {
                      if (selectedTrade) {
                        onSelectForNotebook(selectedTrade.id);
                        handleCloseModal();
                      }
                    }}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    {selectedTradeNote ? 'Edit in Notebook' : 'Create Note'}
                  </Button>
                  <Button variant={selectedTradeNote ? "default" : "outline"} onClick={handleCloseModal}>
                    Close
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
