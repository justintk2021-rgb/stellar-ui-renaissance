import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, TrendingUp, Target, CheckCircle2, 
  Flame, Star, Crown, Shield, Zap, Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Trade {
  id: string;
  date: string;
  result: number;
  checklist_id?: string | null;
  checklist_state?: any;
}

interface RankBadgeProps {
  trades: Trade[];
}

// Rank tiers from lowest to highest
const RANKS = [
  { name: "Novice", icon: Shield, color: "from-slate-400 to-slate-500", minPoints: 0, textColor: "text-slate-400", bgColor: "bg-slate-500/20" },
  { name: "Apprentice", icon: Zap, color: "from-amber-600 to-amber-700", minPoints: 100, textColor: "text-amber-500", bgColor: "bg-amber-500/20" },
  { name: "Trader", icon: Target, color: "from-emerald-500 to-emerald-600", minPoints: 300, textColor: "text-emerald-500", bgColor: "bg-emerald-500/20" },
  { name: "Skilled", icon: Star, color: "from-blue-500 to-blue-600", minPoints: 600, textColor: "text-blue-500", bgColor: "bg-blue-500/20" },
  { name: "Expert", icon: Award, color: "from-purple-500 to-purple-600", minPoints: 1000, textColor: "text-purple-500", bgColor: "bg-purple-500/20" },
  { name: "Master", icon: Crown, color: "from-amber-400 to-yellow-500", minPoints: 1500, textColor: "text-amber-400", bgColor: "bg-amber-400/20" },
  { name: "Legend", icon: Trophy, color: "from-rose-500 to-pink-500", minPoints: 2500, textColor: "text-rose-500", bgColor: "bg-rose-500/20" },
];

function calculateConsistencyScore(trades: Trade[]) {
  if (trades.length === 0) {
    return {
      totalPoints: 0,
      journalScore: 0,
      checklistScore: 0,
      performanceScore: 0,
      streakScore: 0,
      tradingDays: 0,
      checklistUsage: 0,
      winRate: 0,
      currentStreak: 0,
    };
  }

  const uniqueDays = new Set(trades.map(t => t.date)).size;
  const journalScore = Math.min(uniqueDays * 5, 200);

  const tradesWithChecklist = trades.filter(t => t.checklist_id).length;
  const checklistUsageRate = (tradesWithChecklist / trades.length) * 100;
  const checklistScore = Math.round(checklistUsageRate * 2);

  const winningTrades = trades.filter(t => t.result > 0).length;
  const winRate = (winningTrades / trades.length) * 100;
  const totalPnL = trades.reduce((sum, t) => sum + t.result, 0);
  
  const winRatePoints = Math.min(Math.max((winRate - 30) * 5, 0), 150);
  const profitPoints = totalPnL > 0 ? Math.min(Math.log10(totalPnL + 1) * 20, 100) : 0;
  const performanceScore = Math.round(winRatePoints + profitPoints);

  const dailyPnL: Record<string, number> = {};
  trades.forEach(t => {
    dailyPnL[t.date] = (dailyPnL[t.date] || 0) + t.result;
  });
  
  const sortedDays = Object.entries(dailyPnL).sort((a, b) => 
    new Date(b[0]).getTime() - new Date(a[0]).getTime()
  );
  
  let currentStreak = 0;
  let maxStreak = 0;
  
  for (const [_, pnl] of sortedDays) {
    if (pnl >= 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      break;
    }
  }
  
  const streakScore = Math.min(currentStreak * 15 + maxStreak * 5, 150);
  const totalPoints = journalScore + checklistScore + performanceScore + streakScore;

  return {
    totalPoints,
    journalScore,
    checklistScore,
    performanceScore,
    streakScore,
    tradingDays: uniqueDays,
    checklistUsage: Math.round(checklistUsageRate),
    winRate: Math.round(winRate),
    currentStreak,
  };
}

export function RankBadge({ trades }: RankBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const stats = useMemo(() => calculateConsistencyScore(trades), [trades]);
  
  const currentRank = useMemo(() => {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (stats.totalPoints >= RANKS[i].minPoints) {
        return { ...RANKS[i], index: i };
      }
    }
    return { ...RANKS[0], index: 0 };
  }, [stats.totalPoints]);

  const nextRank = RANKS[currentRank.index + 1];
  const pointsToNext = nextRank ? nextRank.minPoints - stats.totalPoints : 0;
  const progressToNext = nextRank 
    ? ((stats.totalPoints - currentRank.minPoints) / (nextRank.minPoints - currentRank.minPoints)) * 100
    : 100;

  const RankIcon = currentRank.icon;

  const metrics = [
    { label: "Trading Days", value: stats.tradingDays, icon: Target, score: stats.journalScore },
    { label: "Checklist Usage", value: `${stats.checklistUsage}%`, icon: CheckCircle2, score: stats.checklistScore },
    { label: "Win Rate", value: `${stats.winRate}%`, icon: TrendingUp, score: stats.performanceScore },
    { label: "Win Streak", value: stats.currentStreak, icon: Flame, score: stats.streakScore },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:scale-105",
            "bg-gradient-to-r", currentRank.color,
            "shadow-md hover:shadow-lg"
          )}
        >
          <RankIcon className="w-4 h-4 text-white" />
          <span className="text-xs font-semibold text-white">{currentRank.name}</span>
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0 border-border/40" 
        align="end"
        sideOffset={8}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Trader Rank</h3>
            <div className="text-xs text-muted-foreground">
              {stats.totalPoints} pts
            </div>
          </div>

          {/* Main Rank Display */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                currentRank.color
              )}
            >
              <RankIcon className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1">
              <h2 className={cn("text-xl font-bold", currentRank.textColor)}>
                {currentRank.name}
              </h2>
              
              {nextRank && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Next: {nextRank.name}</span>
                    <span className="text-muted-foreground">{pointsToNext} pts</span>
                  </div>
                  <Progress value={progressToNext} className="h-1" />
                </div>
              )}
              
              {!nextRank && (
                <p className="text-xs text-muted-foreground">Maximum rank achieved!</p>
              )}
            </div>
          </div>

          {/* Consistency Metrics */}
          <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => {
            const isFlame = metric.label === "Win Streak" && stats.currentStreak > 0;
            
            return (
              <div
                key={metric.label}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
              >
                <div className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center",
                  isFlame ? "bg-orange-500/20" : "bg-muted/50"
                )}>
                  <metric.icon className={cn(
                    "w-3.5 h-3.5",
                    isFlame 
                      ? "text-orange-500 animate-[flicker_0.5s_ease-in-out_infinite]" 
                      : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-semibold",
                    isFlame && stats.currentStreak >= 3 && "text-orange-500"
                  )}>
                    {metric.value}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">{metric.label}</div>
                </div>
                <div className="text-[9px] text-primary font-medium">
                  +{metric.score}
                </div>
              </div>
            );
          })}
          </div>

          {/* Rank Progression */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between gap-0.5">
              {RANKS.map((rank, index) => {
                const isActive = index <= currentRank.index;
                const isCurrent = index === currentRank.index;
                const Icon = rank.icon;
                
                return (
                  <div
                    key={rank.name}
                    className={cn(
                      "relative flex-1 flex flex-col items-center py-1 rounded transition-all",
                      isCurrent && "bg-muted/40"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center transition-all",
                      isActive ? `bg-gradient-to-br ${rank.color}` : "bg-muted/30"
                    )}>
                      <Icon className={cn(
                        "w-2.5 h-2.5",
                        isActive ? "text-white" : "text-muted-foreground/40"
                      )} />
                    </div>
                    {isCurrent && (
                      <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
