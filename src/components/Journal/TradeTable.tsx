import { useState } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight, FileText } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface TradeTableProps {
  trades: Trade[];
  notebookEntries?: NotebookEntry[];
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

// Get notebook entry content as plain text
const getTradeNoteText = (entries: NotebookEntry[], tradeId: string): string => {
  const entry = getTradeNote(entries, tradeId);
  if (entry) {
    return extractPlainText(entry.content);
  }
  return '';
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

interface TradeRowGroupProps {
  date: string;
  trades: Trade[];
  notebookEntries: NotebookEntry[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onViewNotes: (trade: Trade) => void;
}

function TradeRowGroup({ date, trades, notebookEntries, onEdit, onDelete, onViewNotes }: TradeRowGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const metrics = calculateGroupMetrics(trades);
  const isProfit = metrics.grossPnL >= 0;

  return (
    <div className="border-b border-border/20">
      {/* Collapsed Header Row */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200",
          "hover:bg-primary/5",
          isExpanded && "bg-muted/20"
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.div>
        
        <div className="flex-1 flex items-center gap-6 flex-wrap">
          <span className="text-sm font-medium min-w-[160px]">{formatDate(date)}</span>
          <span className={cn(
            "text-sm font-bold font-mono",
            isProfit ? "text-primary" : "text-destructive"
          )}>
            Net P&L {isProfit ? '+' : ''}{metrics.grossPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
        </div>

        {/* Quick Actions for first trade */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {trades.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewNotes(trades[0])}
              className="h-7 px-3 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <FileText className="w-3 h-3" />
              View Note
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Metrics Bar */}
            <div className="px-4 py-4 bg-muted/10 border-t border-border/20">
              <div className="flex items-start gap-8 flex-wrap">
                {/* Mini Line Chart */}
                <div className="w-36 h-16 bg-muted/20 rounded-lg overflow-hidden p-2">
                  {trades.length === 1 ? (
                    // Single trade - show a simple bar indicator
                    <div className="w-full h-full flex items-end justify-center">
                      <div 
                        className={cn(
                          "w-8 rounded-t-md transition-all",
                          (trades[0].result || 0) >= 0 ? "bg-primary/60" : "bg-destructive/60"
                        )}
                        style={{ height: '70%' }}
                      />
                    </div>
                  ) : (
                    // Multiple trades - show line chart
                    <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                      {(() => {
                        const cumulative = trades.reduce<number[]>((acc, trade, i) => {
                          const prev = i > 0 ? acc[i - 1] : 0;
                          acc.push(prev + (trade.result || 0));
                          return acc;
                        }, []);
                        const maxVal = Math.max(...cumulative.map(Math.abs), 1);
                        const minVal = Math.min(...cumulative, 0);
                        const range = Math.max(maxVal - minVal, 1);
                        const baseline = 50 - (minVal / range) * -50;
                        
                        // Add starting point at 0
                        const allPoints = [0, ...cumulative];
                        const points = allPoints.map((val, i) => {
                          const x = (i / (allPoints.length - 1)) * 100;
                          const y = 50 - ((val - minVal) / range) * 45;
                          return `${x},${y}`;
                        }).join(' ');
                        
                        const areaPath = `M0,${baseline} L${points} L100,${baseline} Z`;
                        const finalValue = cumulative[cumulative.length - 1] || 0;
                        const isPositive = finalValue >= 0;
                        
                        return (
                          <>
                            <defs>
                              <linearGradient id={`gradient-${trades[0]?.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0.05" />
                              </linearGradient>
                            </defs>
                            <path
                              d={areaPath}
                              fill={`url(#gradient-${trades[0]?.id})`}
                            />
                            <polyline
                              points={points}
                              fill="none"
                              stroke={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        );
                      })()}
                    </svg>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Trades</div>
                    <div className="text-lg font-bold">{metrics.totalTrades}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Winners</div>
                    <div className="text-lg font-bold text-primary">{metrics.winners}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Losers</div>
                    <div className="text-lg font-bold text-destructive">{metrics.losers}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</div>
                    <div className="text-lg font-bold">{metrics.winRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross P&L</div>
                    <div className={cn("text-lg font-bold font-mono", isProfit ? "text-primary" : "text-destructive")}>
                      ${Math.abs(metrics.grossPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit Factor</div>
                    <div className="text-lg font-bold">
                      {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Trades */}
            <div className="divide-y divide-border/10">
              {trades.map((trade) => {
                const pl = trade.result || 0;
                const tradeIsProfit = pl >= 0;

                return (
                  <div
                    key={trade.id}
                    className="grid grid-cols-[1fr_80px_100px_auto] gap-4 px-4 py-2.5 pl-10 bg-card/30 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{trade.pair || '-'}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2 py-0",
                          trade.direction === 'Long'
                            ? "border-primary/50 text-primary"
                            : "border-destructive/50 text-destructive"
                        )}
                      >
                        {trade.direction}
                      </Badge>
                      {trade.session && (
                        <span className="text-xs text-muted-foreground">{trade.session}</span>
                      )}
                    </div>
                    <div className={cn(
                      "text-sm font-bold font-mono",
                      tradeIsProfit ? "text-primary" : "text-destructive"
                    )}>
                      {tradeIsProfit ? '+' : ''}{pl.toFixed(2)}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewNotes(trade)}
                        className="h-7 px-3 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <FileText className="w-3 h-3" />
                        View Note
                      </Button>
                    </div>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEdit(trade)}
                        className="w-7 h-7 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 rounded-full border-border/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        }
                        title="Delete Trade"
                        description="Are you sure you want to delete this trade? This action cannot be undone."
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => onDelete(trade.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TradeTable({ trades, notebookEntries = [], onEdit, onDelete, onSelectForNotebook, onClearAll }: TradeTableProps) {
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
  const selectedTradeNoteText = selectedTrade
    ? (selectedTradeNote ? extractPlainText(selectedTradeNote.content) : selectedTrade.notes || '')
    : '';

  return (
    <>
      <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Trade Log</h3>
            <p className="text-xs text-muted-foreground mt-1">Click a row to expand details</p>
          </div>
          <div className="flex items-center gap-2">
            {trades.length > 0 && onClearAll && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                    Clear All
                  </Button>
                }
                title="Delete All Trades"
                description="This will permanently delete all your trades. This action cannot be undone."
                confirmLabel="Delete All"
                variant="destructive"
                onConfirm={onClearAll}
              />
            )}
            <Badge variant="outline" className="border-secondary/40 text-muted-foreground text-xs">
              History
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-secondary/30 overflow-hidden bg-card">
          {/* Body */}
          <div className="max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto custom-scrollbar">
            {trades.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                No trades yet. Click "Add New Trade" to log your first trade.
              </div>
            ) : (
              sortedDates.map((date) => (
                <TradeRowGroup
                  key={date}
                  date={date}
                  trades={groupedTrades[date]}
                  notebookEntries={notebookEntries}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewNotes={handleViewNotes}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Trade Notes - {selectedTrade?.pair} ({selectedTrade?.date})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {selectedTradeNote ? (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedTradeNote.content }}
              />
            ) : selectedTrade?.notes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTrade.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes for this trade.</p>
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
            >
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
