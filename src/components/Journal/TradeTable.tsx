import { memo, useState, useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trade, NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronRight, FileText, TrendingUp, TrendingDown, ClipboardCheck, ArrowLeft, Clock, LogIn, LogOut, Timer, Check, History } from "lucide-react";

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
import {
  getTradeLocalDateKey,
  getTradeNetResult,
  parseLocalDateKey,
  formatPnL,
  sumPnL,
} from "@/lib/tradeFormat";
import {
  PERIOD_OPTIONS,
  tradeMatchesHistoryPeriod,
  type HistoryPeriod,
} from "@/lib/tradeHistoryPeriod";
import { TradeScreenshot } from "./TradeScreenshot";

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
  userId?: string;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onSelectForNotebook: (id: string) => void;
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void | Promise<void>;
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

// Format the YYYY-MM-DD key as a LOCAL date. `new Date("2025-04-07")` parses
// as UTC midnight and would shift to Apr 6 in negative-UTC zones.
const formatDate = (dateStr: string) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? parseLocalDateKey(dateStr)
      : new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateOrDash = (dateStr?: string | null) => {
  if (!dateStr?.trim() || dateStr === "Unknown") return "—";
  return formatDate(dateStr);
};

const sortTradesChronologically = (trades: Trade[]): Trade[] => {
  const sortTime = (t: Trade) => {
    if (t.openTime) {
      const ms = new Date(t.openTime).getTime();
      if (!isNaN(ms)) return ms;
    }
    const key = getTradeLocalDateKey(t);
    if (key && key !== "Unknown") return parseLocalDateKey(key).getTime();
    return 0;
  };
  return [...trades].sort((a, b) => sortTime(a) - sortTime(b));
};

const sortTradesNewestFirst = (trades: Trade[]): Trade[] =>
  sortTradesChronologically(trades).reverse();

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

// Isolated live duration cell — only this component re-renders on the 1s ticker
function OpenTradeDuration({ openTime, closeTime }: { openTime?: string; closeTime?: string }) {
  const isOpen = !closeTime;
  const openMs = openTime ? new Date(openTime).getTime() : NaN;
  const closeMs = closeTime ? new Date(closeTime).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen || !isFinite(openMs)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen, openMs]);

  const durationMs = isOpen
    ? (isFinite(openMs) ? now - openMs : NaN)
    : (isFinite(openMs) && closeMs ? closeMs - openMs : NaN);

  return (
    <span className={cn(
      "font-mono text-xs font-semibold tabular-nums",
      isOpen ? "text-primary" : "text-foreground"
    )}>
      {formatDuration(durationMs)}
    </span>
  );
}

interface TradeEntryProps {
  trade: Trade;
  checklists: Checklist[];
  userId?: string;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onViewNotes: (trade: Trade) => void;
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void | Promise<void>;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function TradeEntry({ trade, checklists, userId, onEdit, onDelete, onViewNotes, onUpdateTrade, index, isExpanded, onToggle }: TradeEntryProps) {
  const pl = getTradeNetResult(trade);
  const tradeIsProfit = pl >= 0;
  const dateKey = getTradeLocalDateKey(trade) || trade.date || "Unknown";
  const checklist = trade.checklistId
    ? checklists.find((c) => c.id === trade.checklistId)
    : null;
  const closeMs = trade.closeTime ? new Date(trade.closeTime).getTime() : null;
  const isOpen = !closeMs;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
      className="border-b border-border/20 last:border-b-0"
    >
      <motion.div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        whileHover={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-300",
          isExpanded && "bg-muted/30"
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, type: "spring", stiffness: 200 }}
          className={cn(
            "p-1.5 rounded-lg transition-colors duration-200 shrink-0",
            isExpanded ? "bg-primary/10" : "bg-muted/50"
          )}
        >
          <ChevronRight className={cn(
            "w-4 h-4 transition-colors duration-200",
            isExpanded ? "text-primary" : "text-muted-foreground"
          )} />
        </motion.div>

        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground min-w-[132px] tabular-nums">
            {formatDate(dateKey)}
          </span>
          <span className="text-sm font-semibold">{trade.pair || "—"}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2.5 py-0.5 font-medium",
              trade.direction === "Long"
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
          "text-sm font-bold font-mono shrink-0 min-w-[72px] text-right",
          tradeIsProfit ? "text-primary" : "text-destructive"
        )}>
          {formatPnL(pl, { withSymbol: false })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewNotes(trade)}
              className="h-8 px-3 text-xs gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <FileText className="w-3.5 h-3.5" />
              Note
            </Button>
          </motion.div>
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
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-5 pb-4 pl-14 bg-card/20 border-t border-border/10">
              {trade.importedFromBroker && (trade.openTime || trade.closeTime) && (
                <div className="flex justify-center mt-3 mb-1.5">
                  <div className="inline-flex items-stretch gap-0 rounded-full bg-muted/40 backdrop-blur-sm px-1 py-0.5 shadow-sm">
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
                    <div className="w-px bg-border/50 my-1.5" />
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
                    <div className="w-px bg-border/50 my-1.5" />
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
                        <OpenTradeDuration openTime={trade.openTime} closeTime={trade.closeTime} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(userId || onUpdateTrade) && (
                <div className="mt-3 max-w-md">
                  <TradeScreenshot
                    tradeId={trade.id}
                    userId={userId}
                    compact
                    editable={!!onUpdateTrade}
                    onUpdate={
                      onUpdateTrade
                        ? (chartImage) => onUpdateTrade(trade.id, { chartImage })
                        : undefined
                    }
                  />
                </div>
              )}

              {trade.importedFromBroker && (trade.openPrice || trade.closePrice || trade.swap || trade.commission) && (
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {trade.openPrice != null && (
                    <span className="text-[11px] text-muted-foreground">
                      <span className="opacity-60">Open:</span>{" "}
                      <span className="font-mono font-medium text-foreground">{trade.openPrice.toFixed(trade.openPrice > 100 ? 2 : 5)}</span>
                    </span>
                  )}
                  {trade.closePrice != null && (
                    <span className="text-[11px] text-muted-foreground">
                      <span className="opacity-60">Close:</span>{" "}
                      <span className="font-mono font-medium text-foreground">{trade.closePrice.toFixed(trade.closePrice > 100 ? 2 : 5)}</span>
                    </span>
                  )}
                  {(trade.swap != null && trade.swap !== 0) && (
                    <span className="text-[11px] text-muted-foreground">
                      <span className="opacity-60">Swap:</span>{" "}
                      <span className={cn("font-mono font-medium", trade.swap < 0 ? "text-destructive" : "text-primary")}>
                        {trade.swap < 0 ? "" : "+"}{trade.swap.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {(trade.commission != null && trade.commission !== 0) && (
                    <span className="text-[11px] text-muted-foreground">
                      <span className="opacity-60">Commission:</span>{" "}
                      <span className={cn("font-mono font-medium", trade.commission < 0 ? "text-destructive" : "text-foreground")}>
                        {trade.commission.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const TradeTable = memo(function TradeTable({ trades, notebookEntries = [], checklists = [], userId, onEdit, onDelete, onSelectForNotebook, onUpdateTrade }: TradeTableProps) {
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [dayTrades, setDayTrades] = useState<Trade[] | null>(null);
  const [notesView, setNotesView] = useState<'list' | 'note'>('list');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
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
    const now = new Date();
    const visible = trades.filter((t) => {
      if (historySymbol !== "__all__" && t.pair !== historySymbol) return false;
      return tradeMatchesHistoryPeriod(t, historyPeriod, now);
    });
    return sortTradesNewestFirst(visible);
  }, [trades, historyPeriod, historySymbol]);

  const historyPnL = useMemo(() => sumPnL(filteredTrades), [filteredTrades]);

  const isFilterActive = historyPeriod !== "all" || historySymbol !== "__all__";
  const activePeriodLabel = PERIOD_OPTIONS.find(p => p.value === historyPeriod)?.label ?? "All";

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredTrades.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const trade = filteredTrades[index];
      return trade && expandedTradeId === trade.id ? 260 : 72;
    },
    overscan: 10,
    getItemKey: (index) => filteredTrades[index]?.id ?? index,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedTradeId, rowVirtualizer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpandedTradeId(null);
      }
    };

    if (expandedTradeId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedTradeId]);

  const handleViewNotes = (trade: Trade) => {
    setDayTrades(null);
    setSelectedTrade(trade);
    setNotesView('note');
    setNotesModalOpen(true);
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
            <p className="text-xs text-muted-foreground mt-1">Every trade is listed separately. Click a row for details.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end leading-tight pr-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total P&L</span>
              <span
                className={cn(
                  "text-sm font-bold font-mono tabular-nums",
                  historyPnL >= 0 ? "text-primary" : "text-destructive"
                )}
              >
                {formatPnL(historyPnL)}
              </span>
            </div>
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
                  <div className="px-4 py-3 border-b border-border/40 space-y-2.5">
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">Total P&L</span>
                      <span
                        className={cn(
                          "text-sm font-bold font-mono tabular-nums",
                          historyPnL >= 0 ? "text-primary" : "text-destructive"
                        )}
                      >
                        {formatPnL(historyPnL)}
                      </span>
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
          <div ref={scrollContainerRef} className="max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto custom-scrollbar">
            {trades.length === 0 || filteredTrades.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-20 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {trades.length === 0 ? "No trades yet." : "No trades match this filter."}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {trades.length === 0
                    ? 'Click "Add New Trade" to log your first trade.'
                    : "Try another symbol or time range."}
                </p>
              </motion.div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const trade = filteredTrades[virtualRow.index];
                  if (!trade) return null;
                  return (
                    <div
                      key={trade.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                    >
                      <TradeEntry
                        trade={trade}
                        checklists={checklists}
                        userId={userId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onViewNotes={handleViewNotes}
                        onUpdateTrade={onUpdateTrade}
                        index={virtualRow.index}
                        isExpanded={expandedTradeId === trade.id}
                        onToggle={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                      />
                    </div>
                  );
                })}
              </div>
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
                        {formatDateOrDash(dayTrades[0]?.date)} • {dayTrades.length} trades
                      </span>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                  {dayTrades.map((trade, i) => {
                    const pl = getTradeNetResult(trade);
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
                                {formatPnL(pl, { withSymbol: false })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {userId && (
                            <div className="w-14 hidden sm:block" onClick={(e) => e.stopPropagation()}>
                              <TradeScreenshot tradeId={trade.id} userId={userId} compact />
                            </div>
                          )}
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
                        </div>
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
                        {formatDateOrDash(selectedTrade.date)}
                      </span>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 mt-4 rounded-lg bg-muted/20 flex flex-col overflow-hidden">
                  {userId && (
                    <div className="px-5 pt-4 pb-2 border-b border-border/20 flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Trade Screenshot</p>
                      <TradeScreenshot
                        tradeId={selectedTrade.id}
                        userId={userId}
                        editable={!!onUpdateTrade}
                        onUpdate={
                          onUpdateTrade
                            ? (chartImage) => onUpdateTrade(selectedTrade.id, { chartImage })
                            : undefined
                        }
                      />
                    </div>
                  )}
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
});
