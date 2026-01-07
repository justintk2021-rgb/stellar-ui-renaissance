import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Share2, TrendingUp, TrendingDown, Target, Award, 
  AlertCircle, DollarSign, BarChart3, Percent, Activity, Scale,
  ChevronRight, Info, Settings, ChevronLeft, Filter, Calendar, Search
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
import { useCountUp } from "@/hooks/useCountUp";
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, 
  Tooltip as RechartsTooltip, CartesianGrid 
} from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Trade {
  id: string;
  date: string;
  result: number;
  checklist_id?: string;
}

interface ChecklistMetrics {
  checklistId: string;
  checklistName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
}

interface PlaybookDetailViewProps {
  checklist: {
    id: string;
    name: string;
    type: string;
    items: any[];
  };
  metrics: ChecklistMetrics | undefined;
  trades: Trade[];
  onBack: () => void;
  onOpenRules: () => void;
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

type TabType = "overview" | "rules" | "executed" | "notes";
type FilterType = "all" | "wins" | "losses";

const tabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "rules", label: "Playbook Rules" },
  { id: "executed", label: "Executed Trades" },
  { id: "notes", label: "Notes" },
];

const TRADES_PER_PAGE = 10;

// Executed Trades Tab Component with pagination and filtering
function ExecutedTradesTab({ trades }: { trades: Trade[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // Apply result filter
    if (filter === "wins") {
      result = result.filter(t => t.result > 0);
    } else if (filter === "losses") {
      result = result.filter(t => t.result < 0);
    }
    
    // Apply search (by date)
    if (searchQuery) {
      result = result.filter(t => 
        t.date.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [trades, filter, searchQuery, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * TRADES_PER_PAGE;
    return filteredTrades.slice(start, start + TRADES_PER_PAGE);
  }, [filteredTrades, currentPage]);

  // Reset page when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const winCount = trades.filter(t => t.result > 0).length;
  const lossCount = trades.filter(t => t.result < 0).length;

  return (
    <motion.div
      key="executed"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-xl p-6 border border-border/30"
    >
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold">Executed Trades</h3>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[160px] h-9 bg-muted/30 border-border/30"
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

      {/* Trades List */}
      {paginatedTrades.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {paginatedTrades.map((trade, index) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    trade.result >= 0 ? "bg-primary" : "bg-destructive"
                  )} />
                  <span className="text-sm text-muted-foreground">{trade.date}</span>
                </div>
                <span className={cn(
                  "font-mono font-semibold",
                  trade.result >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {trade.result >= 0 ? '+' : ''}${trade.result.toFixed(2)}
                </span>
              </motion.div>
            ))}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mt-6 pt-4 border-t border-border/30"
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
  );
}

export function PlaybookDetailView({ 
  checklist, 
  metrics, 
  trades,
  onBack,
  onOpenRules
}: PlaybookDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Filter trades for this checklist
  const checklistTrades = useMemo(() => 
    trades.filter(t => t.checklist_id === checklist.id),
    [trades, checklist.id]
  );

  // Calculate extended metrics
  const extendedMetrics = useMemo(() => {
    if (!metrics || checklistTrades.length === 0) return null;

    const winningTrades = checklistTrades.filter(t => t.result > 0);
    const losingTrades = checklistTrades.filter(t => t.result < 0);
    
    const totalWinAmount = winningTrades.reduce((sum, t) => sum + t.result, 0);
    const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + t.result, 0));
    
    const avgWinner = winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0;
    const avgLoser = losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0;
    const largestProfit = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.result)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.result)) : 0;
    
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 
                         totalWinAmount > 0 ? Infinity : 0;
    
    // Expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
    const winRate = metrics.winRate / 100;
    const lossRate = 1 - winRate;
    const expectancy = (winRate * avgWinner) - (lossRate * avgLoser);
    
    // R-Multiple (simplified: total PnL / avg loss as risk unit)
    const rMultiple = avgLoser > 0 ? metrics.totalPnL / avgLoser : 0;

    return {
      ...metrics,
      avgWinner,
      avgLoser,
      largestProfit,
      largestLoss,
      profitFactor,
      expectancy,
      rMultiple,
      rulesFollowed: 100, // Placeholder - could be calculated from checklist completion
      missedTrades: 0, // Placeholder
    };
  }, [metrics, checklistTrades]);

  // Generate cumulative P&L data for chart
  const cumulativePnLData = useMemo(() => {
    if (checklistTrades.length === 0) return [];
    
    const sortedTrades = [...checklistTrades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    let cumulative = 0;
    return sortedTrades.map((trade, index) => {
      cumulative += trade.result;
      return {
        date: trade.date,
        value: cumulative,
        trade: index + 1,
      };
    });
  }, [checklistTrades]);

  const handleTabClick = (tab: TabType) => {
    if (tab === "rules") {
      onOpenRules();
    } else {
      setActiveTab(tab);
    }
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
          </motion.div>
        )}

        {activeTab === "executed" && (
          <ExecutedTradesTab trades={checklistTrades} />
        )}

        {activeTab === "notes" && (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-6 border border-border/30"
          >
            <h3 className="text-lg font-semibold mb-4">Notes</h3>
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No notes yet. Coming soon!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
