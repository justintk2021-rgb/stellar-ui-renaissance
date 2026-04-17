import { Trade } from "@/types/trade";
import { useState, useEffect, useMemo } from "react";
import { Info, Settings, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval, subWeeks, subMonths, subYears } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WinRatioCardProps {
  trades: Trade[];
}

type TimePeriod = "all" | "year" | "month" | "week" | "day";

function AnimatedPercentage({ value }: { value: number }) {
  const { formattedValue } = useCountUp({
    end: value,
    duration: 1000,
    decimals: 0,
  });

  const colorClass = value < 50 ? "text-destructive" : "text-primary";

  return <span className={cn("text-4xl font-bold", colorClass)}>{formattedValue}%</span>;
}

export function WinRatioCard({ trades }: WinRatioCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("month");
  const [animatedValue, setAnimatedValue] = useState(0);

  const periods: TimePeriod[] = ["all", "year", "month", "week", "day"];

  const { currentStats, previousStats } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // For "all", we don't filter by date
    if (selectedPeriod === "all") {
      const calculateStats = (filteredTrades: Trade[]) => {
        const wins = filteredTrades.filter((t) => t.result > 0).length;
        const losses = filteredTrades.filter((t) => t.result < 0).length;
        const total = filteredTrades.length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        return { wins, losses, total, winRate };
      };
      return {
        currentStats: calculateStats(trades),
        previousStats: { wins: 0, losses: 0, total: 0, winRate: 0 },
      };
    }

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (selectedPeriod) {
      case "day":
        currentStart = today;
        currentEnd = today;
        previousStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        previousEnd = previousStart;
        break;
      case "week":
        currentStart = startOfWeek(now, { weekStartsOn: 1 });
        currentEnd = endOfWeek(now, { weekStartsOn: 1 });
        previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case "month":
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = endOfMonth(subMonths(now, 1));
        break;
      case "year":
        currentStart = startOfYear(now);
        currentEnd = endOfYear(now);
        previousStart = startOfYear(subYears(now, 1));
        previousEnd = endOfYear(subYears(now, 1));
        break;
    }

    const filterByPeriod = (start: Date, end: Date) => {
      return trades.filter((trade) => {
        const tradeDate = parseISO(trade.date);
        return isWithinInterval(tradeDate, { start, end });
      });
    };

    const currentTrades = filterByPeriod(currentStart, currentEnd);
    const previousTrades = filterByPeriod(previousStart, previousEnd);

    const calculateStats = (filteredTrades: Trade[]) => {
      const wins = filteredTrades.filter((t) => t.result > 0).length;
      const losses = filteredTrades.filter((t) => t.result < 0).length;
      const total = filteredTrades.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      return { wins, losses, total, winRate };
    };

    return {
      currentStats: calculateStats(currentTrades),
      previousStats: calculateStats(previousTrades),
    };
  }, [trades, selectedPeriod]);

  const winRateDiff = currentStats.winRate - previousStats.winRate;
  const isImproved = winRateDiff >= 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(currentStats.winRate);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStats.winRate]);

  // Circular progress values
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(animatedValue, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const periodLabels: Record<TimePeriod, string> = {
    all: "all time",
    year: "past year",
    month: "past month",
    week: "past week",
    day: "yesterday",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          Win Ratio
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </h3>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Win percentage based on trades</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center gap-8 mb-6 flex-1">
        {/* Circular Progress */}
        <motion.div 
          className="relative" 
          style={{ width: size, height: size }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" as const, stiffness: 200 }}
        >
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="hsl(var(--muted) / 0.3)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={animatedValue < 50 ? "hsl(var(--destructive))" : animatedValue > 75 ? "hsl(142 76% 46%)" : "hsl(var(--primary))"}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedPercentage value={animatedValue} />
            <span className="text-xs text-muted-foreground mt-1">win rate</span>
          </div>
          
        </motion.div>

        {/* Stats */}
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              Winning trades
            </p>
            <p className="text-2xl font-bold text-primary">{currentStats.wins}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-destructive" />
              Losing trades
            </p>
            <p className="text-2xl font-bold text-destructive">{currentStats.losses}</p>
          </motion.div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-muted/20 rounded-lg">
        {periods.map((period, index) => (
          <motion.button
            key={period}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            onClick={() => setSelectedPeriod(period)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 capitalize relative",
              selectedPeriod === period
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selectedPeriod === period && (
              <motion.div
                layoutId="activePeriod"
                className="absolute inset-0 bg-primary/10 rounded-md"
                transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{period}</span>
          </motion.button>
        ))}
      </div>

      {/* Comparison Text */}
      <AnimatePresence mode="wait">
        {previousStats.total > 0 && (
          <motion.p
            key="comparison"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-muted-foreground text-center"
          >
            Your win % is{" "}
            <span className={cn("font-semibold", isImproved ? "text-primary" : "text-destructive")}>
              {isImproved ? "higher" : "lower"} by {Math.abs(winRateDiff).toFixed(0)}%
            </span>{" "}
            compared to{" "}
            <span className="text-primary font-medium">{previousStats.wins}W</span>
            {" / "}
            <span className="text-destructive font-medium">{previousStats.losses}L</span>{" "}
            {periodLabels[selectedPeriod]}
          </motion.p>
        )}
        {previousStats.total === 0 && currentStats.total > 0 && (
          <motion.p
            key="no-comparison"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center"
          >
            No data from {periodLabels[selectedPeriod]} to compare
          </motion.p>
        )}
        {currentStats.total === 0 && (
          <motion.p
            key="no-trades"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center"
          >
            No trades in this period
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
