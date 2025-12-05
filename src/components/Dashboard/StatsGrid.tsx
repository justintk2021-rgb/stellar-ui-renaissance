import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Target, Percent } from "lucide-react";

interface StatsGridProps {
  trades: Trade[];
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

  const winRate = trades.length > 0 ? Math.round((stats.wins / trades.length) * 100) : 0;
  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;

  const statCards = [
    {
      label: 'Total Trades',
      value: trades.length.toString(),
      note: 'Number of trades logged',
      icon: BarChart3,
      gradient: 'stat-gradient',
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      note: `Wins: ${stats.wins} • Losses: ${stats.losses}`,
      icon: Target,
      gradient: winRate >= 50 ? 'stat-gradient' : 'stat-gradient-loss',
    },
    {
      label: 'Net P/L',
      value: stats.net.toFixed(2),
      note: 'Total P/L across all trades',
      icon: stats.net >= 0 ? TrendingUp : TrendingDown,
      gradient: stats.net >= 0 ? 'stat-gradient' : 'stat-gradient-loss',
      isProfit: stats.net >= 0,
    },
    {
      label: 'Avg Win',
      value: `$${avgWin.toFixed(2)}`,
      note: `From ${stats.wins} winning trades`,
      icon: TrendingUp,
      gradient: 'stat-gradient',
      isProfit: true,
    },
    {
      label: 'Avg Loss',
      value: `$${avgLoss.toFixed(2)}`,
      note: `From ${stats.losses} losing trades`,
      icon: TrendingDown,
      gradient: 'stat-gradient-loss',
      isProfit: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "glass rounded-xl p-4 hover-lift border border-border/40",
              stat.gradient
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </span>
              <Icon className={cn(
                "w-4 h-4",
                stat.isProfit !== undefined
                  ? stat.isProfit ? "text-primary" : "text-destructive"
                  : "text-muted-foreground"
              )} />
            </div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              stat.isProfit !== undefined
                ? stat.isProfit ? "text-primary" : "text-destructive"
                : "text-foreground"
            )}>
              {stat.value}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stat.note}</p>
          </div>
        );
      })}
    </div>
  );
}
