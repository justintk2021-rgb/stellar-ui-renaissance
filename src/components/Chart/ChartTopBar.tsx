import { Activity, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  CHART_TIMEFRAMES,
  platformLabel,
  type ChartBrokerAccount,
  type ChartInstrument,
  type ChartTimeframe,
} from "@/lib/chartTrading/types";

interface ChartTopBarProps {
  accounts: ChartBrokerAccount[];
  account: ChartBrokerAccount | null;
  onAccountChange: (id: string) => void;
  instruments: ChartInstrument[];
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: ChartTimeframe;
  onTimeframeChange: (tf: ChartTimeframe) => void;
  showEma20: boolean;
  showEma50: boolean;
  showRsi: boolean;
  onToggleEma20: (next: boolean) => void;
  onToggleEma50: (next: boolean) => void;
  onToggleRsi: (next: boolean) => void;
  lastPrice: number | null;
}

export function ChartTopBar({
  accounts,
  account,
  onAccountChange,
  instruments,
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  showEma20,
  showEma50,
  showRsi,
  onToggleEma20,
  onToggleEma50,
  onToggleRsi,
  lastPrice,
}: ChartTopBarProps) {
  const current = instruments.find((item) => item.symbol === symbol);
  const precision = current?.precision ?? 5;

  return (
    <div className="liquid-glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 max-w-full justify-start gap-2 rounded-xl px-2.5 hover:bg-foreground/5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <BrokerBadge platform={account?.platform ?? "mock"} />
              <span className="truncate text-sm font-medium">
                {account?.label ?? "Select account"}
              </span>
              {account && <EnvTag environment={account.environment} />}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="liquid-glass min-w-[18rem]">
          <DropdownMenuLabel>Connected accounts</DropdownMenuLabel>
          {accounts.length === 0 && (
            <DropdownMenuItem disabled>No connected broker accounts</DropdownMenuItem>
          )}
          {accounts.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onAccountChange(item.id)}
              className="justify-between"
            >
              <span className="flex min-w-0 items-center gap-2">
                <BrokerBadge platform={item.platform} />
                <span className="truncate">{item.label}</span>
              </span>
              <EnvTag environment={item.environment} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden h-5 w-px bg-foreground/10 sm:block" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 rounded-xl px-2.5 hover:bg-foreground/5">
            <span className="font-semibold tracking-wide">{current?.name || symbol || "Symbol"}</span>
            {lastPrice != null && (
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                {lastPrice.toFixed(precision)}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="liquid-glass max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Symbol</DropdownMenuLabel>
          {instruments.length === 0 && (
            <DropdownMenuItem disabled>No instruments</DropdownMenuItem>
          )}
          {instruments.map((item) => (
            <DropdownMenuItem key={item.symbol} onClick={() => onSymbolChange(item.symbol)}>
              <span className="font-medium">{item.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{item.symbol}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-wrap items-center gap-1">
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframeChange(tf)}
            className={cn(
              "h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors",
              timeframe === tf
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 rounded-xl px-2.5 hover:bg-foreground/5">
              <Activity className="h-4 w-4" />
              Indicators
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="liquid-glass w-48">
            <DropdownMenuLabel>Overlays</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showEma20} onCheckedChange={(v) => onToggleEma20(v === true)}>
              EMA 20
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showEma50} onCheckedChange={(v) => onToggleEma50(v === true)}>
              EMA 50
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Oscillators</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showRsi} onCheckedChange={(v) => onToggleRsi(v === true)}>
              RSI 14
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function BrokerBadge({ platform }: { platform: ChartBrokerAccount["platform"] }) {
  const label = platformLabel(platform);
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-foreground/10 bg-foreground/5 px-1.5 text-[10px] font-semibold uppercase tracking-wide">
      {label === "TradeLocker" ? "TL" : label === "MT5" ? "MT5" : "BK"}
    </span>
  );
}

function EnvTag({ environment }: { environment: ChartBrokerAccount["environment"] }) {
  const live = environment === "live";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 border px-1.5 py-0 text-[10px] font-bold tracking-wide",
        live
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          : "border-amber-500/40 bg-amber-500/10 text-amber-500",
      )}
    >
      {live ? "LIVE" : "DEMO"}
    </Badge>
  );
}
