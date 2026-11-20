import { cn } from "@/lib/utils";
import type { ChecklistMetrics } from "./PlaybookRulesEditor";

function verdictFor(metrics: ChecklistMetrics): "Too few trades" | "Keep" | "Watch" | "Stop" {
  if (metrics.totalTrades < 5) return "Too few trades";
  if (!Number.isFinite(metrics.profitFactor)) return "Keep";
  if (metrics.profitFactor >= 1.5) return "Keep";
  if (metrics.profitFactor >= 1.0) return "Watch";
  return "Stop";
}

function formatAvgR(avgR: number | null): string {
  if (avgR == null || !Number.isFinite(avgR)) return "—";
  return avgR.toFixed(2);
}

function formatProfitFactor(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function PlaybookScorecard({ metrics }: { metrics: ChecklistMetrics[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="glass rounded-xl border border-border/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold">Setup scorecard</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real stats from your linked trades · R (vs avg loss)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/20">
              <th className="text-left font-medium px-4 py-2.5">Setup</th>
              <th className="text-right font-medium px-3 py-2.5">Trades</th>
              <th className="text-right font-medium px-3 py-2.5">Win rate</th>
              <th className="text-right font-medium px-3 py-2.5">R (vs avg loss)</th>
              <th className="text-right font-medium px-3 py-2.5">Profit factor</th>
              <th className="text-right font-medium px-3 py-2.5">Net P&amp;L</th>
              <th className="text-right font-medium px-4 py-2.5">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {metrics.map((row) => {
              const verdict = verdictFor(row);
              return (
                <tr key={row.checklistId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium truncate max-w-[14rem]">{row.checklistName}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.totalTrades}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.winRate.toFixed(0)}%</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatAvgR(row.avgR)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatProfitFactor(row.profitFactor)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono tabular-nums font-semibold",
                      row.totalPnL >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {row.totalPnL >= 0 ? "+" : "-"}$
                    {Math.abs(row.totalPnL).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        verdict === "Keep" && "bg-primary/15 text-primary",
                        verdict === "Watch" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        verdict === "Stop" && "bg-destructive/15 text-destructive",
                        verdict === "Too few trades" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {verdict}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
