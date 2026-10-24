import { lazy, Suspense, useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CHART_TIMEFRAMES,
  platformLabel,
  type ChartBrokerAccount,
  type ChartInstrument,
  type ChartTimeframe,
} from "@/lib/chartTrading/types";

const LotSizeCalculator = lazy(() =>
  import("@/components/Calculator/LotSizeCalculator").then((m) => ({
    default: m.LotSizeCalculator,
  })),
);

interface ChartTopBarProps {
  accounts: ChartBrokerAccount[];
  account: ChartBrokerAccount | null;
  onAccountChange: (id: string) => void;
  instruments: ChartInstrument[];
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: ChartTimeframe;
  onTimeframeChange: (tf: ChartTimeframe) => void;
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
  lastPrice,
}: ChartTopBarProps) {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const current = instruments.find((item) => item.symbol === symbol);
  const precision = current?.precision ?? 5;

  return (
    <div className="perf-contain liquid-glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
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

      <Popover open={calculatorOpen} onOpenChange={setCalculatorOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Pip calculator"
            aria-label={calculatorOpen ? "Close pip calculator" : "Open pip calculator"}
            aria-expanded={calculatorOpen}
            className={cn(
              "ml-auto h-8 w-8 rounded-full border border-border/40 bg-foreground/[0.04]",
              "flex items-center justify-center text-muted-foreground",
              "hover:text-primary hover:border-primary/30 hover:bg-primary/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
              "transition-colors",
              calculatorOpen && "text-primary border-primary/30 bg-primary/10",
            )}
          >
            <Calculator className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={10}
          collisionPadding={16}
          className="w-[min(24rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100dvh-5rem))] overflow-y-auto p-4 liquid-glass projection-popover shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none"
        >
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Pip calculator</span>
          </div>
          {calculatorOpen && (
            <Suspense
              fallback={
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
                  ))}
                </div>
              }
            >
              <LotSizeCalculator compact initialSymbol={symbol} />
            </Suspense>
          )}
        </PopoverContent>
      </Popover>
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
