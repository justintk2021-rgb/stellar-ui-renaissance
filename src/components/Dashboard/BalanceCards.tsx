import { useMemo, useState, useRef, useEffect } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, MoreHorizontal, Target } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

interface BalanceCardsProps {
  trades: Trade[];
  startBalance: number;
  goalBalance: number | null;
  onSetBalance: (balance: number) => void;
  onSetGoalBalance: (balance: number) => void;
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
  
  return (
    <div className="w-20 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparkGradient-${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                stopOpacity={0.3}
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
            strokeWidth={1.5}
            fill={`url(#sparkGradient-${isPositive ? 'pos' : 'neg'})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceCards({ trades, startBalance, goalBalance, onSetBalance, onSetGoalBalance }: BalanceCardsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editValue, setEditValue] = useState(startBalance.toString());
  const [editGoalValue, setEditGoalValue] = useState((goalBalance || 0).toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const goalInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Balance Card */}
      <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Balance</span>
          <div className="flex items-center gap-2">
            <Sparkline data={sparklineData} isPositive={isPositive} />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleStartEdit}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold font-mono">$</span>
                <Input
                  ref={inputRef}
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-32 h-8 text-2xl font-bold font-mono px-2 py-0 bg-background/50 border-primary/50"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary hover:bg-primary/20"
                  onClick={handleConfirm}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  onClick={handleCancel}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <AnimatedValue 
                  value={currentBalance} 
                  prefix="$" 
                  className="text-2xl font-bold font-mono"
                />
                <span className={`text-xs font-medium ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                  {isPositive ? '+' : ''}{balancePercent.toFixed(2)}%
                </span>
              </>
            )}
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Highest balance</div>
            <AnimatedValue 
              value={highestBalance} 
              prefix="$" 
              className="text-sm font-semibold font-mono"
            />
          </div>
        </div>
      </div>

      {/* Profit Card */}
      <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Profit</span>
          <Sparkline data={sparklineData} isPositive={isProfitPositive} />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <AnimatedValue 
              value={profit} 
              prefix="$" 
              className="text-2xl font-bold font-mono"
            />
            <span className={`text-xs font-medium ${isProfitPositive ? 'text-primary' : 'text-destructive'}`}>
              +{profitPercent.toFixed(2)}%
            </span>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Fees</div>
            <AnimatedValue 
              value={-fees} 
              prefix="-$" 
              className="text-sm font-semibold font-mono text-destructive"
            />
          </div>
        </div>
      </div>

      {/* Goal Balance Card */}
      <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Goal Balance</span>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleStartEditGoal}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            {isEditingGoal ? (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold font-mono">$</span>
                <Input
                  ref={goalInputRef}
                  type="number"
                  value={editGoalValue}
                  onChange={(e) => setEditGoalValue(e.target.value)}
                  onKeyDown={handleKeyDownGoal}
                  className="w-32 h-8 text-2xl font-bold font-mono px-2 py-0 bg-background/50 border-primary/50"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary hover:bg-primary/20"
                  onClick={handleConfirmGoal}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  onClick={handleCancelGoal}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <AnimatedValue 
                  value={goalBalance || 0} 
                  prefix="$" 
                  className="text-2xl font-bold font-mono"
                />
                {goalBalance && goalBalance > 0 && (
                  <span className={`text-xs font-medium ${currentBalance >= goalBalance ? 'text-primary' : 'text-muted-foreground'}`}>
                    {currentBalance >= goalBalance ? '✓ Reached' : `${(((goalBalance - currentBalance) / goalBalance) * 100).toFixed(1)}% away`}
                  </span>
                )}
              </>
            )}
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Progress</div>
            {goalBalance && goalBalance > 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (currentBalance / goalBalance) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold font-mono">
                  {Math.min(100, (currentBalance / goalBalance) * 100).toFixed(0)}%
                </span>
              </div>
            ) : (
              <span className="text-sm font-semibold font-mono text-muted-foreground">
                Set a goal to track progress
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
