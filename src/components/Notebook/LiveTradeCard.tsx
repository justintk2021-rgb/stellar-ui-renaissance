import { memo } from "react";
import type { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { formatPnL, getTradeNetResult } from "@/lib/tradeFormat";
import { formatStudyTradeWhen } from "@/lib/studyNotes";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { BookMarked } from "lucide-react";

export interface PlaybookLookup {
  id: string;
  name: string;
}

interface LiveTradeCardProps {
  tradeId: string;
  trades: Trade[];
  playbooks?: PlaybookLookup[];
  variant?: "card" | "menu" | "row";
  active?: boolean;
  onSelect?: () => void;
}

export const LiveTradeCard = memo(function LiveTradeCard({
  tradeId,
  trades,
  playbooks = [],
  variant = "card",
  active = false,
  onSelect,
}: LiveTradeCardProps) {
  const trade = trades.find((item) => item.id === tradeId);
  const playbookName = trade?.checklistId
    ? playbooks.find((item) => item.id === trade.checklistId)?.name
    : undefined;

  if (!trade) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
          variant === "menu" && "px-3 py-2.5",
        )}
      >
        Trade no longer in the journal
      </div>
    );
  }

  const pnl = getTradeNetResult(trade);
  const profit = pnl >= 0;
  const { date, time } = formatStudyTradeWhen(trade);
  const playbookLabel = playbookName || "No playbook";

  const body = (
    <>
      <AssetIcon symbol={trade.pair} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{trade.pair}</span>
          <span
            className={cn(
              "shrink-0 font-mono text-xs font-bold tabular-nums",
              profit ? "text-primary" : "text-destructive",
            )}
          >
            {formatPnL(pnl)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{date}</span>
          <span>{time}</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <BookMarked className="h-3 w-3 shrink-0" />
            <span className="truncate">{playbookLabel}</span>
          </span>
        </div>
      </div>
    </>
  );

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
          active
            ? "border-primary/40 bg-primary/10"
            : "border-transparent bg-background/70 hover:border-border/60 hover:bg-muted/40",
        )}
      >
        {body}
      </button>
    );
  }

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
        {body}
      </div>
    );
  }

  return (
    <div className="study-trade-card my-3 flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 px-3.5 py-3 shadow-sm">
      {body}
    </div>
  );
});
