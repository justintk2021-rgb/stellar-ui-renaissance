import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { motion, AnimatePresence } from "@/lib/motion";
import { 
  ArrowLeft, Share2, TrendingUp, TrendingDown, Target, Award, 
  AlertCircle, DollarSign, BarChart3, Percent, Activity, Scale,
  ChevronRight, Info, Settings, ChevronLeft, Filter, Calendar, Search,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, 
  Quote, Lightbulb, BookOpen, Plus, Trash2, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SymbolMark } from "@/components/ui/AssetIcon";
import { useCountUp } from "@/hooks/useCountUp";
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, 
  Tooltip as RechartsTooltip, CartesianGrid 
} from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dedupeTradesForPnL, getTradeNetResult, journalTradeStats } from "@/lib/tradeFormat";
import { tradeRoiPercent } from "@/lib/tradePnl";
import {
  fetchActiveAccountIdSets,
  tradeBelongsToActiveAccount,
} from "@/lib/activeAccounts";
import { useSelectedAccountBalance } from "@/hooks/useSelectedAccountBalance";
import { PlaybookRulesEditor, type ChecklistMetrics as RulesEditorMetrics } from "./PlaybookRulesEditor";
import { PlaybookNotesGallery } from "./PlaybookNotesGallery";
import {
  PlaybookBacktesting,
  filterBacktestPlaybookTrades,
  filterLivePlaybookTrades,
} from "./PlaybookBacktesting";
import { PlaybookConfluenceScore, formatConfluenceChip } from "./PlaybookConfluenceScore";
import { PlaybookIdealSetupCard } from "./PlaybookIdealSetupCard";
import { PlaybookDeviationLog } from "./PlaybookDeviationLog";
import { PlaybookSessionMatrix } from "./PlaybookSessionMatrix";
import { type Checklist } from "@/hooks/useChecklists";
import { useTrades } from "@/hooks/useTrades";
import type { ChecklistItemState } from "@/types/trade";

interface Trade {
  id: string;
  date: string;
  pair: string;
  direction?: "Long" | "Short";
  result: number;
  checklist_id?: string;
  accountId?: string;
  brokerAccountId?: string;
  session?: string;
  swap?: number | null;
  commission?: number | null;
  importedFromBroker?: boolean | null;
  brokerPositionId?: string | null;
  lastBrokerSyncAt?: string | null;
  checklistState?: ChecklistItemState[];
  grade?: string | null;
  marketType?: string | null;
}

type ChecklistMetrics = RulesEditorMetrics;
type GradeFilter = "all" | "A+" | "A" | "B" | "C" | "ungraded";

interface PlaybookDetailViewProps {
  checklist: Checklist;
  metrics: ChecklistMetrics | undefined;
  trades: Trade[];
  unlinkedTrades?: Trade[];
  onBack: () => void;
  onUpdateNotes?: (notes: string) => void;
  onUpdateChecklist: (
    id: string,
    updates: Partial<Pick<Checklist, "name" | "items" | "notes" | "idealImage">>,
  ) => Promise<void> | void;
  onDeleteChecklist: (id: string) => Promise<void> | void;
  onTradesChanged?: () => void;
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

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type TabType = "overview" | "rules" | "executed" | "backtesting" | "notes";
type FilterType = "all" | "wins" | "losses";

const tabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "rules", label: "Playbook Rules" },
  { id: "executed", label: "Executed Trades" },
  { id: "backtesting", label: "Backtesting" },
  { id: "notes", label: "Notes" },
];

const TRADES_PER_PAGE = 10;
const AUTO_SAVE_DELAY = 1500; // Auto-save after 1.5s of inactivity

// Notes Tab Component with rich text editor and auto-save
function NotesTab({ 
  checklistId, 
  initialNotes,
  onSave 
}: { 
  checklistId: string; 
  initialNotes: string;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-save with debounce
  const saveNotes = useCallback(async (content: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ notes: content })
        .eq('id', checklistId);
      
      if (error) throw error;
      
      setLastSaved(new Date());
      onSave(content);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  }, [checklistId, onSave]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setNotes(content);
      
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveNotes(content);
      }, AUTO_SAVE_DELAY);
    }
  }, [saveNotes]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Format commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const noteTemplates = [
    {
      icon: Lightbulb,
      label: "Key Insight",
      template: "<h3>Key Insight</h3><p>What worked well in this strategy...</p>",
    },
    {
      icon: BookOpen,
      label: "Lesson Learned",
      template: "<h3>Lesson Learned</h3><p>What I learned from this playbook...</p>",
    },
    {
      icon: BarChart3,
      label: "Market Condition",
      template: "<h3>Market Condition</h3><p>This strategy works best when...</p>",
    },
    {
      icon: Target,
      label: "Rules Summary",
      template: "<h3>Rules Summary</h3><ul><li>Rule 1</li><li>Rule 2</li><li>Rule 3</li></ul>",
    },
  ];

  const isEmptyNotes = !notes.replace(/<[^>]*>/g, "").trim();

  const toolbarBtn =
    "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent";

  return (
    <motion.div
      key="notes"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex min-h-[min(70vh,36rem)] flex-col overflow-hidden rounded-xl border border-border/30 bg-[#0b1220] text-white shadow-card"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 pt-3 pb-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("bold")}>
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("italic")}>
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("underline")}>
                <Underline className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Underline</TooltipContent>
          </Tooltip>

          <div className="mx-1.5 h-4 w-px bg-white/10" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("justifyLeft")}>
                <AlignLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align left</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("justifyCenter")}>
                <AlignCenter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align center</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("justifyRight")}>
                <AlignRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align right</TooltipContent>
          </Tooltip>

          <div className="mx-1.5 h-4 w-px bg-white/10" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("insertUnorderedList")}>
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("insertOrderedList")}>
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolbarBtn} onClick={() => execCommand("formatBlock", "blockquote")}>
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quote</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto pr-1 text-[11px] text-white/40">
          {isSaving ? "Saving…" : lastSaved ? `Saved ${formatTime(lastSaved)}` : null}
        </div>
      </div>

      {/* Quick templates */}
      {isEmptyNotes ? (
        <div className="px-5 pb-3 pt-2">
          <p className="mb-2.5 text-xs text-white/45">Quick templates to get started:</p>
          <div className="flex flex-wrap gap-2">
            {noteTemplates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => {
                  if (!editorRef.current) return;
                  editorRef.current.innerHTML = template.template;
                  handleInput();
                  editorRef.current.focus();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-white/90 ring-1 ring-violet-400/20 transition-colors hover:bg-violet-500/25"
              >
                <template.icon className="h-3.5 w-3.5 text-violet-300" />
                {template.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: initialNotes }}
        className={cn(
          "min-h-0 flex-1 px-5 py-4 outline-none",
          "text-sm leading-relaxed text-white/90",
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white first:[&_h3]:mt-0",
          "[&_p]:mb-3 [&_p]:text-white/70",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_li]:mb-1 [&_li]:text-white/70",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/60",
          "empty:before:pointer-events-none empty:before:text-white/30 empty:before:content-[attr(data-placeholder)]",
        )}
        data-placeholder="Start documenting your strategy observations, lessons learned, and key insights..."
      />

      <div className="px-5 py-3">
        <p className="text-xs text-white/35">Your notes auto-save as you type</p>
      </div>
    </motion.div>
  );
}

// Executed Trades Tab Component with pagination and filtering
function ExecutedTradesTab({
  trades,
  checklist,
  unlinkedTrades,
  gradeFilter,
  onGradeFilterChange,
  onTradePatch,
}: {
  trades: Trade[];
  checklist: Checklist;
  unlinkedTrades: Trade[];
  gradeFilter: GradeFilter;
  onGradeFilterChange: (value: GradeFilter) => void;
  onTradePatch: (
    id: string,
    patch: { grade?: string | null; marketType?: string | null },
  ) => Promise<void>;
}) {
  const { balance, ready } = useSelectedAccountBalance();
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDebouncedValue(searchQuery, 160);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    if (gradeFilter === "ungraded") {
      result = result.filter((t) => !t.grade);
    } else if (gradeFilter !== "all") {
      result = result.filter((t) => t.grade === gradeFilter);
    }
    
    // Apply result filter
    if (filter === "wins") {
      result = result.filter(t => getTradeNetResult(t) > 0);
    } else if (filter === "losses") {
      result = result.filter(t => getTradeNetResult(t) < 0);
    }
    
    // Apply search (by date or symbol)
    if (deferredSearch) {
      const query = deferredSearch.toLowerCase();
      result = result.filter(t => 
        t.date.toLowerCase().includes(query) ||
        t.pair.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [trades, filter, deferredSearch, sortOrder, gradeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * TRADES_PER_PAGE;
    return filteredTrades.slice(start, start + TRADES_PER_PAGE);
  }, [filteredTrades, currentPage]);

  // Reset page when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [filter, deferredSearch, gradeFilter]);

  const winCount = trades.filter(t => getTradeNetResult(t) > 0).length;
  const lossCount = trades.filter(t => getTradeNetResult(t) < 0).length;
  const gradeChips: GradeFilter[] = ["all", "A+", "A", "B", "C", "ungraded"];

  return (
    <div>
    <motion.div
      key="executed"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-xl p-6 border border-border/30"
    >
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold">Executed Trades</h3>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[140px] h-9 bg-muted/30 border-border/30"
            />
          </div>
          
          {/* Filter by result */}
          <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
            <SelectTrigger className="w-[120px] h-9 bg-muted/30 border-border/30">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({trades.length})</SelectItem>
              <SelectItem value="wins">Wins ({winCount})</SelectItem>
              <SelectItem value="losses">Losses ({lossCount})</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Sort order */}
          <Select value={sortOrder} onValueChange={(v: "newest" | "oldest") => setSortOrder(v)}>
            <SelectTrigger className="w-[110px] h-9 bg-muted/30 border-border/30">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        {gradeChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onGradeFilterChange(chip)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              gradeFilter === chip
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {chip === "all" ? "All" : chip === "ungraded" ? "Ungraded" : chip}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-7 gap-3 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
        <div>Open Date</div>
        <div>Symbol</div>
        <div className="text-right">Net P&L</div>
        <div className="text-right">Net ROI</div>
        <div className="text-center">Score</div>
        <div className="text-center">Grade</div>
        <div className="text-center">Market</div>
      </div>

      {/* Trades Table */}
      {paginatedTrades.length > 0 ? (
        <div className="divide-y divide-border/20">
          <AnimatePresence mode="popLayout">
            {paginatedTrades.map((trade, index) => {
              const net = getTradeNetResult(trade);
              const roi = tradeRoiPercent(net, balance);
              const scoreChip = formatConfluenceChip(checklist, trade.checklistState);
              
              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: index * 0.02 }}
                  className="grid grid-cols-7 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
                >
                  <div className="text-sm text-muted-foreground">{trade.date}</div>
                  <div className="text-sm font-medium"><SymbolMark symbol={trade.pair} size="sm" /></div>
                  <div className={cn(
                    "text-sm font-mono font-semibold text-right",
                    net >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    ${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={cn(
                    "text-sm font-mono text-right",
                    roi >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    {ready ? `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%` : "—"}
                  </div>
                  <div className="text-center">
                    <span className="inline-flex rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-mono">
                      {scoreChip}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <Select
                      value={trade.grade || "none"}
                      onValueChange={(value) => {
                        void onTradePatch(trade.id, { grade: value === "none" ? null : value });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[72px] text-xs bg-muted/30 border-border/30">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-center">
                    <Select
                      value={trade.marketType || "none"}
                      onValueChange={(value) => {
                        void onTradePatch(trade.id, {
                          marketType: value === "none" ? null : value,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[96px] text-xs bg-muted/30 border-border/30">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="trending">Trending</SelectItem>
                        <SelectItem value="ranging">Ranging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {trades.length === 0 
              ? "No trades executed with this playbook yet"
              : "No trades match your filters"
            }
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between px-4 py-3 border-t border-border/30"
        >
          <span className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1}-{Math.min(currentPage * TRADES_PER_PAGE, filteredTrades.length)} of {filteredTrades.length}
          </span>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 bg-muted/30 border-border/30 hover:bg-muted/50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "h-8 w-8 p-0",
                      currentPage !== pageNum && "bg-muted/30 border-border/30 hover:bg-muted/50"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 bg-muted/30 border-border/30 hover:bg-muted/50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
    <PlaybookDeviationLog
      checklist={checklist}
      linkedTrades={trades}
      unlinkedTrades={unlinkedTrades}
    />
    </div>
  );
}


export function PlaybookDetailView({ 
  checklist, 
  metrics, 
  trades,
  unlinkedTrades = [],
  onBack,
  onUpdateNotes,
  onUpdateChecklist,
  onDeleteChecklist,
  onTradesChanged,
}: PlaybookDetailViewProps) {
  const [authUserId, setAuthUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setAuthUserId(data.user?.id);
    });
  }, []);
  const { updateTrade } = useTrades(authUserId);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [currentNotes, setCurrentNotes] = useState(checklist.notes || '');
  const [activeManualIds, setActiveManualIds] = useState<Set<string>>(new Set());
  const [activeBrokerIds, setActiveBrokerIds] = useState<Set<string>>(new Set());
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // Keep playbook stats in sync with accounts that still exist on the site.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setAccountsLoaded(true);
        return;
      }

      const { manualIds, brokerExternalIds } = await fetchActiveAccountIdSets(user.id);

      if (!cancelled) {
        setActiveManualIds(manualIds);
        setActiveBrokerIds(brokerExternalIds);
        setAccountsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter trades for this checklist — only from accounts that still exist.
  const checklistTrades = useMemo(() => {
    if (!accountsLoaded) return [];
    return dedupeTradesForPnL(
      trades.filter((t) => {
        if (t.checklist_id !== checklist.id) return false;
        return tradeBelongsToActiveAccount(t, activeManualIds, activeBrokerIds);
      }),
    );
  }, [trades, checklist.id, accountsLoaded, activeManualIds, activeBrokerIds]);

  // Live overview / executed exclude backtests; backtesting tab uses only those.
  const liveTrades = useMemo(() => filterLivePlaybookTrades(checklistTrades), [checklistTrades]);
  const backtestTrades = useMemo(
    () => filterBacktestPlaybookTrades(checklistTrades),
    [checklistTrades],
  );

  const gradeFilteredLiveTrades = useMemo(() => {
    if (gradeFilter === "all") return liveTrades;
    if (gradeFilter === "ungraded") return liveTrades.filter((t) => !t.grade);
    return liveTrades.filter((t) => t.grade === gradeFilter);
  }, [liveTrades, gradeFilter]);

  const activeUnlinkedTrades = useMemo(() => {
    if (!accountsLoaded) return [];
    return dedupeTradesForPnL(
      unlinkedTrades.filter((t) =>
        tradeBelongsToActiveAccount(t, activeManualIds, activeBrokerIds),
      ),
    );
  }, [unlinkedTrades, accountsLoaded, activeManualIds, activeBrokerIds]);

  // Calculate extended metrics
  const extendedMetrics = useMemo(() => {
    if (!metrics || gradeFilteredLiveTrades.length === 0) return null;

    const stats = journalTradeStats(gradeFilteredLiveTrades);
    const nets = gradeFilteredLiveTrades.map((t) => getTradeNetResult(t));
    const winningNets = nets.filter((n) => n > 0);
    const losingNets = nets.filter((n) => n < 0);
    const largestProfit = winningNets.length > 0 ? Math.max(...winningNets) : 0;
    const largestLoss = losingNets.length > 0 ? Math.min(...losingNets) : 0;
    const rMultiple = stats.avgLoss > 0 ? stats.netPnL / stats.avgLoss : 0;

    return {
      ...metrics,
      totalTrades: stats.total,
      winningTrades: stats.wins,
      losingTrades: stats.losses,
      totalPnL: stats.netPnL,
      winRate: stats.winRate,
      avgWinner: stats.avgWin,
      avgLoser: stats.avgLoss,
      largestProfit,
      largestLoss,
      profitFactor: stats.profitFactor,
      expectancy: stats.expectancy,
      rMultiple,
      rulesFollowed: 100, // Placeholder - could be calculated from checklist completion
      missedTrades: 0, // Placeholder
    };
  }, [metrics, gradeFilteredLiveTrades]);

  // Generate cumulative P&L data for chart
  const cumulativePnLData = useMemo(() => {
    if (gradeFilteredLiveTrades.length === 0) return [];
    
    const sortedTrades = [...gradeFilteredLiveTrades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    let cumulative = 0;
    return sortedTrades.map((trade, index) => {
      cumulative += getTradeNetResult(trade);
      return {
        date: trade.date,
        value: cumulative,
        trade: index + 1,
      };
      });
  }, [gradeFilteredLiveTrades]);

  const handleTradePatch = useCallback(async (
    id: string,
    patch: { grade?: string | null; marketType?: string | null },
  ) => {
    await updateTrade(id, patch);
    onTradesChanged?.();
  }, [onTradesChanged, updateTrade]);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleBack = () => {
    if (activeTab === "overview") {
      onBack();
    } else {
      setActiveTab("overview");
    }
  };

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || "Overview";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Breadcrumb */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2 text-sm">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack} 
            className="hover:bg-muted/50 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {activeTab === "overview" ? "Playbook" : "Overview"}
          </Button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium truncate max-w-[200px]">{checklist.name}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-primary font-semibold">{currentTabLabel}</span>
        </div>

        <Button variant="outline" size="sm" className="gap-2 hover:bg-muted/50">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div 
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-1 border-b border-border/30 pb-1"
      >
        {tabs.map((tab, index) => (
          <motion.button
            key={tab.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + index * 0.03 }}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 relative",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}

        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Stats Grid - Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Net P&L */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Net P&L</span>
                  <InfoTooltip content="Total profit and loss from trades using this playbook" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.totalPnL ?? 0}
                  decimals={2}
                  prefix="$"
                  className={cn(
                    "text-2xl font-bold font-mono block",
                    (extendedMetrics?.totalPnL ?? 0) >= 0 ? "text-primary" : "text-destructive"
                  )}
                />
              </motion.div>

              {/* Trades */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Trades</span>
                  <InfoTooltip content="Total number of trades executed with this playbook" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.totalTrades ?? 0}
                  decimals={0}
                  className="text-2xl font-bold font-mono block"
                />
              </motion.div>

              {/* Win Rate */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Win Rate %</span>
                  <InfoTooltip content="Percentage of winning trades" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.winRate ?? 0}
                  decimals={0}
                  suffix="%"
                  className={cn(
                    "text-2xl font-bold font-mono block",
                    (extendedMetrics?.winRate ?? 0) >= 50 ? "text-primary" : "text-destructive"
                  )}
                />
              </motion.div>

              {/* Profit Factor */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Profit Factor</span>
                  <InfoTooltip content="Ratio of gross profit to gross loss. Above 1.5 is considered good." />
                </div>
                {extendedMetrics?.profitFactor === Infinity ? (
                  <span className="text-2xl font-bold font-mono text-primary">∞</span>
                ) : (
                  <AnimatedNumber
                    value={extendedMetrics?.profitFactor ?? 0}
                    decimals={2}
                    className={cn(
                      "text-2xl font-bold font-mono block",
                      (extendedMetrics?.profitFactor ?? 0) >= 1 ? "text-primary" : "text-destructive"
                    )}
                  />
                )}
              </motion.div>

              {/* Missed Trades */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Missed Trades</span>
                  <InfoTooltip content="Trades that met criteria but weren't taken" />
                </div>
                <span className="text-2xl font-bold font-mono block text-muted-foreground">
                  {extendedMetrics?.missedTrades ?? 0}
                </span>
              </motion.div>

              {/* Expectancy */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Expectancy</span>
                  <InfoTooltip content="Average amount you can expect to win/lose per trade" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.expectancy ?? 0}
                  decimals={2}
                  prefix="$"
                  className={cn(
                    "text-2xl font-bold font-mono block",
                    (extendedMetrics?.expectancy ?? 0) >= 0 ? "text-primary" : "text-destructive"
                  )}
                />
              </motion.div>
            </div>

            {/* Stats Grid - Row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Rules Followed */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Rules Followed</span>
                  <InfoTooltip content="Percentage of checklist items completed on average" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.rulesFollowed ?? 0}
                  decimals={0}
                  suffix="%"
                  className="text-2xl font-bold font-mono block text-primary"
                />
              </motion.div>

              {/* Average Winner */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Average Winner</span>
                  <InfoTooltip content="Average profit per winning trade" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.avgWinner ?? 0}
                  decimals={2}
                  prefix="$"
                  className="text-2xl font-bold font-mono block text-primary"
                />
              </motion.div>

              {/* Average Loser */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Average Loser</span>
                  <InfoTooltip content="Average loss per losing trade" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.avgLoser ?? 0}
                  decimals={2}
                  prefix="$"
                  className="text-2xl font-bold font-mono block text-destructive"
                />
              </motion.div>

              {/* Largest Profit */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Largest Profit</span>
                  <InfoTooltip content="Biggest winning trade" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.largestProfit ?? 0}
                  decimals={2}
                  prefix="$"
                  className="text-2xl font-bold font-mono block text-primary"
                />
              </motion.div>

              {/* Largest Loss */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Largest Loss</span>
                  <InfoTooltip content="Biggest losing trade" />
                </div>
                <AnimatedNumber
                  value={Math.abs(extendedMetrics?.largestLoss ?? 0)}
                  decimals={2}
                  prefix="$"
                  className="text-2xl font-bold font-mono block text-destructive"
                />
              </motion.div>

              {/* Total R Multiple */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="glass rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Total R Multiple</span>
                  <InfoTooltip content="Total P&L expressed in risk units" />
                </div>
                <AnimatedNumber
                  value={extendedMetrics?.rMultiple ?? 0}
                  decimals={2}
                  className={cn(
                    "text-2xl font-bold font-mono block",
                    (extendedMetrics?.rMultiple ?? 0) >= 0 ? "text-primary" : "text-destructive"
                  )}
                />
              </motion.div>
            </div>

            {/* Cumulative P&L Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-xl p-6 border border-border/30"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Daily Net Cumulative P&L</h3>
                  <InfoTooltip content="Running total of profits and losses over time" />
                </div>
              </div>

              {cumulativePnLData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativePnLData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        vertical={false}
                        stroke="hsl(var(--border))"
                        opacity={0.3}
                      />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
                        }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        width={80}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P&L']}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#colorPnL)"
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No trade data yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Execute trades using this playbook to see analytics
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            <PlaybookConfluenceScore checklist={checklist} trades={gradeFilteredLiveTrades} />
            <PlaybookIdealSetupCard
              checklist={checklist}
              onSaveIdealImage={(idealImage) => onUpdateChecklist(checklist.id, { idealImage })}
            />
            <PlaybookSessionMatrix trades={gradeFilteredLiveTrades} />
          </motion.div>
        )}

        {activeTab === "rules" && (
          <motion.div
            key="rules"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PlaybookRulesEditor
              checklist={checklist}
              metrics={metrics}
              onUpdateChecklist={onUpdateChecklist}
              onDeleteChecklist={async (id) => {
                await onDeleteChecklist(id);
                onBack();
              }}
            />
          </motion.div>
        )}

        {activeTab === "executed" && (
          <ExecutedTradesTab
            trades={liveTrades}
            checklist={checklist}
            unlinkedTrades={activeUnlinkedTrades}
            gradeFilter={gradeFilter}
            onGradeFilterChange={setGradeFilter}
            onTradePatch={handleTradePatch}
          />
        )}

        {activeTab === "backtesting" && (
          <PlaybookBacktesting
            checklist={checklist}
            trades={backtestTrades}
            onTradeLogged={onTradesChanged}
          />
        )}

        {activeTab === "notes" && (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PlaybookNotesGallery
              checklistId={checklist.id}
              checklistName={checklist.name}
              trades={liveTrades as import("@/types/trade").Trade[]}
              onNewNote={() => {
                /* focus stays on live notes editor */
              }}
              liveContent={
                <NotesTab
                  checklistId={checklist.id}
                  initialNotes={currentNotes}
                  onSave={(notes) => {
                    setCurrentNotes(notes);
                    onUpdateNotes?.(notes);
                  }}
                />
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
