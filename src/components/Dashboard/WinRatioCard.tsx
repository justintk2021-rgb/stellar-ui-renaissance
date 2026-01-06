import { Trade } from "@/types/trade";
import { useState, useEffect, useMemo } from "react";
import { Info, Settings, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
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

  return (
    <span className="text-3xl font-bold text-primary">
      {formattedValue}%
    </span>
  );
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
  const size = 140;
  const strokeWidth = 12;
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
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Win ratio</h3>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Win percentage based on trades</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center gap-6 mb-4">
        {/* Circular Progress */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="hsl(var(--muted) / 0.5)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={animatedValue > 75 ? "hsl(142 76% 46%)" : "hsl(var(--primary))"}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatedPercentage value={animatedValue} />
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Winning trades</p>
            <p className="text-2xl font-bold text-primary">{currentStats.wins}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Losing trades</p>
            <p className="text-2xl font-bold text-destructive">{currentStats.losses}</p>
          </div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize",
              selectedPeriod === period
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Comparison Text */}
      {previousStats.total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Your win % is{" "}
          <span className={isImproved ? "text-primary" : "text-destructive"}>
            {isImproved ? "higher" : "lower"} on {Math.abs(winRateDiff).toFixed(0)}%
          </span>{" "}
          compared to{" "}
          <span className="text-primary">{previousStats.wins} winning</span>
          {" / "}
          <span className="text-destructive">{previousStats.losses} losing</span>{" "}
          {periodLabels[selectedPeriod]}
        </p>
      )}
      {previousStats.total === 0 && currentStats.total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          No data from {periodLabels[selectedPeriod]} to compare
        </p>
      )}
      {currentStats.total === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          No trades in this period
        </p>
      )}
    </motion.div>
  );
}
