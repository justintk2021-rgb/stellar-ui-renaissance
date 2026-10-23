import type { ReactNode } from "react";
import { formatMoney, formatPrice, type HistoryTrade, type PendingOrder, type Position } from "@/lib/chartTrading/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ChartBottomPanelProps {
  positions: Position[];
  orders: PendingOrder[];
  history: HistoryTrade[];
  onClose: (id: string) => void;
}

export function ChartBottomPanel({ positions, orders, history, onClose }: ChartBottomPanelProps) {
  return (
    <div className="liquid-glass min-h-[9.5rem] rounded-2xl px-3 py-2">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="h-8 bg-foreground/5">
          <TabsTrigger value="positions" className="h-7 text-xs">
            Positions ({positions.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="h-7 text-xs">
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="h-7 text-xs">
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-2 overflow-x-auto">
          <Table
            empty="No open positions"
            rows={positions.map((p) => [
              p.symbol,
              p.side.toUpperCase(),
              p.lots.toFixed(2),
              formatPrice(p.entryPrice, p.symbol),
              formatPrice(p.currentPrice, p.symbol),
              p.stopLoss == null ? "—" : formatPrice(p.stopLoss, p.symbol),
              p.takeProfit == null ? "—" : formatPrice(p.takeProfit, p.symbol),
              <PnL key={p.id} value={p.pnl} />,
              <Button
                key={`${p.id}-x`}
                size="sm"
                variant="ghost"
                disabled
                title="Live trading coming soon"
                className="h-7 px-2 text-xs"
                onClick={() => onClose(p.id)}
              >
                Close
              </Button>,
            ])}
            headers={["Symbol", "Side", "Lots", "Entry", "Mark", "SL", "TP", "P&L", ""]}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-2 overflow-x-auto">
          <Table
            empty="No pending orders"
            rows={orders.map((o) => [
              o.symbol,
              o.side.toUpperCase(),
              o.type,
              o.lots.toFixed(2),
              formatPrice(o.entryPrice, o.symbol),
              o.stopLoss == null ? "—" : formatPrice(o.stopLoss, o.symbol),
              o.takeProfit == null ? "—" : formatPrice(o.takeProfit, o.symbol),
            ])}
            headers={["Symbol", "Side", "Type", "Lots", "Entry", "SL", "TP"]}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-2 overflow-x-auto">
          <Table
            empty="No trade history"
            rows={history.map((h) => [
              h.symbol,
              h.side.toUpperCase(),
              h.lots.toFixed(2),
              formatPrice(h.entryPrice, h.symbol),
              formatPrice(h.exitPrice, h.symbol),
              <PnL key={h.id} value={h.pnl} />,
            ])}
            headers={["Symbol", "Side", "Lots", "Entry", "Exit", "P&L"]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PnL({ value }: { value: number }) {
  return (
    <span className={cn("font-semibold", value >= 0 ? "text-emerald-500" : "text-red-500")}>
      {formatMoney(value)}
    </span>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="px-1 py-4 text-center text-xs text-muted-foreground">{empty}</p>;
  }

  return (
    <table className="w-full min-w-[640px] text-left text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {headers.map((header) => (
            <th key={header || "action"} className="px-2 pb-1 font-medium">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-foreground/5">
            {row.map((cell, j) => (
              <td key={j} className="px-2 py-1.5 font-medium">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
