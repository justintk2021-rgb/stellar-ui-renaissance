import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Target, Percent, Calendar, Zap, Scale } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useEffect, useState } from "react";

interface StatsGridProps {
  trades: Trade[];
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

// Circular progress component with animation
function CircularProgress({ value, color, size = 40 }: { value: number; color: string; size?: number }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(animatedValue, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 transition-transform duration-300 group-hover:scale-110" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatedNumber value={animatedValue} decimals={0} suffix="%" className="text-[10px] font-bold" duration={1000} />
      </div>
    </div>
  );
}

export function StatsGrid({ trades }: StatsGridProps) {
  const stats = trades.reduce(
    (acc, trade) => {
      const pl = trade.result || 0;
      acc.net += pl;
      if (pl > 0) {
        acc.wins++;
        acc.totalWinAmount += pl;
      } else if (pl < 0) {
        acc.losses++;
        acc.totalLossAmount += Math.abs(pl);
      }
      return acc;
    },
    { wins: 0, losses: 0, net: 0, totalWinAmount: 0, totalLossAmount: 0 }
  );

  // Calculate day-based stats
  const tradingDays = new Map<string, number>();
  trades.forEach((trade) => {
    const date = trade.date;
    const current = tradingDays.get(date) || 0;
    tradingDays.set(date, current + (trade.result || 0));
  });

  const profitableDays = Array.from(tradingDays.values()).filter((pnl) => pnl > 0).length;
  const totalDays = tradingDays.size;
  const dayWinRate = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;

  const winRate = trades.length > 0 ? (stats.wins / trades.length) * 100 : 0;
  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;
  
  // Profit Factor = Total Wins / Total Losses
  const profitFactor = stats.totalLossAmount > 0 ? stats.totalWinAmount / stats.totalLossAmount : stats.totalWinAmount > 0 ? Infinity : 0;
  
  // Trade Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
  const lossRate = trades.length > 0 ? stats.losses / trades.length : 0;
  const tradeExpectancy = trades.length > 0 
    ? ((winRate / 100) * avgWin) - (lossRate * avgLoss)
    : 0;

  return (
    <div className="space-y-4">
      {/* Top Row - Key Metrics with Circular Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Net P/L */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40 stat-gradient">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              Net P/L <Percent className="w-3 h-3" />
            </span>
            {stats.net >= 0 ? (
              <TrendingUp className="w-4 h-4 text-primary" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
          </div>
          <AnimatedNumber 
            value={stats.net} 
            decimals={2} 
            prefix="$" 
            className={cn(
              "text-xl font-bold font-mono",
              stats.net >= 0 ? "text-primary" : "text-destructive"
            )}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Total across {trades.length} trades</p>
        </div>

        {/* Trade Win % with Circular */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Trade Win %</span>
          </div>
          <div className="flex items-center gap-3">
            <CircularProgress 
              value={winRate} 
              color={winRate >= 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} 
            />
            <div>
              <AnimatedNumber value={winRate} decimals={1} suffix="%" className="text-lg font-bold" />
              <p className="text-[10px] text-muted-foreground">{stats.wins}W / {stats.losses}L</p>
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Profit Factor</span>
            <Scale className="w-4 h-4 text-muted-foreground" />
          </div>
          {profitFactor === Infinity ? (
            <span className="text-xl font-bold font-mono text-primary">∞</span>
          ) : (
            <AnimatedNumber 
              value={profitFactor} 
              decimals={2}
              className={cn(
                "text-xl font-bold font-mono",
                profitFactor >= 1 ? "text-primary" : "text-destructive"
              )}
            />
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {profitFactor >= 1.5 ? "Excellent" : profitFactor >= 1 ? "Good" : "Needs work"}
          </p>
        </div>

        {/* Trade Expectancy */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Expectancy</span>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </div>
          <AnimatedNumber 
            value={tradeExpectancy} 
            decimals={2} 
            prefix="$"
            className={cn(
              "text-xl font-bold font-mono",
              tradeExpectancy >= 0 ? "text-primary" : "text-destructive"
            )}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Avg $ per trade</p>
        </div>

        {/* Day Win % with Circular */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Day Win %</span>
          </div>
          <div className="flex items-center gap-3">
            <CircularProgress 
              value={dayWinRate} 
              color={dayWinRate >= 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} 
            />
            <div>
              <AnimatedNumber value={dayWinRate} decimals={1} suffix="%" className="text-lg font-bold" />
              <p className="text-[10px] text-muted-foreground">{profitableDays}/{totalDays} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Averages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Trades */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Trades</span>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <AnimatedNumber value={trades.length} decimals={0} className="text-xl font-bold font-mono" />
          <p className="text-[10px] text-muted-foreground mt-1">Logged trades</p>
        </div>

        {/* Trading Days */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Trading Days</span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <AnimatedNumber value={totalDays} decimals={0} className="text-xl font-bold font-mono" />
          <p className="text-[10px] text-muted-foreground mt-1">{profitableDays} profitable</p>
        </div>

        {/* Avg Win */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40 stat-gradient">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Win</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <AnimatedNumber value={avgWin} decimals={2} prefix="$" className="text-xl font-bold font-mono text-primary" />
          <p className="text-[10px] text-muted-foreground mt-1">From {stats.wins} wins</p>
        </div>

        {/* Avg Loss */}
        <div className="glass rounded-xl p-4 hover-lift border border-border/40 stat-gradient-loss">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Loss</span>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <AnimatedNumber value={avgLoss} decimals={2} prefix="$" className="text-xl font-bold font-mono text-destructive" />
          <p className="text-[10px] text-muted-foreground mt-1">From {stats.losses} losses</p>
        </div>
      </div>
    </div>
  );
}
