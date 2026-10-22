import { useEffect, useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROP_FIRM_RULES,
  PROP_FIRM_PRESETS,
  evaluatePropFirm,
  type DrawdownMode,
  type PropFirmRules,
  type PropFirmStanding,
} from "@/lib/propFirm";
import { AlertTriangle, CheckCircle2, Shield, Target, TrendingDown } from "lucide-react";

const STORAGE_KEY = "nsync-propfirm-rules";

interface PropFirmViewProps {
  trades: Trade[];
  accountLabel: string;
  startBalance: number;
  currentBalance: number;
  todayPnL?: number | null;
}

const STANDING_COPY: Record<PropFirmStanding, { label: string; className: string }> = {
  "on-track": { label: "On track", className: "border-primary/40 bg-primary/10 text-primary" },
  "at-risk": { label: "At risk", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  passed: { label: "Target hit", className: "border-primary/40 bg-primary/15 text-primary" },
  breached: { label: "Limit hit", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

function money(value: number): string {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? "-" : ""}$${abs}`;
}

function storedPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function loadRules(): PropFirmRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROP_FIRM_RULES;
    const parsed = JSON.parse(raw) as Partial<PropFirmRules>;
    const mode: DrawdownMode = parsed.drawdownMode === "trailing" ? "trailing" : "static";
    return {
      profitTargetPct: storedPercent(parsed.profitTargetPct, DEFAULT_PROP_FIRM_RULES.profitTargetPct),
      dailyLossPct: storedPercent(parsed.dailyLossPct, DEFAULT_PROP_FIRM_RULES.dailyLossPct),
      maxDrawdownPct: storedPercent(parsed.maxDrawdownPct, DEFAULT_PROP_FIRM_RULES.maxDrawdownPct),
      drawdownMode: mode,
    };
  } catch {
    return DEFAULT_PROP_FIRM_RULES;
  }
}

function RuleField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1.5" htmlFor={id}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          step={0.5}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) && next >= 0 ? next : 0);
          }}
          className="pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </label>
  );
}

export function PropFirmView({
  trades,
  accountLabel,
  startBalance,
  currentBalance,
  todayPnL,
}: PropFirmViewProps) {
  const [rules, setRules] = useState<PropFirmRules>(loadRules);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);

  const evaluation = useMemo(
    () => evaluatePropFirm({ trades, startBalance, currentBalance, rules, todayPnL }),
    [trades, startBalance, currentBalance, rules, todayPnL],
  );

  const standing = STANDING_COPY[evaluation.standing];
  const hasBalance = startBalance > 0;
  const activePreset = PROP_FIRM_PRESETS.find((preset) => (
    preset.rules.profitTargetPct === rules.profitTargetPct
    && preset.rules.dailyLossPct === rules.dailyLossPct
    && preset.rules.maxDrawdownPct === rules.maxDrawdownPct
    && preset.rules.drawdownMode === rules.drawdownMode
  ));

  const update = (patch: Partial<PropFirmRules>) => setRules((current) => ({ ...current, ...patch }));

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-border/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-[11px] uppercase tracking-widest">Challenge</span>
            </div>
            <h3 className="text-lg font-semibold">{accountLabel || "Selected account"}</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              Progress uses this account’s balance. The percentages are templates you can edit — they are not loaded from a prop firm.
            </p>
          </div>
          <Badge variant="outline" className={cn("w-fit px-3 py-1", standing.className)}>
            {evaluation.standing === "breached" ? <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            {standing.label}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Start" value={money(startBalance)} />
          <Stat label="Current" value={money(currentBalance)} />
          <Stat
            label="Profit"
            value={money(evaluation.accountProfit)}
            tone={evaluation.accountProfit >= 0 ? "positive" : "negative"}
          />
          <Stat
            label="Today"
            value={money(evaluation.todayPnL)}
            tone={evaluation.todayPnL >= 0 ? "positive" : "negative"}
          />
        </div>
        {!hasBalance && (
          <p className="mt-4 text-sm text-amber-500">
            Set a starting balance on the dashboard before these limits can be measured.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LimitCard
          icon={Target}
          title="Profit target"
          detail={`${rules.profitTargetPct}% of start · ${money(evaluation.profitTarget)}`}
          usedLabel={`${money(Math.max(0, evaluation.accountProfit))} of ${money(evaluation.profitTarget)}`}
          percent={evaluation.profitProgress}
          barClassName="[&>div]:bg-primary"
          footnote={evaluation.profitRemaining > 0 ? `${money(evaluation.profitRemaining)} remaining` : "Target reached"}
        />
        <LimitCard
          icon={AlertTriangle}
          title="Daily loss"
          detail={`${rules.dailyLossPct}% of start · ${money(evaluation.dailyLossLimit)}`}
          usedLabel={evaluation.todayPnL < 0 ? `${money(evaluation.todayPnL)} today` : "No loss today"}
          percent={evaluation.dailyLossUsedPct}
          barClassName={evaluation.dailyBreached ? "[&>div]:bg-destructive" : "[&>div]:bg-amber-500"}
          footnote={evaluation.dailyBreached ? "Daily loss limit reached" : `${Math.max(0, 100 - evaluation.dailyLossUsedPct).toFixed(0)}% of the limit left`}
        />
        <LimitCard
          icon={TrendingDown}
          title={rules.drawdownMode === "trailing" ? "Trailing drawdown" : "Max drawdown"}
          detail={`${rules.maxDrawdownPct}% of start · ${money(evaluation.maxDrawdownLimit)}`}
          usedLabel={`${money(evaluation.currentDrawdown)} off ${rules.drawdownMode === "trailing" ? "the peak" : "the start"}`}
          percent={evaluation.drawdownUsedPct}
          barClassName={evaluation.drawdownBreached ? "[&>div]:bg-destructive" : "[&>div]:bg-amber-500"}
          footnote={rules.drawdownMode === "trailing" ? `Peak ${money(evaluation.peakBalance)}` : "Measured from the starting balance"}
        />
      </div>

      <div className="glass rounded-2xl border border-border/40 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Rules</h3>
            <p className="text-xs text-muted-foreground">Saved in this browser.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROP_FIRM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setRules(preset.rules)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activePreset?.id === preset.id
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <RuleField id="prop-profit" label="Profit target" value={rules.profitTargetPct} onChange={(profitTargetPct) => update({ profitTargetPct })} />
          <RuleField id="prop-daily" label="Daily loss" value={rules.dailyLossPct} onChange={(dailyLossPct) => update({ dailyLossPct })} />
          <RuleField id="prop-dd" label="Max drawdown" value={rules.maxDrawdownPct} onChange={(maxDrawdownPct) => update({ maxDrawdownPct })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["static", "trailing"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => update({ drawdownMode: mode })}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                rules.drawdownMode === mode
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "static" ? "Static from start" : "Trailing from peak"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 font-mono text-sm font-semibold sm:text-base",
        tone === "positive" && "text-primary",
        tone === "negative" && "text-destructive",
      )}>
        {value}
      </div>
    </div>
  );
}

function LimitCard({
  icon: Icon,
  title,
  detail,
  usedLabel,
  percent,
  barClassName,
  footnote,
}: {
  icon: typeof Target;
  title: string;
  detail: string;
  usedLabel: string;
  percent: number;
  barClassName: string;
  footnote: string;
}) {
  const shown = Math.min(100, Math.max(0, percent));
  return (
    <div className="glass rounded-2xl border border-border/40 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{percent.toFixed(0)}%</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      <Progress value={shown} className={cn("mt-4 h-2", barClassName)} />
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-foreground">{usedLabel}</span>
        <span className="text-muted-foreground">{footnote}</span>
      </div>
    </div>
  );
}
