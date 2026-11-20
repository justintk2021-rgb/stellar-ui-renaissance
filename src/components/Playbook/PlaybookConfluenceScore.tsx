import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { journalTradeStats } from "@/lib/tradeFormat";
import { scoreTradeConfluence, type Checklist } from "@/lib/playbookChecklist";
import type { ChecklistItemState } from "@/types/trade";

type ScoreTrade = {
  id: string;
  checklistState?: ChecklistItemState[] | null;
  result: number;
  swap?: number | null;
  commission?: number | null;
};

export function PlaybookConfluenceScore({
  checklist,
  trades,
}: {
  checklist: Checklist;
  trades: ScoreTrade[];
}) {
  const { avgLabel, buckets, hasScored } = useMemo(() => {
    const scored: { trade: ScoreTrade; checked: number; total: number }[] = [];
    for (const trade of trades) {
      const score = scoreTradeConfluence(checklist, trade.checklistState);
      if (!score) continue;
      scored.push({ trade, checked: score.checked, total: score.total });
    }

    if (scored.length === 0) {
      return {
        avgLabel: "—",
        hasScored: false,
        buckets: [
          { label: "Full score", trades: [] as ScoreTrade[] },
          { label: "4/5", trades: [] as ScoreTrade[] },
          { label: "3/5 or fewer", trades: [] as ScoreTrade[] },
        ],
      };
    }

    const avg =
      scored.reduce((sum, row) => sum + row.checked, 0) / scored.length;
    const total = scored[0]?.total ?? 0;
    const full = scored.filter((row) => row.checked === row.total).map((row) => row.trade);
    const four = scored
      .filter((row) => row.total > 0 && row.checked === row.total - 1)
      .map((row) => row.trade);
    const threeOrFewer = scored
      .filter((row) => row.checked <= row.total - 2)
      .map((row) => row.trade);

    return {
      avgLabel: `${avg.toFixed(1)} / ${total}`,
      hasScored: true,
      buckets: [
        { label: total > 0 ? `Full score (${total}/${total})` : "Full score", trades: full },
        { label: total >= 5 ? "4/5" : `${Math.max(total - 1, 0)}/${total}`, trades: four },
        { label: "3/5 or fewer", trades: threeOrFewer },
      ],
    };
  }, [checklist, trades]);

  return (
    <div className="glass rounded-xl border border-border/30 p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Confluence score</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Average confluence ticks on scored trades
          </p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/5">
          <span className="text-sm font-bold font-mono tabular-nums">{avgLabel}</span>
        </div>
      </div>

      {!hasScored ? (
        <p className="text-sm text-muted-foreground">
          Tick confluences on your trades to see scores
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {buckets.map((bucket) => {
            const stats = journalTradeStats(bucket.trades);
            return (
              <div
                key={bucket.label}
                className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5"
              >
                <div className="text-xs font-medium text-muted-foreground mb-1.5">
                  {bucket.label}
                </div>
                <div className="text-sm font-mono tabular-nums">
                  {stats.total} trades · {stats.winRate.toFixed(0)}% WR
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold font-mono tabular-nums mt-0.5",
                    stats.netPnL >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {stats.netPnL >= 0 ? "+" : "-"}$
                  {Math.abs(stats.netPnL).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function formatConfluenceChip(
  checklist: Checklist,
  checklistState?: ChecklistItemState[] | null,
): string {
  const score = scoreTradeConfluence(checklist, checklistState);
  if (!score) return "—";
  return `${score.checked}/${score.total}`;
}

export function tradeIsDeviation(
  checklist: Checklist,
  trade: { checklist_id?: string | null; checklistState?: ChecklistItemState[] | null },
): { isDeviation: boolean; ruleBroken: string } {
  if (!trade.checklist_id) {
    return { isDeviation: true, ruleBroken: "No playbook assigned" };
  }
  const confluences = checklist.items.filter((item) => item.isConfluence);
  if (confluences.length === 0 || !trade.checklistState) {
    return { isDeviation: false, ruleBroken: "" };
  }
  const byId = new Map(trade.checklistState.map((entry) => [entry.id, entry]));
  const unchecked = confluences.filter((item) => !byId.get(item.id)?.checked);
  if (unchecked.length === 0) return { isDeviation: false, ruleBroken: "" };
  const texts = unchecked.map((item) => item.text);
  const shown = texts.slice(0, 2);
  const extra = texts.length - shown.length;
  const ruleBroken =
    extra > 0 ? `${shown.join("; ")} +${extra} more` : shown.join("; ");
  return { isDeviation: true, ruleBroken };
}
