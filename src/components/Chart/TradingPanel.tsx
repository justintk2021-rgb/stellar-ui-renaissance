import type { ReactNode } from "react";
import { formatMoney, formatPrice, riskPreview, type OrderSide, type OrderType } from "@/lib/chartTrading/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TradeTicket {
  side: OrderSide;
  type: OrderType;
  lots: number;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
}

interface TradingPanelProps {
  symbol: string;
  lastPrice: number | null;
  ticket: TradeTicket;
  onChange: (patch: Partial<TradeTicket>) => void;
  onSubmit: () => void;
}

export function TradingPanel({ symbol, lastPrice, ticket, onChange, onSubmit }: TradingPanelProps) {
  const needsEntry = ticket.type !== "market";
  const entry = needsEntry ? Number(ticket.entryPrice) : (lastPrice ?? Number(ticket.entryPrice));
  const sl = ticket.stopLoss === "" ? null : Number(ticket.stopLoss);
  const risk = riskPreview(entry, sl, ticket.lots, symbol);
  const buy = ticket.side === "buy";

  return (
    <div className="liquid-glass flex h-full flex-col gap-3 rounded-2xl p-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/5 p-1">
        {(["buy", "sell"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange({ side })}
            className={cn(
              "h-8 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              ticket.side === side
                ? side === "buy"
                  ? "bg-emerald-500 text-white"
                  : "bg-red-500 text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {side}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-foreground/5 p-1">
        {(["market", "limit", "stop"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange({ type })}
            className={cn(
              "h-8 rounded-lg text-[11px] font-semibold capitalize transition-colors",
              ticket.type === type ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {type}
          </button>
        ))}
      </div>

      <Field label="Lot size">
        <Input
          type="number"
          min={0.01}
          step={0.01}
          value={ticket.lots}
          onChange={(e) => onChange({ lots: Math.max(0.01, Number(e.target.value) || 0.01) })}
          className="h-9 bg-background/60"
        />
      </Field>

      {needsEntry && (
        <Field label="Entry price">
          <Input
            type="number"
            step="any"
            value={ticket.entryPrice}
            onChange={(e) => onChange({ entryPrice: e.target.value })}
            className="h-9 bg-background/60 font-mono"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Stop loss">
          <Input
            type="number"
            step="any"
            value={ticket.stopLoss}
            onChange={(e) => onChange({ stopLoss: e.target.value })}
            placeholder="—"
            className="h-9 bg-background/60 font-mono"
          />
        </Field>
        <Field label="Take profit">
          <Input
            type="number"
            step="any"
            value={ticket.takeProfit}
            onChange={(e) => onChange({ takeProfit: e.target.value })}
            placeholder="—"
            className="h-9 bg-background/60 font-mono"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Risk preview</span>
          <span className="font-semibold text-foreground">{risk == null ? "Set SL" : formatMoney(risk)}</span>
        </div>
        {lastPrice != null && (
          <div className="mt-1 flex items-center justify-between text-muted-foreground">
            <span>Mark</span>
            <span className="font-mono">{formatPrice(lastPrice, symbol)}</span>
          </div>
        )}
      </div>

      <Button
        type="button"
        disabled
        title="Live trading coming soon"
        onClick={onSubmit}
        className={cn(
          "mt-auto h-11 w-full text-sm font-bold uppercase tracking-wide",
          buy ? "bg-emerald-500 text-white hover:bg-emerald-500/90" : "bg-red-500 text-white hover:bg-red-500/90",
        )}
      >
        Live trading coming soon
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
