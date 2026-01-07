import { useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Trophy, TrendingUp, Target, CheckCircle2, 
  Flame, Star, Crown, Shield, Zap, Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Trade {
  id: string;
  date: string;
  result: number;
  checklist_id?: string | null;
  checklist_state?: any;
}

interface RankCardProps {
  trades: Trade[];
}

// Rank tiers from lowest to highest
const RANKS = [
  { name: "Novice", icon: Shield, color: "from-slate-400 to-slate-500", minPoints: 0, textColor: "text-slate-400" },
  { name: "Apprentice", icon: Zap, color: "from-amber-600 to-amber-700", minPoints: 100, textColor: "text-amber-500" },
  { name: "Trader", icon: Target, color: "from-emerald-500 to-emerald-600", minPoints: 300, textColor: "text-emerald-500" },
  { name: "Skilled", icon: Star, color: "from-blue-500 to-blue-600", minPoints: 600, textColor: "text-blue-500" },
  { name: "Expert", icon: Award, color: "from-purple-500 to-purple-600", minPoints: 1000, textColor: "text-purple-500" },
  { name: "Master", icon: Crown, color: "from-amber-400 to-yellow-500", minPoints: 1500, textColor: "text-amber-400" },
  { name: "Legend", icon: Trophy, color: "from-rose-500 to-pink-500", minPoints: 2500, textColor: "text-rose-500" },
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

  // 1. Journal Consistency (logging trades regularly)
  const uniqueDays = new Set(trades.map(t => t.date)).size;
  const journalScore = Math.min(uniqueDays * 5, 200); // Max 200 points for 40+ trading days

  // 2. Checklist Usage (using playbooks)
  const tradesWithChecklist = trades.filter(t => t.checklist_id).length;
  const checklistUsageRate = (tradesWithChecklist / trades.length) * 100;
  const checklistScore = Math.round(checklistUsageRate * 2); // Max 200 points for 100% usage

  // 3. Performance Score (profitable trading)
  const winningTrades = trades.filter(t => t.result > 0).length;
  const winRate = (winningTrades / trades.length) * 100;
  const totalPnL = trades.reduce((sum, t) => sum + t.result, 0);
  
  // Points for win rate (up to 150 points for 60%+ win rate)
  const winRatePoints = Math.min(Math.max((winRate - 30) * 5, 0), 150);
  
  // Points for profitability (up to 100 points)
  const profitPoints = totalPnL > 0 ? Math.min(Math.log10(totalPnL + 1) * 20, 100) : 0;
  const performanceScore = Math.round(winRatePoints + profitPoints);

  // 4. Streak Score (consistency over time)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  let currentStreak = 0;
  let maxStreak = 0;
  const dailyPnL: Record<string, number> = {};
  
  trades.forEach(t => {
    dailyPnL[t.date] = (dailyPnL[t.date] || 0) + t.result;
  });
  
  const sortedDays = Object.entries(dailyPnL).sort((a, b) => 
    new Date(b[0]).getTime() - new Date(a[0]).getTime()
  );
  
  // Calculate current winning streak
  for (const [_, pnl] of sortedDays) {
    if (pnl >= 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      break;
    }
  }
  
  const streakScore = Math.min(currentStreak * 15 + maxStreak * 5, 150); // Max 150 points

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

export function RankCard({ trades }: RankCardProps) {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass rounded-2xl p-5 border border-border/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-muted-foreground">Trader Rank</h3>
        <div className="text-xs text-muted-foreground/60">
          {stats.totalPoints} pts
        </div>
      </div>

      {/* Main Rank Display */}
      <div className="flex items-center gap-4 mb-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
          className={cn(
            "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
            currentRank.color
          )}
        >
          <RankIcon className="w-8 h-8 text-white" />
        </motion.div>
        
        <div className="flex-1">
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className={cn("text-2xl font-bold", currentRank.textColor)}
          >
            {currentRank.name}
          </motion.h2>
          
          {nextRank && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Next: {nextRank.name}</span>
                <span className="text-muted-foreground">{pointsToNext} pts away</span>
              </div>
              <Progress value={progressToNext} className="h-1.5" />
            </div>
          )}
          
          {!nextRank && (
            <p className="text-xs text-muted-foreground mt-1">Maximum rank achieved!</p>
          )}
        </div>
      </div>

      {/* Consistency Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.05 }}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
              <metric.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{metric.value}</div>
              <div className="text-[10px] text-muted-foreground truncate">{metric.label}</div>
            </div>
            <div className="text-[10px] text-primary font-medium">
              +{metric.score}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rank Progression */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <div className="flex items-center justify-between gap-1">
          {RANKS.map((rank, index) => {
            const isActive = index <= currentRank.index;
            const isCurrent = index === currentRank.index;
            const Icon = rank.icon;
            
            return (
              <motion.div
                key={rank.name}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className={cn(
                  "relative flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all",
                  isCurrent && "bg-muted/40"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                  isActive ? `bg-gradient-to-br ${rank.color}` : "bg-muted/30"
                )}>
                  <Icon className={cn(
                    "w-3 h-3",
                    isActive ? "text-white" : "text-muted-foreground/40"
                  )} />
                </div>
                {isCurrent && (
                  <motion.div
                    layoutId="rankIndicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
