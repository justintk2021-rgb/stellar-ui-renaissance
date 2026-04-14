import { useMemo, useState, useRef, useEffect } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, MoreHorizontal, Target, TrendingUp, Wallet, Trophy } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

interface BalanceCardsProps {
  trades: Trade[];
  startBalance: number;
  goalBalance: number | null;
  profitTarget: number | null;
  onSetBalance: (balance: number) => void;
  onSetGoalBalance: (balance: number) => void;
  onSetProfitTarget: (target: number) => void;
}

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

function AnimatedValue({ value, prefix = "", suffix = "", decimals = 2, className = "" }: AnimatedValueProps) {
  const { formattedValue } = useCountUp({
    end: value,
    duration: 800,
    decimals,
    prefix,
    suffix,
  });
  
  return <span className={className}>{formattedValue}</span>;
}

interface SparklineProps {
  data: number[];
  isPositive: boolean;
  height?: number;
}

function Sparkline({ data, isPositive, height = 40 }: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  const gradientId = `sparkGradient-${isPositive ? 'pos' : 'neg'}-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <motion.div 
      className="w-24 h-12"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                stopOpacity={0.4}
              />
              <stop
                offset="100%"
                stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
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
      delay: i * 0.1,
    },
  }),
  hover: {
    y: -6,
    scale: 1.02,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 20,
    },
  },
};

const iconVariants = {
  initial: { rotate: 0 },
  hover: { rotate: 15, scale: 1.1 },
};

// Removed animated glow variants to reduce visual interference

export function BalanceCards({ trades, startBalance, goalBalance, profitTarget, onSetBalance, onSetGoalBalance, onSetProfitTarget }: BalanceCardsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingProfitTarget, setIsEditingProfitTarget] = useState(false);
  const [editValue, setEditValue] = useState(startBalance.toString());
  const [editGoalValue, setEditGoalValue] = useState((goalBalance || 0).toString());
  const [editProfitTargetValue, setEditProfitTargetValue] = useState((profitTarget || 0).toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const goalInputRef = useRef<HTMLInputElement>(null);
  const profitTargetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(startBalance.toString());
    }
  }, [startBalance, isEditing]);

  useEffect(() => {
    if (!isEditingGoal) {
      setEditGoalValue((goalBalance || 0).toString());
    }
  }, [goalBalance, isEditingGoal]);

  useEffect(() => {
    if (!isEditingProfitTarget) {
      setEditProfitTargetValue((profitTarget || 0).toString());
    }
  }, [profitTarget, isEditingProfitTarget]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingGoal && goalInputRef.current) {
      goalInputRef.current.focus();
      goalInputRef.current.select();
    }
  }, [isEditingGoal]);

  useEffect(() => {
    if (isEditingProfitTarget && profitTargetInputRef.current) {
      profitTargetInputRef.current.focus();
      profitTargetInputRef.current.select();
    }
  }, [isEditingProfitTarget]);

  const handleStartEdit = () => {
    setEditValue(startBalance.toString());
    setIsEditing(true);
  };

  const handleConfirm = () => {
    const value = parseFloat(editValue);
    if (!isNaN(value) && value >= 0) {
      onSetBalance(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(startBalance.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  };

  // Goal balance handlers
  const handleStartEditGoal = () => {
    setEditGoalValue((goalBalance || 0).toString());
    setIsEditingGoal(true);
  };

  const handleConfirmGoal = () => {
    const value = parseFloat(editGoalValue);
    if (!isNaN(value) && value >= 0) {
      onSetGoalBalance(value);
    }
    setIsEditingGoal(false);
  };

  const handleCancelGoal = () => {
    setEditGoalValue((goalBalance || 0).toString());
    setIsEditingGoal(false);
  };

  const handleKeyDownGoal = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirmGoal();
    if (e.key === "Escape") handleCancelGoal();
  };

  // Profit target handlers
  const handleStartEditProfitTarget = () => {
    setEditProfitTargetValue((profitTarget || 0).toString());
    setIsEditingProfitTarget(true);
  };

  const handleConfirmProfitTarget = () => {
    const value = parseFloat(editProfitTargetValue);
    if (!isNaN(value) && value >= 0) {
      onSetProfitTarget(value);
    }
    setIsEditingProfitTarget(false);
  };

  const handleCancelProfitTarget = () => {
    setEditProfitTargetValue((profitTarget || 0).toString());
    setIsEditingProfitTarget(false);
  };

  const handleKeyDownProfitTarget = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirmProfitTarget();
    if (e.key === "Escape") handleCancelProfitTarget();
  };

  const { currentBalance, balanceChange, balancePercent, profit, profitPercent, fees, highestBalance, sparklineData } = useMemo(() => {
    const sortedTrades = [...trades].sort((a, b) => {
      if (a.date === b.date) return parseInt(a.id) - parseInt(b.id);
      return a.date < b.date ? -1 : 1;
    });

    let equity = startBalance;
    let highest = startBalance;
    let totalProfit = 0;
    let totalFees = 0;
    const equityPoints: number[] = [startBalance];
    
    sortedTrades.forEach((trade) => {
      const result = trade.result || 0;
      equity += result;
      if (result > 0) {
        totalProfit += result;
      }
      // Simulate fees as a small percentage of trade volume (for demo)
      totalFees += Math.abs(result) * 0.01;
      highest = Math.max(highest, equity);
      equityPoints.push(equity);
    });

    const change = equity - startBalance;
    const percentChange = startBalance > 0 ? (change / startBalance) * 100 : 0;
    const profitPct = startBalance > 0 ? (totalProfit / startBalance) * 100 : 0;

    return {
      currentBalance: equity,
      balanceChange: change,
      balancePercent: percentChange,
      profit: totalProfit,
      profitPercent: profitPct,
      fees: totalFees,
      highestBalance: highest,
      sparklineData: equityPoints.length > 1 ? equityPoints : [startBalance, startBalance],
    };
  }, [trades, startBalance]);

  const isPositive = balanceChange >= 0;
  const isProfitPositive = profit >= 0;
  const goalProgress = goalBalance && goalBalance > 0 ? Math.min(100, (currentBalance / goalBalance) * 100) : 0;
  const netProfit = currentBalance - startBalance;
  const profitTargetProgress = profitTarget && profitTarget > 0 ? Math.min(100, (Math.max(0, netProfit) / profitTarget) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Balance Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        custom={0}
        className="relative group rounded-2xl p-6 overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl"
      >
        
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                variants={iconVariants}
                initial="initial"
                whileHover="hover"
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPositive ? "bg-primary/15" : "bg-destructive/15"
                )}
              >
                <Wallet className={cn("w-5 h-5", isPositive ? "text-primary" : "text-destructive")} />
              </motion.div>
              <span className="text-sm font-medium text-muted-foreground">Balance</span>
            </div>
            <Sparkline data={sparklineData} isPositive={isPositive} />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-3xl font-bold font-mono">$</span>
                    <Input
                      ref={inputRef}
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-36 h-10 text-2xl font-bold font-mono px-2 py-0 bg-background/50 border-primary/50"
                    />
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-primary hover:bg-primary/20"
                        onClick={handleConfirm}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-baseline gap-3"
                  >
                    <AnimatedValue 
                      value={currentBalance} 
                      prefix="$" 
                      className="text-3xl font-bold font-mono"
                    />
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className={cn(
                        "text-sm font-semibold px-2 py-0.5 rounded-full",
                        isPositive ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
                      )}
                    >
                      {isPositive ? '+' : ''}{balancePercent.toFixed(2)}%
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-xs text-muted-foreground mb-1">All-time high</div>
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                <AnimatedValue 
                  value={highestBalance} 
                  prefix="$" 
                  className="text-sm font-semibold font-mono"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Profit Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        custom={1}
        className="relative group rounded-2xl p-6 overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl"
      >
        
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                variants={iconVariants}
                initial="initial"
                whileHover="hover"
                className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"
              >
                <TrendingUp className="w-5 h-5 text-primary" />
              </motion.div>
              <span className="text-sm font-medium text-muted-foreground">Total Profit</span>
            </div>
            <Sparkline data={sparklineData} isPositive={isProfitPositive} />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <AnimatedValue 
                value={profit} 
                prefix="$" 
                className="text-3xl font-bold font-mono"
              />
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary"
              >
                +{profitPercent.toFixed(2)}%
              </motion.span>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-4"
            >
              <div>
                <div className="text-xs text-muted-foreground mb-1">Net Change</div>
                <span className={cn(
                  "text-sm font-semibold font-mono",
                  isPositive ? "text-primary" : "text-destructive"
                )}>
                  {isPositive ? '+' : ''}${balanceChange.toFixed(2)}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Goal Balance Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        custom={2}
        className="relative group rounded-2xl p-6 overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl"
      >
        
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                variants={iconVariants}
                initial="initial"
                whileHover="hover"
                className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center"
              >
                <Target className="w-5 h-5 text-primary" />
              </motion.div>
              <span className="text-sm font-medium text-muted-foreground">Goal Balance</span>
            </div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleStartEditGoal}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <AnimatePresence mode="wait">
                {isEditingGoal ? (
                  <motion.div
                    key="editing-goal"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-3xl font-bold font-mono">$</span>
                    <Input
                      ref={goalInputRef}
                      type="number"
                      value={editGoalValue}
                      onChange={(e) => setEditGoalValue(e.target.value)}
                      onKeyDown={handleKeyDownGoal}
                      className="w-36 h-10 text-2xl font-bold font-mono px-2 py-0 bg-background/50 border-primary/50"
                    />
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-primary hover:bg-primary/20"
                        onClick={handleConfirmGoal}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                        onClick={handleCancelGoal}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display-goal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-baseline gap-3"
                  >
                    <AnimatedValue 
                      value={goalBalance || 0} 
                      prefix="$" 
                      className="text-3xl font-bold font-mono"
                    />
                    {goalBalance && goalBalance > 0 && currentBalance >= goalBalance && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary"
                      >
                        ✓ Reached
                      </motion.span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Goal Balance Progress */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="text-xs text-muted-foreground mb-2">Goal Progress</div>
              {goalBalance && goalBalance > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${goalProgress}%` }}
                      transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono text-primary">
                    {goalProgress.toFixed(0)}%
                  </span>
                </div>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Set a goal to track progress
                </span>
              )}
            </motion.div>

            {/* Profit Target Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="pt-3 border-t border-border/20"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-accent-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Profit Target</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleStartEditProfitTarget}
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {isEditingProfitTarget ? (
                  <motion.div
                    key="editing-profit-target"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 mb-2"
                  >
                    <span className="text-lg font-bold font-mono">$</span>
                    <Input
                      ref={profitTargetInputRef}
                      type="number"
                      value={editProfitTargetValue}
                      onChange={(e) => setEditProfitTargetValue(e.target.value)}
                      onKeyDown={handleKeyDownProfitTarget}
                      className="w-28 h-8 text-lg font-bold font-mono px-2 py-0 bg-background/50 border-primary/50"
                    />
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/20" onClick={handleConfirmProfitTarget}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:bg-destructive/20 hover:text-destructive" onClick={handleCancelProfitTarget}>
                        <X className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div key="display-profit-target" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-baseline gap-2 mb-2">
                    <AnimatedValue 
                      value={profitTarget || 0} 
                      prefix="$" 
                      className="text-lg font-bold font-mono"
                    />
                    {profitTarget && profitTarget > 0 && netProfit >= profitTarget && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                      >
                        ✓ Hit
                      </motion.span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {profitTarget && profitTarget > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-accent to-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${profitTargetProgress}%` }}
                      transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-primary">
                    {profitTargetProgress.toFixed(0)}%
                  </span>
                </div>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">
                  Set a profit target to track
                </span>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
