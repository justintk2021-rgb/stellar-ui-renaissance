import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WinRatioCard } from "./WinRatioCard";
import { RecentTrades } from "./RecentTrades";

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


function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger>
          <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{content}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
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
  const losingDays = Array.from(tradingDays.values()).filter((pnl) => pnl < 0).length;
  const totalDays = tradingDays.size;
  const dayWinRate = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;

  const winRate = trades.length > 0 ? (stats.wins / trades.length) * 100 : 0;
  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;
  
  // Profit Factor = Total Wins / Total Losses
  const profitFactor = stats.totalLossAmount > 0 ? stats.totalWinAmount / stats.totalLossAmount : stats.totalWinAmount > 0 ? Infinity : 0;


  return (
    <div className="space-y-4">
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Net P&L - Large Card */}
        <div className="glass rounded-xl p-5 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Total Net P&L</span>
            <InfoTooltip content="Total profit and loss across all trades" />
          </div>
          <div className="flex items-center gap-2">
            <AnimatedNumber 
              value={stats.net} 
              decimals={2} 
              prefix="$" 
              className={cn(
                "text-3xl font-bold font-mono",
                stats.net >= 0 ? "text-primary" : "text-destructive"
              )}
            />
            {stats.net >= 0 ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Trades in total: {trades.length}</p>
        </div>

        {/* Profit Factor */}
        <div className="glass rounded-xl p-5 border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Profit Factor</span>
            <InfoTooltip content="Ratio of gross profit to gross loss. Above 1.5 is considered good." />
          </div>
          {profitFactor === Infinity ? (
            <span className="text-3xl font-bold font-mono text-primary">∞</span>
          ) : (
            <AnimatedNumber 
              value={profitFactor} 
              decimals={2}
              className={cn(
                "text-3xl font-bold font-mono",
                profitFactor >= 1 ? "text-primary" : "text-destructive"
              )}
            />
          )}
        </div>

        {/* Average Winning Trade */}
        <div className="glass rounded-xl p-5 border-2 border-primary/50 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Average Winning Trade</span>
            <InfoTooltip content="Average profit per winning trade" />
          </div>
          <AnimatedNumber 
            value={avgWin} 
            decimals={2} 
            prefix="$" 
            className="text-3xl font-bold font-mono text-primary"
          />
        </div>

        {/* Average Losing Trade */}
        <div className="glass rounded-xl p-5 border-2 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Average Losing Trade</span>
            <InfoTooltip content="Average loss per losing trade" />
          </div>
          <AnimatedNumber 
            value={avgLoss} 
            decimals={2} 
            prefix="-$" 
            className="text-3xl font-bold font-mono text-destructive"
          />
        </div>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Win Ratio Card */}
        <div className="glass rounded-xl p-6 border border-border/40 flex flex-col min-h-[320px]">
          <WinRatioCard trades={trades} />
        </div>

        {/* Right Column - Recent Trades */}
        <RecentTrades trades={trades} />
      </div>
    </div>
  );
}
