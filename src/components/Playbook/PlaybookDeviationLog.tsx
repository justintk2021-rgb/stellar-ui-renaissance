import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getTradeNetResult } from "@/lib/tradeFormat";
import { SymbolMark } from "@/components/ui/AssetIcon";
import type { Checklist } from "@/lib/playbookChecklist";
import { tradeIsDeviation } from "./PlaybookConfluenceScore";
import type { ChecklistItemState } from "@/types/trade";

type DeviationTrade = {
  id: string;
  date: string;
  pair: string;
  direction?: "Long" | "Short";
  result: number;
  checklist_id?: string | null;
  checklistState?: ChecklistItemState[] | null;
  swap?: number | null;
  commission?: number | null;
};

export function PlaybookDeviationLog({
  checklist,
  linkedTrades,
  unlinkedTrades,
}: {
  checklist: Checklist;
  linkedTrades: DeviationTrade[];
  unlinkedTrades: DeviationTrade[];
}) {
  const rows = useMemo(() => {
    const linkedDeviations = linkedTrades
      .map((trade) => {
        const info = tradeIsDeviation(checklist, trade);
        return info.isDeviation ? { trade, ruleBroken: info.ruleBroken } : null;
      })
      .filter(Boolean) as { trade: DeviationTrade; ruleBroken: string }[];

    const unlinked = unlinkedTrades.map((trade) => ({
      trade,
      ruleBroken: "No playbook assigned",
    }));

    return [...linkedDeviations, ...unlinked].sort(
      (a, b) => new Date(b.trade.date).getTime() - new Date(a.trade.date).getTime(),
    );
  }, [checklist, linkedTrades, unlinkedTrades]);

  const cost = useMemo(() => {
    return rows.reduce((sum, row) => {
      const net = getTradeNetResult(row.trade);
      return net < 0 ? sum + net : sum;
    }, 0);
  }, [rows]);

  return (
    <div className="glass rounded-xl border border-border/30 p-5 space-y-4 mt-6">
      <div>
        <h3 className="text-sm font-semibold">Deviation log</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Off-plan trades: missing playbook or unchecked confluences
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No off-plan trades.</p>
      ) : (
        <>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            Off-plan trades cost{" "}
            <span className="font-semibold font-mono text-destructive">
              ${Math.abs(cost).toFixed(2)}
            </span>
          </div>
          <div className="divide-y divide-border/20 border border-border/30 rounded-lg overflow-hidden">
            <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
              <div>Date</div>
              <div>Pair</div>
              <div>Direction</div>
              <div>Rule broken</div>
              <div className="text-right">Net</div>
            </div>
            {rows.map(({ trade, ruleBroken }) => {
              const net = getTradeNetResult(trade);
              return (
                <div
                  key={trade.id}
                  className="grid grid-cols-5 gap-2 px-3 py-2.5 text-sm items-center"
                >
                  <div className="text-muted-foreground">{trade.date}</div>
                  <div>
                    <SymbolMark symbol={trade.pair} size="sm" />
                  </div>
                  <div>{trade.direction || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate" title={ruleBroken}>
                    {ruleBroken}
                  </div>
                  <div
                    className={cn(
                      "text-right font-mono font-semibold",
                      net >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
