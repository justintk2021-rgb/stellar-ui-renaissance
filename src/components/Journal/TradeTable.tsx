import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TradeTableProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onSelectForNotebook: (id: string) => void;
  onClearAll?: () => void;
}

export function TradeTable({ trades, onEdit, onDelete, onSelectForNotebook, onClearAll }: TradeTableProps) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Trade Log</h3>
          <p className="text-xs text-muted-foreground mt-1">Click a row to view notes</p>
        </div>
        <div className="flex items-center gap-2">
          {trades.length > 0 && onClearAll && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                  Clear All
                </Button>
              }
              title="Delete All Trades"
              description="This will permanently delete all your trades. This action cannot be undone."
              confirmLabel="Delete All"
              variant="destructive"
              onConfirm={onClearAll}
            />
          )}
          <Badge variant="outline" className="border-secondary/40 text-muted-foreground text-xs">
            History
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-secondary/30 overflow-hidden bg-card">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[80px_100px_70px_90px_1fr_80px] gap-2 px-4 py-3 bg-muted/30 border-b border-secondary/30">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pair</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Side</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P/L</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</div>
        </div>

        {/* Body */}
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
          {trades.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No trades yet. Add one using the form.
            </div>
          ) : (
            trades.map((trade, index) => {
              const pl = trade.result || 0;
              const isProfit = pl >= 0;

              return (
                <div
                  key={trade.id}
                  onClick={() => onSelectForNotebook(trade.id)}
                  className={cn(
                    "grid grid-cols-2 md:grid-cols-[80px_100px_70px_90px_1fr_80px] gap-2 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-border/20",
                    index % 2 === 0 ? "bg-card/50" : "bg-muted/10",
                    "hover:bg-primary/5"
                  )}
                >
                  <div className="text-sm">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Date</span>
                    {trade.date || '-'}
                  </div>
                  <div className="text-sm font-medium">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Pair</span>
                    {trade.pair || '-'}
                  </div>
                  <div className="text-sm">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Side</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0",
                        trade.direction === 'Long'
                          ? "border-primary/50 text-primary"
                          : "border-destructive/50 text-destructive"
                      )}
                    >
                      {trade.direction}
                    </Badge>
                  </div>
                  <div className={cn(
                    "text-sm font-bold font-mono",
                    isProfit ? "text-primary" : "text-destructive"
                  )}>
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">P/L</span>
                    {isProfit ? '+' : ''}{pl.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground truncate col-span-2 md:col-span-1">
                    <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Notes</span>
                    {trade.notes || <span className="italic text-muted-foreground/50">No notes</span>}
                  </div>
                  <div className="flex justify-end gap-1 col-span-2 md:col-span-1 mt-2 md:mt-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onEdit(trade); }}
                      className="w-7 h-7 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-full border-border/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      }
                      title="Delete Trade"
                      description="Are you sure you want to delete this trade? This action cannot be undone."
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => onDelete(trade.id)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
