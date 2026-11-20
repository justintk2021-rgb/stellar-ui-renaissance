import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { journalTradeStats } from "@/lib/tradeFormat";

type MatrixTrade = {
  id: string;
  session?: string | null;
  marketType?: string | null;
  result: number;
  swap?: number | null;
  commission?: number | null;
};

type Cell = { winRate: number; count: number };

function cellStats(trades: MatrixTrade[]): Cell | null {
  if (trades.length === 0) return null;
  const stats = journalTradeStats(trades);
  return { winRate: stats.winRate, count: stats.total };
}

function formatCell(cell: Cell | null): string {
  if (!cell) return "—";
  return `${cell.winRate.toFixed(0)}% · ${cell.count}`;
}

export function PlaybookSessionMatrix({ trades }: { trades: MatrixTrade[] }) {
  const { rows, maxAbsNet } = useMemo(() => {
    const sessionCounts = new Map<string, number>();
    for (const trade of trades) {
      const session = trade.session?.trim() || "Untagged session";
      sessionCounts.set(session, (sessionCounts.get(session) || 0) + 1);
    }

    const sorted = [...sessionCounts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4).map(([name]) => name);
    const otherSessions = new Set(sorted.slice(4).map(([name]) => name));
    const rowNames = [...top];
    if (otherSessions.size > 0) rowNames.push("Other");

    const built = rowNames.map((name) => {
      const rowTrades =
        name === "Other"
          ? trades.filter((t) => otherSessions.has(t.session?.trim() || "Untagged session"))
          : trades.filter((t) => (t.session?.trim() || "Untagged session") === name);

      const trending = rowTrades.filter((t) => t.marketType === "trending");
      const ranging = rowTrades.filter((t) => t.marketType === "ranging");
      const untagged = rowTrades.filter((t) => t.marketType !== "trending" && t.marketType !== "ranging");
      const net = journalTradeStats(rowTrades).netPnL;

      return {
        name,
        trending: cellStats(trending),
        ranging: cellStats(ranging),
        untagged: cellStats(untagged),
        net,
      };
    });

    const maxAbs = Math.max(1, ...built.map((row) => Math.abs(row.net)));
    return { rows: built, maxAbsNet: maxAbs };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="glass rounded-xl border border-border/30 p-5">
        <h3 className="text-sm font-semibold">Session × market</h3>
        <p className="text-sm text-muted-foreground mt-2">No live trades yet.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl border border-border/30 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Session × market</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Win rate and trade count by session and market type
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/20">
              <th className="text-left font-medium px-3 py-2">Session</th>
              <th className="text-right font-medium px-3 py-2">Trending</th>
              <th className="text-right font-medium px-3 py-2">Ranging</th>
              <th className="text-right font-medium px-3 py-2">Untagged</th>
              <th className="text-left font-medium px-3 py-2 min-w-[8rem]">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.map((row) => (
              <tr key={row.name}>
                <td className="px-3 py-2.5 font-medium">{row.name}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatCell(row.trending)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatCell(row.ranging)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatCell(row.untagged)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.net >= 0 ? "bg-primary" : "bg-destructive",
                        )}
                        style={{ width: `${(Math.abs(row.net) / maxAbsNet) * 100}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums w-16 text-right",
                        row.net >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {row.net >= 0 ? "+" : "-"}${Math.abs(row.net).toFixed(0)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
