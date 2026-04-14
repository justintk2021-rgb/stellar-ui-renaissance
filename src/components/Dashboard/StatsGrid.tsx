import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info, DollarSign, Percent, BarChart3, Scale, Activity } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WinRatioCard } from "./WinRatioCard";
import { RecentTrades } from "./RecentTrades";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

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

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
      delay: i * 0.08,
    },
  }),
  hover: {
    y: -4,
    scale: 1.02,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 20,
    },
  },
};

const iconVariants = {
  initial: { rotate: 0, scale: 1 },
  hover: { rotate: 10, scale: 1.15 },
};

// Removed animated glow variants to reduce visual interference

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

  const statCards = [
    {
      label: "Total Net P&L",
      value: stats.net,
      prefix: "$",
      decimals: 2,
      tooltip: "Total profit and loss across all trades",
      icon: DollarSign,
      isPositive: stats.net >= 0,
      showTrend: true,
      colorClass: stats.net >= 0 ? "text-primary" : "text-destructive",
      bgClass: stats.net >= 0 ? "bg-primary/10" : "bg-destructive/10",
      extra: `${trades.length} trades total`,
    },
    {
      label: "Profit Factor",
      value: profitFactor === Infinity ? 999 : profitFactor,
      prefix: "",
      decimals: 2,
      tooltip: "Ratio of gross profit to gross loss. Above 1.5 is considered good.",
      icon: Scale,
      isPositive: profitFactor >= 1,
      showTrend: false,
      displayInfinity: profitFactor === Infinity,
      colorClass: profitFactor >= 1 ? "text-primary" : "text-destructive",
      bgClass: profitFactor >= 1 ? "bg-primary/10" : "bg-destructive/10",
    },
    {
      label: "Avg Winning Trade",
      value: avgWin,
      prefix: "$",
      decimals: 2,
      tooltip: "Average profit per winning trade",
      icon: TrendingUp,
      isPositive: true,
      showTrend: false,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
      highlight: true,
      highlightColor: "primary",
    },
    {
      label: "Avg Losing Trade",
      value: avgLoss,
      prefix: "-$",
      decimals: 2,
      tooltip: "Average loss per losing trade",
      icon: TrendingDown,
      isPositive: false,
      showTrend: false,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
      highlight: true,
      highlightColor: "destructive",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            custom={index}
            className={cn(
              "relative rounded-2xl p-5 overflow-hidden bg-card/40 backdrop-blur-xl border shadow-xl",
              card.highlight 
                ? card.highlightColor === "primary"
                  ? "border-primary/40"
                  : "border-destructive/40"
                : "border-border/30"
            )}
          >
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <motion.div
                  variants={iconVariants}
                  initial="initial"
                  whileHover="hover"
                  className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bgClass)}
                >
                  <card.icon className={cn("w-4 h-4", card.colorClass)} />
                </motion.div>
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <InfoTooltip content={card.tooltip} />
              </div>
              
              <div className="flex items-center gap-2">
                {card.displayInfinity ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-3xl font-bold font-mono text-primary"
                  >
                    ∞
                  </motion.span>
                ) : (
                  <AnimatedNumber 
                    value={card.value} 
                    decimals={card.decimals} 
                    prefix={card.prefix} 
                    className={cn("text-3xl font-bold font-mono", card.colorClass)}
                  />
                )}
                {card.showTrend && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {card.isPositive ? (
                      <TrendingUp className="w-5 h-5 text-primary" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    )}
                  </motion.div>
                )}
              </div>
              
              {card.extra && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-muted-foreground mt-2"
                >
                  {card.extra}
                </motion.p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column - Win Ratio Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={4}
          className="rounded-2xl p-6 bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl flex flex-col min-h-[340px]"
        >
          <WinRatioCard trades={trades} />
        </motion.div>

        {/* Right Column - Recent Trades */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={5}
          className="lg:col-span-2"
        >
          <RecentTrades trades={trades} />
        </motion.div>
      </div>
    </div>
  );
}
