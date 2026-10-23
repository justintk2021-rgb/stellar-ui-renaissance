import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartCandlestick } from "lucide-react";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { adapterAvailable, createBrokerAdapter } from "@/lib/chartTrading/BrokerAdapter";
import { loadChartAccounts } from "@/lib/chartTrading/accounts";
import { marketErrorMessage } from "@/lib/chartTrading/tradeLockerMap";
import {
  formatPrice,
  getSymbolSpec,
  type BrokerAdapter,
  type Candle,
  type ChartBrokerAccount,
  type ChartInstrument,
  type ChartTimeframe,
  type HistoryTrade,
  type PendingOrder,
  type Position,
} from "@/lib/chartTrading/types";
import { CandleChart, type ChartApi } from "./CandleChart";
import { ChartBottomPanel } from "./ChartBottomPanel";
import { ChartToolbar } from "./ChartToolbar";
import { ChartTopBar } from "./ChartTopBar";
import { DrawingOverlay } from "./DrawingOverlay";
import { TradingPanel, type TradeTicket } from "./TradingPanel";
import type { ChartDrawing, DrawingTool } from "./drawings";

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
    ?? "";
}

export function TradingChartView() {
  const isMobile = useIsMobile();
  const theme = useDocumentTheme();
  const adaptersRef = useRef(new Map<string, BrokerAdapter>());
  const chartApiRef = useRef<ChartApi | null>(null);
  const loadingMoreRef = useRef(false);
  const [, setApiVersion] = useState(0);

  const [accounts, setAccounts] = useState<ChartBrokerAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<ChartInstrument[]>([]);
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [history, setHistory] = useState<HistoryTrade[]>([]);
  const [ticket, setTicket] = useState<TradeTicket>(() => defaultTicket("EURUSD", null));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null,
    [accounts, accountId],
  );

  const lastPrice = candles[candles.length - 1]?.close ?? null;
  const marketReady = adapterAvailable(account);

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
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage("Could not load connected accounts.");
          setLoading(false);
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
    if (!account) return;
    const adapter = getAdapter(account);
    let cancelled = false;
    setInstruments([]);
    setCandles([]);
    setPositions([]);
    setOrders([]);
    setHistory([]);
    setLoading(true);

    if (!adapter.supportsMarketData) {
      setStatusMessage("Chart data not available for this broker yet");
      setLoading(false);
      return;
    }

    adapter.getInstruments().then((nextInstruments) => {
      if (cancelled) return;
      setInstruments(nextInstruments);
      setSymbol((current) => pickDefaultSymbol(nextInstruments, current));
      if (!nextInstruments.length) {
        setStatusMessage("No tradable instruments on this account.");
        setLoading(false);
      }
    }).catch((error) => {
      if (!cancelled) {
        setStatusMessage(marketErrorMessage(error).message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [account, getAdapter]);

  useEffect(() => {
    if (!account || !symbol || !marketReady) return;
    const adapter = getAdapter(account);
    if (!adapter.supportsMarketData) return;
    let cancelled = false;
    let unsub = () => undefined;
    setLoading(true);

    const bookTimer = setInterval(() => {
      refreshBook(adapter);
    }, 10_000);

    adapter.getCandles(symbol, timeframe).then((series) => {
      if (cancelled) return;
      setCandles(series);
      setTicket((prev) => ({
        ...defaultTicket(symbol, series[series.length - 1]?.close ?? null),
        side: prev.side,
        type: prev.type,
        lots: prev.lots,
      }));
      setStatusMessage(null);
      unsub = adapter.subscribePrice(symbol, (tick) => {
        setCandles((current) => {
          if (!current.length) return [tick.candle];
          const next = current.slice();
          const last = next[next.length - 1];
          if (last.time === tick.candle.time) next[next.length - 1] = tick.candle;
          else if (tick.candle.time > last.time) next.push(tick.candle);
          return next;
        });
      });
      return refreshBook(adapter);
    }).catch((error) => {
      if (cancelled) return;
      const parsed = marketErrorMessage(error);
      setStatusMessage(parsed.message);
      if (parsed.code !== "market_closed") setCandles([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub();
      clearInterval(bookTimer);
    };
  }, [account, symbol, timeframe, getAdapter, refreshBook, marketReady]);

  const bindChartApi = useCallback((api: ChartApi | null) => {
    chartApiRef.current = api;
    setApiVersion((n) => n + 1);
  }, []);

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    setSymbol("");
    setStatusMessage(null);
  };

  const handleNeedMore = useCallback(() => {
    if (!account || !symbol || loadingMoreRef.current || !candles.length) return;
    const adapter = getAdapter(account);
    if (!adapter.supportsMarketData) return;
    loadingMoreRef.current = true;
    adapter.loadMoreCandles(symbol, timeframe, candles[0].time).then((older) => {
      if (older.length) {
        setCandles((current) => {
          const unique = new Map<number, Candle>();
          for (const bar of [...older, ...current]) unique.set(bar.time, bar);
          return [...unique.values()].sort((a, b) => a.time - b.time);
        });
      }
    }).catch((error) => {
      const parsed = marketErrorMessage(error);
      if (parsed.code !== "market_closed") setStatusMessage(parsed.message);
    }).finally(() => {
      loadingMoreRef.current = false;
    });
  }, [account, symbol, timeframe, candles, getAdapter]);

  const handleTicketChange = (patch: Partial<TradeTicket>) => {
    setTicket((prev) => ({ ...prev, ...patch }));
  };

  const handleDragLevel = (positionId: string, kind: "sl" | "tp", price: number) => {
    const rounded = formatPrice(price, symbol);
    const numeric = Number(rounded);
    setPositions((current) =>
      current.map((p) =>
        p.id === positionId
          ? { ...p, stopLoss: kind === "sl" ? numeric : p.stopLoss, takeProfit: kind === "tp" ? numeric : p.takeProfit }
          : p,
      ),
    );
    setTicket((prev) => ({
      ...prev,
      stopLoss: kind === "sl" ? rounded : prev.stopLoss,
      takeProfit: kind === "tp" ? rounded : prev.takeProfit,
    }));
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
        onSymbolChange={(next) => {
          setSymbol(next);
          setDrawings([]);
          setStatusMessage(null);
        }}
        timeframe={timeframe}
        onTimeframeChange={(tf) => {
          setTimeframe(tf);
          setDrawings([]);
        }}
        showEma20={showEma20}
        showEma50={showEma50}
        showRsi={showRsi}
        onToggleEma20={setShowEma20}
        onToggleEma50={setShowEma50}
        onToggleRsi={setShowRsi}
        lastPrice={lastPrice}
      />

      {statusMessage && (
        <div className="liquid-glass rounded-xl px-3 py-2 text-xs font-medium text-amber-500">
          {statusMessage}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <ChartToolbar tool={tool} onToolChange={setTool} onDeleteAll={() => setDrawings([])} />

        <div className="relative min-h-[20rem] min-w-0 flex-1 overflow-hidden rounded-2xl border border-foreground/10">
          <CandleChart
            key={`${theme}-${symbol}-${timeframe}`}
            ref={bindChartApi}
            candles={candles}
            symbol={symbol}
            positions={positions}
            showEma20={showEma20}
            showEma50={showEma50}
            showRsi={showRsi}
            draggingId={draggingId}
            onNeedMoreHistory={handleNeedMore}
          />
          <DrawingOverlay
            chartApi={chartApiRef.current}
            tool={tool}
            drawings={drawings}
            onDrawingsChange={setDrawings}
            positions={positions}
            symbol={symbol}
            onDragLevel={handleDragLevel}
            onDragStart={setDraggingId}
          />
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 text-xs text-muted-foreground">
              Loading chart…
            </div>
          )}
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
    </div>
  );
}
