import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, ChartCandlestick } from "lucide-react";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { adapterAvailable, createBrokerAdapter } from "@/lib/chartTrading/BrokerAdapter";
import { loadChartAccounts } from "@/lib/chartTrading/accounts";
import { marketErrorMessage } from "@/lib/chartTrading/tradeLockerMap";
import {
  DEFAULT_CHART_INSTRUMENTS,
  getChartTimezone,
  mergeChartInstruments,
  toTradingViewInterval,
  toTradingViewSymbol,
} from "@/lib/chartTrading/tradingViewSymbols";
import {
  formatPrice,
  getSymbolSpec,
  type BrokerAdapter,
  type ChartBrokerAccount,
  type ChartInstrument,
  type ChartTimeframe,
  type HistoryTrade,
  type PendingOrder,
  type Position,
} from "@/lib/chartTrading/types";
import { ChartBottomPanel } from "./ChartBottomPanel";
import { ChartTopBar } from "./ChartTopBar";
import { TradingViewAdvancedChart } from "./TradingViewAdvancedChart";
import { TradingPanel, type TradeTicket } from "./TradingPanel";

const LotSizeCalculator = lazy(() =>
  import("@/components/Calculator/LotSizeCalculator").then((m) => ({
    default: m.LotSizeCalculator,
  })),
);

function defaultTicket(symbol: string, last: number | null): TradeTicket {
  const spec = getSymbolSpec(symbol);
  const mark = last ?? spec.basePrice ?? 0;
  return {
    side: "buy",
    type: "market",
    lots: 0.1,
    entryPrice: formatPrice(mark, symbol),
    stopLoss: formatPrice(mark - spec.pipSize * 20, symbol),
    takeProfit: formatPrice(mark + spec.pipSize * 35, symbol),
  };
}

function pickDefaultSymbol(instruments: ChartInstrument[], preferred?: string | null) {
  if (preferred && instruments.some((item) => item.symbol === preferred)) return preferred;
  return instruments.find((item) => item.symbol === "EURUSD")?.symbol
    ?? instruments.find((item) => item.symbol === "XAUUSD")?.symbol
    ?? instruments[0]?.symbol
    ?? "EURUSD";
}

export function TradingChartView() {
  const isMobile = useIsMobile();
  const theme = useDocumentTheme();
  const timezone = useMemo(() => getChartTimezone(), []);
  const adaptersRef = useRef(new Map<string, BrokerAdapter>());

  const [accounts, setAccounts] = useState<ChartBrokerAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<ChartInstrument[]>(DEFAULT_CHART_INSTRUMENTS);
  const [symbol, setSymbol] = useState(() => pickDefaultSymbol(DEFAULT_CHART_INSTRUMENTS));
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [history, setHistory] = useState<HistoryTrade[]>([]);
  const [ticket, setTicket] = useState<TradeTicket>(() => defaultTicket("EURUSD", null));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null,
    [accounts, accountId],
  );

  const lastPrice = useMemo(() => {
    const match = positions.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
    return match?.currentPrice ?? null;
  }, [positions, symbol]);

  const tvSymbol = toTradingViewSymbol(symbol);
  const tvInterval = toTradingViewInterval(timeframe);

  const getAdapter = useCallback((item: ChartBrokerAccount) => {
    let adapter = adaptersRef.current.get(item.id);
    if (!adapter) {
      adapter = createBrokerAdapter(item);
      adaptersRef.current.set(item.id, adapter);
    }
    return adapter;
  }, []);

  const refreshBook = useCallback(async (adapter: BrokerAdapter) => {
    if (!adapter.supportsMarketData) {
      setPositions([]);
      setOrders([]);
      setHistory([]);
      return;
    }
    try {
      const [nextPositions, nextOrders, nextHistory] = await Promise.all([
        adapter.getPositions(),
        adapter.getOrders(),
        adapter.getHistory(),
      ]);
      setPositions(nextPositions);
      setOrders(nextOrders);
      setHistory(nextHistory);
    } catch (error) {
      const parsed = marketErrorMessage(error);
      setStatusMessage(parsed.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadChartAccounts()
      .then((next) => {
        if (cancelled) return;
        setAccounts(next);
        setAccountId((current) => current ?? next[0]?.id ?? null);
        if (!next.length) {
          setStatusMessage("No connected broker accounts. Connect one in Settings.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage("Could not load connected accounts.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      adaptersRef.current.forEach((adapter) => adapter.destroy());
      adaptersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!account) {
      setInstruments(DEFAULT_CHART_INSTRUMENTS);
      setPositions([]);
      setOrders([]);
      setHistory([]);
      return;
    }

    const adapter = getAdapter(account);
    let cancelled = false;
    setPositions([]);
    setOrders([]);
    setHistory([]);

    if (!adapterAvailable(account) || !adapter.supportsMarketData) {
      setInstruments(DEFAULT_CHART_INSTRUMENTS);
      setStatusMessage("Positions and orders are not available for this broker yet.");
      return;
    }

    adapter.getInstruments().then((nextInstruments) => {
      if (cancelled) return;
      const list = mergeChartInstruments(nextInstruments);
      setInstruments(list);
      setSymbol((current) => pickDefaultSymbol(list, current));
      setStatusMessage(null);
    }).catch((error) => {
      if (cancelled) return;
      setInstruments(DEFAULT_CHART_INSTRUMENTS);
      setStatusMessage(marketErrorMessage(error).message);
    });

    const bookTimer = setInterval(() => {
      refreshBook(adapter);
    }, 10_000);
    void refreshBook(adapter);

    return () => {
      cancelled = true;
      clearInterval(bookTimer);
    };
  }, [account, getAdapter, refreshBook]);

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    setStatusMessage(null);
  };

  const handleSymbolChange = (next: string) => {
    setSymbol(next);
    setTicket((prev) => ({
      ...defaultTicket(next, null),
      side: prev.side,
      type: prev.type,
      lots: prev.lots,
    }));
    setStatusMessage(null);
  };

  const handleTicketChange = (patch: Partial<TradeTicket>) => {
    setTicket((prev) => ({ ...prev, ...patch }));
  };

  const panel = (
    <TradingPanel
      symbol={symbol || "—"}
      lastPrice={lastPrice}
      ticket={ticket}
      onChange={handleTicketChange}
      onSubmit={() => undefined}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-1.5rem)] min-h-[36rem] flex-col gap-2 sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)]">
      <ChartTopBar
        accounts={accounts}
        account={account}
        onAccountChange={handleAccountChange}
        instruments={instruments}
        symbol={symbol}
        onSymbolChange={handleSymbolChange}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        lastPrice={lastPrice}
        onOpenCalculator={() => setCalculatorOpen(true)}
      />

      {statusMessage && (
        <div className="liquid-glass rounded-xl px-3 py-2 text-xs font-medium text-amber-500">
          {statusMessage}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <div className="relative min-h-[20rem] min-w-0 w-full flex-1 overflow-hidden rounded-2xl border border-foreground/10 bg-background/40">
          <TradingViewAdvancedChart
            key={`${theme}-${tvSymbol}-${tvInterval}-${timezone}`}
            symbol={tvSymbol}
            interval={tvInterval}
            theme={theme}
            timezone={timezone}
          />
        </div>

        {!isMobile && <div className="w-[17.5rem] shrink-0">{panel}</div>}
      </div>

      <ChartBottomPanel
        positions={positions}
        orders={orders}
        history={history}
        onClose={() => undefined}
      />

      {isMobile && (
        <Button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-16 right-4 z-20 h-11 rounded-full px-4 shadow-lg"
        >
          <ChartCandlestick className="h-4 w-4" />
          Trade
        </Button>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="liquid-glass h-[min(85dvh,36rem)] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="mb-3">
            <SheetTitle>Place order</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>

      <Sheet open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <SheetContent side="right" className="liquid-glass w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Pip calculator
            </SheetTitle>
            <SheetDescription>
              Size your position before placing the trade. Live rates included.
            </SheetDescription>
          </SheetHeader>
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
              <LotSizeCalculator compact initialSymbol={tvSymbol} />
            </Suspense>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
