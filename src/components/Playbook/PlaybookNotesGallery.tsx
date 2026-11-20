import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Filter,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/trade";
import { dedupeTradesForPnL, getTradeNetResult } from "@/lib/tradeFormat";
import { supabase } from "@/integrations/supabase/client";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NotesViewMode = "live" | "gallery";

type BrokerAccountCard = {
  key: string;
  kind: "broker";
  externalId: string;
  name: string;
  badge: string;
  balance: number;
  currency: string;
};

type ManualAccountCard = {
  key: string;
  kind: "manual";
  id: string;
  name: string;
  badge: string;
  startingBalance: number;
  targetBalance: number | null;
};

type AccountCard = ManualAccountCard | BrokerAccountCard;

function formatCardDate(date: string) {
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function outcomeLabel(net: number) {
  if (net > 0) return { label: "Win", className: "bg-emerald-500/15 text-emerald-400" };
  if (net < 0) return { label: "Loss", className: "bg-rose-500/15 text-rose-400" };
  return { label: "Breakeven", className: "bg-amber-500/15 text-amber-400" };
}

function badgeClass(badge: string) {
  if (/broker|live|demo/i.test(badge)) return "bg-emerald-500/15 text-emerald-400";
  if (/fund|prop/i.test(badge)) return "bg-pink-500/15 text-pink-400";
  if (/learn/i.test(badge)) return "bg-sky-500/15 text-sky-400";
  if (/backtest/i.test(badge)) return "bg-violet-500/15 text-violet-400";
  if (/manual/i.test(badge)) return "bg-primary/15 text-primary";
  return "bg-muted/70 text-foreground/80";
}

function inferManualBadge(name: string) {
  if (/fund|prop/i.test(name)) return "Funded";
  if (/learn/i.test(name)) return "Learning";
  if (/backtest/i.test(name)) return "Backtesting";
  return "Manual";
}

export function PlaybookNotesGallery({
  checklistId,
  checklistName,
  trades,
  userId,
  liveContent,
  onNewNote,
}: {
  checklistId: string;
  checklistName: string;
  trades: Trade[];
  userId?: string;
  liveContent: ReactNode;
  onNewNote?: () => void;
}) {
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userId);
  const { accounts, isLoading: accountsLoading } = useTradingAccounts(resolvedUserId);

  const [brokerCards, setBrokerCards] = useState<BrokerAccountCard[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<NotesViewMode>("gallery");
  const [query, setQuery] = useState("");
  const [chartById, setChartById] = useState<Record<string, string>>({});
  const [accountStats, setAccountStats] = useState<
    Record<string, { balance: number; winRate: number; target: number | null }>
  >({});

  useEffect(() => {
    setResolvedUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (resolvedUserId) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setResolvedUserId(data.user?.id);
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

  const fetchBrokerAccounts = useCallback(async () => {
    if (!resolvedUserId) {
      setBrokerCards([]);
      return;
    }

    const { data: connections } = await supabase
      .from("broker_connections")
      .select(
        "id, platform, broker_name, environment, connection_status, account_balance, account_currency",
      )
      .eq("user_id", resolvedUserId)
      .neq("connection_status", "disconnected");

    const visible = (connections || []).filter(
      (conn) =>
        conn.connection_status === "connected" ||
        conn.connection_status === "expired" ||
        (conn.platform === "mt5" &&
          (conn.connection_status === "connecting" || conn.connection_status === "pending")),
    );

    const cards: BrokerAccountCard[] = [];
    for (const conn of visible) {
      const { data: accs } = await supabase
        .from("broker_accounts")
        .select("account_id_external, acc_num, account_name, is_active")
        .eq("broker_connection_id", conn.id);

      for (const acc of accs || []) {
        const label = acc.account_name || `${conn.broker_name || "Broker"} ${acc.acc_num}`;
        cards.push({
          key: `broker:${acc.account_id_external}`,
          kind: "broker",
          externalId: acc.account_id_external,
          name: label,
          badge: conn.environment === "live" ? "Live" : "Demo",
          balance: acc.is_active && conn.account_balance != null ? Number(conn.account_balance) : 0,
          currency: conn.account_currency || "USD",
        });
      }
    }
    setBrokerCards(cards);
  }, [resolvedUserId]);

  useEffect(() => {
    void fetchBrokerAccounts();
  }, [fetchBrokerAccounts]);

  const manualCards: ManualAccountCard[] = useMemo(
    () =>
      accounts.map((account) => ({
        key: `manual:${account.id}`,
        kind: "manual" as const,
        id: account.id,
        name: account.name,
        badge: inferManualBadge(account.name),
        startingBalance: account.starting_balance,
        targetBalance: account.goal_balance ?? account.profit_target,
      })),
    [accounts],
  );

  const accountCards: AccountCard[] = useMemo(
    () => [...manualCards, ...brokerCards],
    [manualCards, brokerCards],
  );

  useEffect(() => {
    if (!selectedKey && accountCards.length) {
      setSelectedKey(accountCards[0].key);
    } else if (selectedKey && accountCards.length && !accountCards.some((c) => c.key === selectedKey)) {
      setSelectedKey(accountCards[0]?.key ?? null);
    }
  }, [accountCards, selectedKey]);

  // Balance + win rate from site trades per account (not only this playbook).
  useEffect(() => {
    if (!resolvedUserId || accountCards.length === 0) {
      setAccountStats({});
      return;
    }
    let cancelled = false;

    void (async () => {
      const next: Record<string, { balance: number; winRate: number; target: number | null }> = {};

      for (const card of accountCards) {
        if (card.kind === "broker") {
          next[card.key] = {
            balance: card.balance,
            winRate: 0,
            target: null,
          };
          const { data: rows } = await supabase
            .from("trades")
            .select("id, result, swap, commission, imported_from_broker, broker_position_id, last_broker_sync_at")
            .eq("user_id", resolvedUserId)
            .eq("broker_account_id", card.externalId);
          const nets = (rows || []).map((row) =>
            getTradeNetResult({
              id: String(row.id),
              result: Number(row.result) || 0,
              swap: row.swap != null ? Number(row.swap) : 0,
              commission: row.commission != null ? Number(row.commission) : 0,
              importedFromBroker: Boolean(row.imported_from_broker),
              brokerPositionId: (row.broker_position_id as string | null) ?? null,
              lastBrokerSyncAt: (row.last_broker_sync_at as string | null) ?? null,
            }),
          );
          const wins = nets.filter((n) => n > 0).length;
          next[card.key] = {
            balance: card.balance,
            winRate: nets.length ? (wins / nets.length) * 100 : 0,
            target: null,
          };
          continue;
        }

        const { data: rows } = await supabase
          .from("trades")
          .select("id, result, swap, commission, imported_from_broker, broker_position_id, last_broker_sync_at")
          .eq("user_id", resolvedUserId)
          .eq("account_id", card.id);
        const nets = (rows || []).map((row) =>
          getTradeNetResult({
            id: String(row.id),
            result: Number(row.result) || 0,
            swap: row.swap != null ? Number(row.swap) : 0,
            commission: row.commission != null ? Number(row.commission) : 0,
            importedFromBroker: Boolean(row.imported_from_broker),
            brokerPositionId: (row.broker_position_id as string | null) ?? null,
            lastBrokerSyncAt: (row.last_broker_sync_at as string | null) ?? null,
          }),
        );
        const pnl = nets.reduce((sum, n) => sum + n, 0);
        const wins = nets.filter((n) => n > 0).length;
        next[card.key] = {
          balance: card.startingBalance + pnl,
          winRate: nets.length ? (wins / nets.length) * 100 : 0,
          target: card.targetBalance,
        };
      }

      if (!cancelled) setAccountStats(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountCards, resolvedUserId]);

  const playbookTrades = useMemo(() => dedupeTradesForPnL(trades), [trades]);

  const selectedCard = accountCards.find((card) => card.key === selectedKey) ?? null;

  const galleryTrades = useMemo(() => {
    const q = query.trim().toLowerCase();
    return playbookTrades.filter((trade) => {
      if (selectedCard?.kind === "manual" && trade.accountId && trade.accountId !== selectedCard.id) {
        return false;
      }
      if (
        selectedCard?.kind === "broker" &&
        trade.brokerAccountId &&
        trade.brokerAccountId !== selectedCard.externalId
      ) {
        return false;
      }
      if (!q) return true;
      return `${trade.pair} ${trade.direction} ${trade.notes || ""}`.toLowerCase().includes(q);
    });
  }, [playbookTrades, query, selectedCard]);

  useEffect(() => {
    if (viewMode !== "gallery" || !resolvedUserId || galleryTrades.length === 0) return;
    let cancelled = false;
    const ids = galleryTrades.slice(0, 40).map((t) => t.id);

    void (async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("id, chart_image")
        .eq("user_id", resolvedUserId)
        .in("id", ids);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      for (const row of data) {
        const id = row.id as string;
        const image = row.chart_image as string | null;
        if (id && image) next[id] = image;
      }
      setChartById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [viewMode, resolvedUserId, galleryTrades]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {accountsLoading && accountCards.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-border/40 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
            Loading accounts…
          </div>
        ) : null}

        {!accountsLoading && accountCards.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-border/40 px-4 py-10 text-center text-sm text-muted-foreground">
            No trading accounts connected. Connect or create an account elsewhere on the site to see it here.
          </div>
        ) : null}

        {accountCards.map((card) => {
          const selected = card.key === selectedKey;
          const stats = accountStats[card.key];
          const balance = stats?.balance ?? (card.kind === "broker" ? card.balance : card.startingBalance);
          const winRate = stats?.winRate ?? 0;
          const target = stats?.target ?? (card.kind === "manual" ? card.targetBalance : null);
          const progress =
            target && target > 0 ? Math.max(0, Math.min(100, (balance / target) * 100)) : 0;
          // 12-segment bar: any progress > 0 lights ≥1 tick (e.g. $73/$1k ≈7% used to round to empty).
          const filledSegments =
            progress <= 0 ? 0 : Math.min(12, Math.max(1, Math.ceil((progress / 100) * 12)));

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setSelectedKey(card.key)}
              className={cn(
                "rounded-2xl border bg-card/80 p-4 text-left shadow-sm transition-all",
                selected
                  ? "border-primary/50 ring-1 ring-primary/30"
                  : "border-border/40 hover:border-border/70 hover:bg-card",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", badgeClass(card.badge))}>
                  {card.badge}
                </span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Current:{" "}
                  <span className="font-mono font-medium text-foreground">
                    ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </p>
                <p>
                  Win rate:{" "}
                  <span className="font-mono font-medium text-foreground">{winRate.toFixed(0)}%</span>
                </p>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-mono">
                    ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {target ? ` / $${target.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}
                  </span>
                </div>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted/50">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-full flex-1 rounded-[2px]",
                        index < filledSegments ? "bg-primary" : "bg-transparent",
                      )}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 border-b border-border/30">
          {(
            [
              { id: "live" as const, label: "Live Trades", icon: List },
              { id: "gallery" as const, label: "Trades Gallery", icon: LayoutGrid },
            ] as const
          ).map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" /> : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "gallery" ? (
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search gallery"
                className="h-9 w-48 bg-background/40 pl-8"
              />
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Filter">
            <Filter className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Sort">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => {
              setViewMode("live");
              onNewNote?.();
            }}
            className="h-9 gap-1.5 rounded-xl px-3"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {viewMode === "live" ? (
        liveContent
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {galleryTrades.map((trade) => {
            const net = getTradeNetResult(trade);
            const outcome = outcomeLabel(net);
            const chart = chartById[trade.id];
            const title = (trade.notes || "").trim().split("\n")[0]?.slice(0, 48) || trade.pair;

            return (
              <div
                key={trade.id}
                className="overflow-hidden rounded-2xl border border-border/40 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border/70 hover:shadow-md"
              >
                <div className="aspect-[16/10] bg-muted/40">
                  {chart ? (
                    <img src={chart} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 px-4 text-center">
                      <p className="text-xs text-white/50">
                        {trade.pair} · {trade.direction}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5 p-3.5">
                  <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{formatCardDate(trade.date)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                      {trade.pair}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                        trade.direction === "Long"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400",
                      )}
                    >
                      {trade.direction}
                    </span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", outcome.className)}>
                      {outcome.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{selectedCard?.name || checklistName}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {trade.notes?.trim() ? 1 : 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {galleryTrades.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border/40 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">No gallery items for this account yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Link playbook trades to this account, or switch to Live Trades to write notes.
              </p>
              <Button type="button" className="mt-4" onClick={() => setViewMode("live")}>
                Open Live Trades / notes
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
