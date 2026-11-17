import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  Check,
} from "lucide-react";
import { motion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SymbolMark } from "@/components/ui/AssetIcon";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dedupeTradesForPnL, getTradeNetResult, journalTradeStats } from "@/lib/tradeFormat";
import type { Checklist, ChecklistItem } from "@/hooks/useChecklists";
import type { ChecklistItemState } from "@/types/trade";
import { Json } from "@/integrations/supabase/types";

export const BACKTEST_SESSION = "Backtesting";

export type BacktestTrade = {
  id: string;
  date: string;
  pair: string;
  direction?: "Long" | "Short";
  result: number;
  checklist_id?: string;
  accountId?: string;
  brokerAccountId?: string;
  session?: string;
  swap?: number | null;
  commission?: number | null;
  importedFromBroker?: boolean | null;
  brokerPositionId?: string | null;
  lastBrokerSyncAt?: string | null;
};

function isBacktestTrade(trade: { session?: string | null }) {
  return (trade.session || "").toLowerCase() === BACKTEST_SESSION.toLowerCase();
}

export function filterLivePlaybookTrades<T extends { session?: string | null }>(trades: T[]) {
  return trades.filter((trade) => !isBacktestTrade(trade));
}

export function filterBacktestPlaybookTrades<T extends { session?: string | null }>(trades: T[]) {
  return trades.filter((trade) => isBacktestTrade(trade));
}

function itemsToState(items: ChecklistItem[]): ChecklistItemState[] {
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    checked: false,
    percentage: item.percentage,
    percentageType: item.percentageType,
    subItems: item.subItems?.map((sub) => ({
      id: sub.id,
      text: sub.text,
      checked: false,
      percentage: sub.percentage,
      children: sub.children?.map((child) => ({
        id: child.id,
        text: child.text,
        checked: false,
      })),
    })),
  }));
}

function ruleCompliance(state: ChecklistItemState[]) {
  if (state.length === 0) return 100;
  const checked = state.filter((item) => item.checked).length;
  return Math.round((checked / state.length) * 100);
}

async function resolveBacktestAccountId(userId: string): Promise<string | null> {
  const persisted = localStorage.getItem("selectedManualAccountId");
  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("id, name, is_default")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const list = accounts || [];
  if (persisted && list.some((account) => account.id === persisted)) {
    return persisted;
  }

  const named = list.find((account) => /backtest/i.test(account.name || ""));
  if (named) return named.id;

  const fallback = list.find((account) => account.is_default) || list[0];
  if (fallback) return fallback.id;

  const { data: created, error } = await supabase
    .from("trading_accounts")
    .insert({
      user_id: userId,
      name: "Backtesting",
      starting_balance: 10000,
      currency: "USD",
      is_default: false,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("Failed to create Backtesting account", error);
    return null;
  }
  return created.id;
}

export function PlaybookBacktesting({
  checklist,
  trades,
  onTradeLogged,
}: {
  checklist: Checklist;
  trades: BacktestTrade[];
  onTradeLogged?: () => void;
}) {
  const backtestTrades = useMemo(
    () => dedupeTradesForPnL(filterBacktestPlaybookTrades(trades)),
    [trades],
  );

  const stats = useMemo(() => journalTradeStats(backtestTrades), [backtestTrades]);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pair, setPair] = useState("EURUSD");
  const [direction, setDirection] = useState<"Long" | "Short">("Long");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [ruleState, setRuleState] = useState<ChecklistItemState[]>(() => itemsToState(checklist.items));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRuleState(itemsToState(checklist.items));
  }, [checklist.id, checklist.items]);

  const compliance = ruleCompliance(ruleState);

  const toggleRule = (itemId: string) => {
    setRuleState((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    );
  };

  const resetForm = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10));
    setPair("EURUSD");
    setDirection("Long");
    setResult("");
    setNotes("");
    setRuleState(itemsToState(checklist.items));
  }, [checklist.items]);

  const handleLogBacktest = async () => {
    const pnl = Number(result);
    if (!pair.trim() || !Number.isFinite(pnl) || saving) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to log backtests");
        return;
      }

      const accountId = await resolveBacktestAccountId(user.id);
      if (!accountId) {
        toast.error("Connect or create a trading account first");
        return;
      }

      const { error } = await supabase.from("trades").insert({
        user_id: user.id,
        account_id: accountId,
        date,
        pair: pair.trim().toUpperCase(),
        direction,
        result: pnl,
        session: BACKTEST_SESSION,
        notes: notes.trim() || null,
        checklist_id: checklist.id,
        checklist_state: ruleState as unknown as Json,
      });

      if (error) throw error;

      toast.success("Backtest trade logged");
      resetForm();
      onTradeLogged?.();
    } catch (error) {
      console.error(error);
      toast.error("Failed to log backtest trade");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      key="backtesting"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <div
        aria-hidden
        className="pointer-events-none select-none space-y-6 blur-md opacity-60"
      >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Backtests", value: String(stats.total), accent: false },
          {
            label: "Net P&L",
            value: `${stats.netPnL >= 0 ? "+" : "-"}$${Math.abs(stats.netPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            accent: stats.netPnL >= 0,
          },
          { label: "Win rate", value: `${stats.winRate.toFixed(0)}%`, accent: stats.winRate >= 50 },
          { label: "Wins / Losses", value: `${stats.wins} / ${stats.losses}`, accent: false },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/40 bg-card/70 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p
              className={cn(
                "mt-1 font-mono text-lg font-semibold",
                card.accent ? "text-primary" : "text-foreground",
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-border/40 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Log backtest for {checklist.name}</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bt-date" className="text-xs text-muted-foreground">
                Date
              </Label>
              <Input
                id="bt-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt-pair" className="text-xs text-muted-foreground">
                Symbol
              </Label>
              <Input
                id="bt-pair"
                value={pair}
                onChange={(event) => setPair(event.target.value)}
                className="h-9 bg-background/40 uppercase"
                placeholder="EURUSD"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <div className="flex gap-2">
                {(["Long", "Short"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setDirection(side)}
                    className={cn(
                      "h-9 flex-1 rounded-lg border text-sm font-medium transition-colors",
                      direction === side
                        ? side === "Long"
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                          : "border-rose-500/40 bg-rose-500/15 text-rose-400"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt-result" className="text-xs text-muted-foreground">
                Net P&L
              </Label>
              <Input
                id="bt-result"
                type="number"
                inputMode="decimal"
                value={result}
                onChange={(event) => setResult(event.target.value)}
                className="h-9 bg-background/40 font-mono"
                placeholder="125.50"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bt-notes" className="text-xs text-muted-foreground">
                Notes (optional)
              </Label>
              <Input
                id="bt-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="h-9 bg-background/40"
                placeholder="What confirmed the setup?"
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Playbook rules checklist
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  compliance >= 75
                    ? "bg-emerald-500/15 text-emerald-400"
                    : compliance >= 50
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {compliance}% rules hit
              </span>
            </div>

            {ruleState.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/40 px-3 py-4 text-xs text-muted-foreground">
                Add rules in Playbook Rules first — then mark which ones fired on this backtest.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/30 p-2">
                {ruleState.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleRule(item.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        item.checked ? "bg-primary/10 text-foreground" : "hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          item.checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/60",
                        )}
                      >
                        {item.checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="leading-snug">{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            type="button"
            className="mt-5 w-full gap-1.5"
            disabled={!pair.trim() || result.trim() === "" || !Number.isFinite(Number(result)) || saving}
            onClick={() => void handleLogBacktest()}
          >
            <Plus className="h-4 w-4" />
            {saving ? "Logging…" : "Log backtest trade"}
          </Button>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/70 p-5">
          <h3 className="mb-4 text-sm font-semibold">Backtest results</h3>

          {backtestTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center text-muted-foreground">
              <Activity className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">No backtests for this playbook yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Log historical setups against these rules to measure edge before going live.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-1 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Date / Symbol</span>
                <span>Direction</span>
                <span className="text-right">P&L</span>
              </div>
              {backtestTrades
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((trade) => {
                  const net = getTradeNetResult(trade);
                  return (
                    <div
                      key={trade.id}
                      className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-1 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <SymbolMark symbol={trade.pair} size="sm" />
                        </p>
                        <p className="text-[11px] text-muted-foreground">{trade.date}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {trade.direction === "Short" ? (
                          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {trade.direction || "Long"}
                      </div>
                      <div
                        className={cn(
                          "text-right font-mono text-sm font-semibold",
                          net >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
        <div className="rounded-2xl border border-border/40 bg-card/90 px-10 py-8 text-center shadow-lg">
          <FlaskConical className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="text-xl font-semibold tracking-tight text-foreground">Coming soon</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Playbook backtesting is on the way.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
