import type { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { formatPnL, getTradeNetResult } from "@/lib/tradeFormat";
import { formatStudyTradeWhen } from "@/lib/studyArea";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { BookMarked } from "lucide-react";
import type { StudyPlaybook } from "./studyEditorData";

export function StudyTradeCard({
  tradeId,
  trades,
  playbooks,
  active = false,
  onSelect,
}: {
  tradeId: string;
  trades: Trade[];
  playbooks: StudyPlaybook[];
  active?: boolean;
  onSelect?: () => void;
}) {
  const trade = trades.find((item) => item.id === tradeId);
  if (!trade) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        Trade removed
      </div>
    );
  }
  const pnl = getTradeNetResult(trade);
  const when = formatStudyTradeWhen(trade);
  const playbook = trade.checklistId
    ? playbooks.find((item) => item.id === trade.checklistId)?.name || "Playbook removed"
    : "No playbook";
  const body = (
    <>
      <AssetIcon symbol={trade.pair} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{trade.pair}</span>
          <span className={cn("font-mono text-xs font-bold tabular-nums", pnl >= 0 ? "text-primary" : "text-destructive")}>
            {formatPnL(pnl)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{when.date}</span>
          <span>{when.time}</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <BookMarked className="h-3 w-3 shrink-0" />
            <span className="truncate">{playbook}</span>
          </span>
        </div>
      </div>
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left",
          active ? "border-primary/50 bg-primary/10" : "border-transparent bg-background/70 hover:border-border hover:bg-muted/40",
        )}
      >
        {body}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 px-3 py-2.5">
      {body}
    </div>
  );
}
