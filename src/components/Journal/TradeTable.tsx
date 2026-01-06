import { useState, useEffect } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight, FileText, TrendingUp, TrendingDown, Trophy, Target, ClipboardCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

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
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onViewNotes: (trade: Trade) => void;
  index: number;
}

function TradeRowGroup({ date, trades, notebookEntries, checklists, onEdit, onDelete, onViewNotes, index }: TradeRowGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
        onClick={() => setIsExpanded(!isExpanded)}
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

        {/* Quick Actions for single trade */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {trades.length === 1 && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewNotes(trades[0])}
                className="h-8 px-3 text-xs gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <FileText className="w-3.5 h-3.5" />
                View Note
              </Button>
            </motion.div>
          )}
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
                    whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
                    className="grid grid-cols-[1fr_80px_100px_auto] gap-4 px-5 py-3 pl-12 bg-card/20 transition-colors duration-200"
                  >
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
                    <div onClick={(e) => e.stopPropagation()}>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewNotes(trade)}
                          className="h-7 px-3 text-xs gap-1.5 text-primary hover:bg-primary/10"
                        >
                          <FileText className="w-3 h-3" />
                          View Note
                        </Button>
                      </motion.div>
                    </div>
                    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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

  const groupedTrades = groupTradesByDate(trades);
  const sortedDates = Object.keys(groupedTrades).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const handleViewNotes = (trade: Trade) => {
    setSelectedTrade(trade);
    setNotesModalOpen(true);
  };

  const selectedTradeNote = selectedTrade 
    ? getTradeNote(notebookEntries, selectedTrade.id)
    : null;

  return (
    <>
      <motion.div 
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
            {trades.length > 0 && onClearAll && (
              <ConfirmDialog
                trigger={
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                      Clear All
                    </Button>
                  </motion.div>
                }
                title="Delete All Trades"
                description="This will permanently delete all your trades. This action cannot be undone."
                confirmLabel="Delete All"
                variant="destructive"
                onConfirm={onClearAll}
              />
            )}
            <Badge variant="secondary" className="text-[10px] px-2.5 py-0.5 bg-muted/50">
              {trades.length} {trades.length === 1 ? 'Trade' : 'Trades'}
            </Badge>
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
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewNotes={handleViewNotes}
                  index={index}
                />
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Notes Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="block">Trade Notes</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedTrade?.pair} • {selectedTrade?.date}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 p-4 rounded-lg bg-muted/20">
            {selectedTradeNote ? (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedTradeNote.content }}
              />
            ) : selectedTrade?.notes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTrade.notes}</p>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground italic">No notes for this trade.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedTrade) {
                  onSelectForNotebook(selectedTrade.id);
                  setNotesModalOpen(false);
                }
              }}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit in Notebook
            </Button>
            <Button onClick={() => setNotesModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
