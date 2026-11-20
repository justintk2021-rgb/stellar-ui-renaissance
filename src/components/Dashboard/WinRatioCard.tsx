import { Trade } from "@/types/trade";
import { useState, useEffect, useMemo } from "react";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "@/lib/motion";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  computeDayWinLossStats,
  computeWinLossStats,
  filterTradesByCloseDateRange,
} from "@/lib/tradeFormat";

interface WinRatioCardProps {
  trades: Trade[];
  compact?: boolean;
}

type TimePeriod = "all" | "year" | "month" | "week" | "day";
type RatioMode = "trades" | "days";

function AnimatedPercentage({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const { formattedValue } = useCountUp({
    end: value,
    duration: 1000,
    decimals: 0,
  });

  const colorClass = value < 50 ? "text-destructive" : "text-primary";

  return (
    <span className={cn("font-bold", compact ? "text-2xl" : "text-4xl", colorClass)}>
      {formattedValue}%
    </span>
  );
}

export function WinRatioCard({ trades, compact = false }: WinRatioCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("month");
  const [ratioMode, setRatioMode] = useState<RatioMode>("trades");
  const [animatedValue, setAnimatedValue] = useState(0);

  const periods: TimePeriod[] = ["all", "year", "month", "week", "day"];

  const { currentTradeStats, previousTradeStats, currentDayStats, previousDayStats } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedPeriod === "all") {
      return {
        currentTradeStats: computeWinLossStats(trades),
        previousTradeStats: { wins: 0, losses: 0, breakeven: 0, total: 0, winRate: 0 },
        currentDayStats: computeDayWinLossStats(trades),
        previousDayStats: {
          winningDays: 0,
          losingDays: 0,
          breakevenDays: 0,
          tradingDays: 0,
          dayWinRate: 0,
        },
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

    const currentTrades = filterTradesByCloseDateRange(trades, currentStart, currentEnd);
    const previousTrades = filterTradesByCloseDateRange(trades, previousStart, previousEnd);

    return {
      currentTradeStats: computeWinLossStats(currentTrades),
      previousTradeStats: computeWinLossStats(previousTrades),
      currentDayStats: computeDayWinLossStats(currentTrades),
      previousDayStats: computeDayWinLossStats(previousTrades),
    };
  }, [trades, selectedPeriod]);

  const byDays = ratioMode === "days";
  const displayRate = byDays ? currentDayStats.dayWinRate : currentTradeStats.winRate;
  const previousRate = byDays ? previousDayStats.dayWinRate : previousTradeStats.winRate;
  const hasPrevious = byDays ? previousDayStats.tradingDays > 0 : previousTradeStats.total > 0;
  const hasCurrent = byDays ? currentDayStats.tradingDays > 0 : currentTradeStats.total > 0;
  const winCount = byDays ? currentDayStats.winningDays : currentTradeStats.wins;
  const lossCount = byDays ? currentDayStats.losingDays : currentTradeStats.losses;
  const winRateDiff = displayRate - previousRate;
  const isImproved = winRateDiff >= 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(displayRate);
    }, 100);
    return () => clearTimeout(timer);
  }, [displayRate]);

  // Circular progress values
  const size = compact ? 108 : 180;
  const strokeWidth = compact ? 9 : 14;
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
      <div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-4")}>
        <h3 className={cn("font-semibold flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
          Win Ratio
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/30 rounded-md">
            {(["trades", "days"] as RatioMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRatioMode(mode)}
                className={cn(
                  "rounded px-1.5 py-0.5 capitalize transition-colors",
                  compact ? "text-[9px]" : "text-[10px]",
                  ratioMode === mode
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
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
              <TooltipContent className="max-w-[16rem]">
                <p className="text-xs">
                  {byDays
                    ? "Day win %: winning days ÷ trading days (net P&L per close date)."
                    : "Trade win %: winning trades ÷ all trades."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex items-center justify-center flex-1",
          compact ? "flex-col gap-3 mb-3" : "gap-8 mb-6",
        )}
      >
        {/* Circular Progress */}
        <motion.div
          className="relative shrink-0"
          style={{ width: size, height: size }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" as const, stiffness: 200 }}
        >
          <svg className="transform -rotate-90" width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="hsl(var(--muted) / 0.3)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={animatedValue < 50 ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedPercentage value={animatedValue} compact={compact} />
            <span className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-xs")}>
              {byDays ? "day win rate" : "trade win rate"}
            </span>
          </div>
        </motion.div>

        {/* Stats */}
        <div className={cn(compact ? "flex w-full justify-center gap-5" : "flex flex-col gap-4")}>
          <motion.div
            key={`wins-${ratioMode}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className={compact ? "text-center" : undefined}
          >
            <p className={cn("text-muted-foreground mb-0.5 flex items-center gap-1.5", compact ? "text-[10px] justify-center" : "text-xs")}>
              <TrendingUp className="w-3 h-3 text-primary" />
              {compact
                ? byDays ? "Win days" : "Wins"
                : byDays ? "Winning days" : "Winning trades"}
            </p>
            <p className={cn("font-bold text-primary", compact ? "text-lg" : "text-2xl")}>{winCount}</p>
          </motion.div>
          <motion.div
            key={`losses-${ratioMode}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className={compact ? "text-center" : undefined}
          >
            <p className={cn("text-muted-foreground mb-0.5 flex items-center gap-1.5", compact ? "text-[10px] justify-center" : "text-xs")}>
              <TrendingDown className="w-3 h-3 text-destructive" />
              {compact
                ? byDays ? "Loss days" : "Losses"
                : byDays ? "Losing days" : "Losing trades"}
            </p>
            <p className={cn("font-bold text-destructive", compact ? "text-lg" : "text-2xl")}>{lossCount}</p>
          </motion.div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className={cn("flex items-center gap-1 p-1 bg-muted/20 rounded-lg", compact ? "mb-2" : "mb-4")}>
        {periods.map((period, index) => (
          <motion.button
            key={period}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            onClick={() => setSelectedPeriod(period)}
            className={cn(
              "flex-1 font-medium rounded-md transition-all duration-200 capitalize relative",
              compact ? "px-1 py-1.5 text-[10px]" : "px-3 py-2 text-xs",
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
        {hasPrevious && (
          <motion.p
            key={`comparison-${ratioMode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn("text-muted-foreground text-center", compact ? "text-[10px] leading-snug" : "text-xs")}
          >
            Your {byDays ? "day" : "trade"} win % is{" "}
            <span className={cn("font-semibold", isImproved ? "text-primary" : "text-destructive")}>
              {isImproved ? "higher" : "lower"} by {Math.abs(winRateDiff).toFixed(0)}%
            </span>{" "}
            compared to{" "}
            <span className="text-primary font-medium">
              {byDays ? previousDayStats.winningDays : previousTradeStats.wins}W
            </span>
            {" / "}
            <span className="text-destructive font-medium">
              {byDays ? previousDayStats.losingDays : previousTradeStats.losses}L
            </span>{" "}
            {periodLabels[selectedPeriod]}
          </motion.p>
        )}
        {!hasPrevious && hasCurrent && (
          <motion.p
            key={`no-comparison-${ratioMode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center"
          >
            No data from {periodLabels[selectedPeriod]} to compare
          </motion.p>
        )}
        {!hasCurrent && (
          <motion.p
            key={`no-trades-${ratioMode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center"
          >
            {byDays ? "No trading days in this period" : "No trades in this period"}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
