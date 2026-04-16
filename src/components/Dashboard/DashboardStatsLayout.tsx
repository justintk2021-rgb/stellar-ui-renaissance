import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { TrendingUp, TrendingDown, DollarSign, Scale, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { StatCard } from "./StatCard";
import { PnLCalendar } from "./PnLCalendar";
import { WinRatioCard } from "./WinRatioCard";
import { RecentTrades } from "./RecentTrades";
import { NotebookEntry } from "@/types/trade";

interface DashboardStatsLayoutProps {
  trades: Trade[];
  notebookEntries: NotebookEntry[];
  onUpdateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  onSaveEntry: (entry: NotebookEntry) => void;
  onAddTrade: (trade: Omit<Trade, "id">) => void;
}

export function DashboardStatsLayout({
  trades,
  notebookEntries,
  onUpdateTrade,
  onSaveEntry,
  onAddTrade,
}: DashboardStatsLayoutProps) {
  const [openPositions, setOpenPositions] = useState<{ count: number; floatingPl: number }>({
    count: 0,
    floatingPl: 0,
  });
  const [activeBrokerConnId, setActiveBrokerConnId] = useState<string | null>(
    localStorage.getItem("activeBrokerConnectionId")
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStorage.getItem("activeBrokerConnectionId");
      setActiveBrokerConnId((prev) => (prev !== current ? current : prev));
    }, 1000);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "activeBrokerConnectionId") setActiveBrokerConnId(e.newValue);
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const fetchOpenPositions = async () => {
      if (!activeBrokerConnId) {
        setOpenPositions({ count: 0, floatingPl: 0 });
        return;
      }
      const { data: positions } = await supabase
        .from("broker_positions")
        .select("floating_pl")
        .eq("broker_connection_id", activeBrokerConnId)
        .is("closed_at", null);
      if (positions) {
        setOpenPositions({
          count: positions.length,
          floatingPl: positions.reduce((sum, p) => sum + Number(p.floating_pl || 0), 0),
        });
      } else {
        setOpenPositions({ count: 0, floatingPl: 0 });
      }
    };
    fetchOpenPositions();
    const channel = supabase
      .channel(`dash-stats-positions-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "broker_positions" }, () =>
        fetchOpenPositions()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [trades, activeBrokerConnId]);

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

  const avgWin = stats.wins > 0 ? stats.totalWinAmount / stats.wins : 0;
  const avgLoss = stats.losses > 0 ? stats.totalLossAmount / stats.losses : 0;
  const profitFactor =
    stats.totalLossAmount > 0
      ? stats.totalWinAmount / stats.totalLossAmount
      : stats.totalWinAmount > 0
      ? Infinity
      : 0;

  const leftCards = [
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
      label: "Open Trades",
      value: openPositions.floatingPl,
      prefix: "$",
      decimals: 2,
      tooltip: "Currently open broker positions and their floating P&L",
      icon: Activity,
      isPositive: openPositions.floatingPl >= 0,
      showTrend: true,
      colorClass: openPositions.floatingPl >= 0 ? "text-primary" : "text-destructive",
      bgClass: openPositions.floatingPl >= 0 ? "bg-primary/10" : "bg-destructive/10",
      extra: `${openPositions.count} position${openPositions.count !== 1 ? "s" : ""} open`,
    },
    {
      label: "Profit Factor",
      value: profitFactor === Infinity ? 999 : profitFactor,
      decimals: 2,
      tooltip: "Ratio of gross profit to gross loss. Above 1.5 is considered good.",
      icon: Scale,
      isPositive: profitFactor >= 1,
      displayInfinity: profitFactor === Infinity,
      colorClass: profitFactor >= 1 ? "text-primary" : "text-destructive",
      bgClass: profitFactor >= 1 ? "bg-primary/10" : "bg-destructive/10",
    },
  ];

  const rightCards = [
    {
      label: "Avg Winning Trade",
      value: avgWin,
      prefix: "$",
      decimals: 2,
      tooltip: "Average profit per winning trade",
      icon: TrendingUp,
      isPositive: true,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
      highlight: true,
      highlightColor: "primary" as const,
    },
    {
      label: "Avg Losing Trade",
      value: avgLoss,
      prefix: "-$",
      decimals: 2,
      tooltip: "Average loss per losing trade",
      icon: TrendingDown,
      isPositive: false,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
      highlight: true,
      highlightColor: "destructive" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 3-column layout: stats | calendar | stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left column */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {leftCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))}
        </div>

        {/* Center column - Calendar */}
        <div className="lg:col-span-7">
          <PnLCalendar
            trades={trades}
            onUpdateTrade={onUpdateTrade}
            notebookEntries={notebookEntries}
            onSaveEntry={onSaveEntry}
            onAddTrade={onAddTrade}
          />
        </div>

        {/* Right column - smaller */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {rightCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))}
        </div>
      </div>

      {/* Win ratio + Recent trades below */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5 bg-card/40 backdrop-blur-xl border border-border/30 shadow-xl flex flex-col min-h-[280px]"
        >
          <WinRatioCard trades={trades} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3"
        >
          <RecentTrades trades={trades} />
        </motion.div>
      </div>
    </div>
  );
}
