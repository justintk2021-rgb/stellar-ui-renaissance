import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Pencil,
  Check,
  X,
  Link2,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCountUp } from '@/hooks/useCountUp';
import type { ProjectionMetrics } from '@/lib/accountProjection';

interface AccountProjectionCardProps {
  accountLabel: string;
  accountSubtitle: string;
  isBroker: boolean;
  isLoading?: boolean;
  currentBalance: number;
  startBalance: number;
  goalBalance: number | null;
  profitTarget: number | null;
  metrics: ProjectionMetrics;
  onSetGoalBalance: (value: number) => Promise<boolean>;
  onSetProfitTarget: (value: number) => Promise<boolean>;
}

function Money({ value, className }: { value: number; className?: string }) {
  const { formattedValue } = useCountUp({ end: value, duration: 700, decimals: 2, prefix: '$' });
  return (
    <span className={cn('text-foreground tabular-nums', className)}>{formattedValue}</span>
  );
}

function ProgressRing({
  progress,
  size = 56,
}: {
  progress: number;
  size?: number;
}) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 text-primary">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold font-mono leading-none text-primary">
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
}

export function AccountProjectionCard({
  accountLabel,
  accountSubtitle,
  isBroker,
  isLoading,
  currentBalance,
  startBalance,
  goalBalance,
  profitTarget,
  metrics,
  onSetGoalBalance,
  onSetProfitTarget,
}: AccountProjectionCardProps) {
  const [tab, setTab] = useState<'goal' | 'profit'>('goal');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTargetInput = tab === 'goal' ? goalBalance : profitTarget;
  const activeTarget = activeTargetInput;
  const activeProgress = tab === 'goal' ? metrics.goalProgress : metrics.profitProgress;
  const activeRemaining = tab === 'goal' ? metrics.remainingToGoal : metrics.remainingProfit;
  const activeCurrent = currentBalance;
  const isComplete = tab === 'goal' ? metrics.goalReached : metrics.profitTargetHit;

  useEffect(() => {
    if (!editing) {
      setEditValue((activeTargetInput || 0).toString());
    }
  }, [activeTargetInput, editing, tab]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue((activeTargetInput || 0).toString());
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue((activeTargetInput || 0).toString());
  };

  const confirmEdit = async () => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0) return;
    const ok = tab === 'goal'
      ? await onSetGoalBalance(value)
      : await onSetProfitTarget(value);
    if (ok) setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.15 }}
      className="relative rounded-2xl p-3 overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl h-auto self-start"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <div className="relative flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Target className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">Projection</span>
                {isBroker && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide flex items-center gap-0.5">
                    <Link2 className="w-2.5 h-2.5" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground truncate" title={`${accountLabel} · ${accountSubtitle}`}>
                {accountLabel}
              </p>
            </div>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={startEdit}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/40 border border-border/40">
          {(['goal', 'profit'] as const).map((key) => (
            <button
              key={key}
              onClick={() => { setTab(key); setEditing(false); }}
              className={cn(
                'flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-md transition-all',
                tab === key
                  ? 'bg-background shadow-sm text-primary border border-border/30'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {key === 'goal' ? 'Goal' : 'Profit Target'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
            Loading…
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-2"
            >
              {/* Target value + ring */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    {tab === 'goal' ? 'Target balance' : 'Profit target'}
                  </p>
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-base font-bold font-mono text-foreground">$</span>
                      <Input
                        ref={inputRef}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="h-7 text-sm font-mono font-bold max-w-[110px] px-2"
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={confirmEdit}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : activeTargetInput && activeTargetInput > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Money value={activeTargetInput} className="text-lg font-bold font-mono" />
                      {isComplete && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          {tab === 'goal' ? 'Reached' : 'Hit'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={startEdit}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Set {tab === 'goal' ? 'goal' : 'target'} →
                    </button>
                  )}
                </div>

                {activeTargetInput && activeTargetInput > 0 && (
                  <ProgressRing progress={activeProgress} />
                )}
              </div>

              {activeTargetInput && activeTargetInput > 0 && activeTarget != null ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg bg-muted/20 border border-border/20 p-1.5 text-center">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      {tab === 'goal' ? 'Current' : 'Balance'}
                    </div>
                    <Money value={activeCurrent} className="text-[11px] font-bold font-mono block leading-tight mt-0.5" />
                  </div>
                  <div className="rounded-lg bg-muted/20 border border-border/20 p-1.5 text-center">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      {tab === 'goal' ? 'Target' : 'Profit Goal'}
                    </div>
                    <Money value={activeTarget} className="text-[11px] font-bold font-mono block leading-tight mt-0.5" />
                  </div>
                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-1.5 text-center">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Left</div>
                    <Money
                      value={activeRemaining ?? 0}
                      className={cn(
                        'text-[11px] font-bold font-mono block leading-tight mt-0.5',
                        (activeRemaining ?? 0) <= 0 ? 'text-primary' : 'text-foreground',
                      )}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/40 p-2 text-center text-[11px] text-muted-foreground">
                  Set a {tab === 'goal' ? 'goal' : 'target'} to track progress.
                </div>
              )}

              {/* Insight row */}
              <div className="pt-1.5 border-t border-border/30 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span>
                  Start{' '}
                  <span className="font-mono font-semibold text-foreground">${startBalance.toFixed(0)}</span>
                </span>
                <span>
                  Profit{' '}
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      metrics.accountProfit >= 0 ? 'text-primary' : 'text-destructive',
                    )}
                  >
                    {metrics.accountProfit >= 0 ? '+' : ''}${metrics.accountProfit.toFixed(0)}
                  </span>
                </span>
                {metrics.estimatedDaysToGoal != null && tab === 'goal' && !isComplete && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <CalendarDays className="w-2.5 h-2.5" />
                    ~{metrics.estimatedDaysToGoal}d
                  </span>
                )}
                {metrics.tradingDays > 0 && <span>{metrics.tradingDays}d active</span>}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
