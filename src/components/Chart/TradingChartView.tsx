import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartCandlestick } from "lucide-react";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { createBrokerAdapter } from "@/lib/chartTrading/BrokerAdapter";
import { loadChartAccounts } from "@/lib/chartTrading/accounts";
import {
  formatMoney,
  formatPrice,
  getSymbolSpec,
  type BrokerAdapter,
  type Candle,
  type ChartBrokerAccount,
  type ChartSymbol,
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

function defaultTicket(symbol: ChartSymbol, last: number | null): TradeTicket {
  const spec = getSymbolSpec(symbol);
  const mark = last ?? spec.basePrice;
  return {
    side: "buy",
    type: "market",
    lots: 0.1,
    entryPrice: formatPrice(mark, symbol),
    stopLoss: formatPrice(mark - spec.pipSize * 20, symbol),
    takeProfit: formatPrice(mark + spec.pipSize * 35, symbol),
  };
}

export function TradingChartView() {
  const isMobile = useIsMobile();
  const theme = useDocumentTheme();
  const adaptersRef = useRef(new Map<string, BrokerAdapter>());
  const chartApiRef = useRef<ChartApi | null>(null);
  const [, setApiVersion] = useState(0);

  const [accounts, setAccounts] = useState<ChartBrokerAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<ChartSymbol>("EURUSD");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [history, setHistory] = useState<HistoryTrade[]>([]);
  const [ticket, setTicket] = useState<TradeTicket>(() => defaultTicket("EURUSD", null));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null,
    [accounts, accountId],
  );

  const lastPrice = candles[candles.length - 1]?.close ?? null;

  const getAdapter = useCallback((item: ChartBrokerAccount) => {
    let adapter = adaptersRef.current.get(item.id);
    if (!adapter) {
      adapter = createBrokerAdapter(item);
      adaptersRef.current.set(item.id, adapter);
    }
    return adapter;
  }, []);

  const refreshBook = useCallback(async (adapter: BrokerAdapter) => {
    const [nextPositions, nextOrders, nextHistory] = await Promise.all([
      adapter.getPositions(),
      adapter.getOrders(),
      adapter.getHistory(),
    ]);
    setPositions(nextPositions);
    setOrders(nextOrders);
    setHistory(nextHistory);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadChartAccounts().then((next) => {
      if (cancelled) return;
      setAccounts(next);
      setAccountId((current) => current ?? next[0]?.id ?? null);
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
    let unsub = () => undefined;

    adapter.getCandles(symbol, timeframe).then((series) => {
      if (cancelled) return;
      setCandles(series);
      const close = series[series.length - 1]?.close ?? null;
      setTicket((prev) => ({
        ...defaultTicket(symbol, close),
        side: prev.side,
        type: prev.type,
        lots: prev.lots,
      }));
      unsub = adapter.subscribePrice(symbol, (tick) => {
        setCandles((current) => {
          if (!current.length) return current;
          const next = current.slice();
          next[next.length - 1] = tick.candle;
          return next;
        });
        adapter.getPositions().then((nextPositions) => {
          if (!cancelled) setPositions(nextPositions);
        });
      });
    });
    refreshBook(adapter);

    return () => {
      cancelled = true;
      unsub();
    };
  }, [account, symbol, timeframe, getAdapter, refreshBook]);

  const bindChartApi = useCallback((api: ChartApi | null) => {
    chartApiRef.current = api;
    setApiVersion((n) => n + 1);
  }, []);

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    setDrawings([]);
  };

  const handleTicketChange = (patch: Partial<TradeTicket>) => {
    setTicket((prev) => ({ ...prev, ...patch }));
  };

  const handleConfirmTrade = async () => {
    if (!account) return;
    const adapter = getAdapter(account);
    const sl = ticket.stopLoss === "" ? null : Number(ticket.stopLoss);
    const tp = ticket.takeProfit === "" ? null : Number(ticket.takeProfit);
    await adapter.placeOrder({
      symbol,
      side: ticket.side,
      type: ticket.type,
      lots: ticket.lots,
      entryPrice: ticket.type === "market" ? undefined : Number(ticket.entryPrice),
      stopLoss: sl,
      takeProfit: tp,
    });
    await refreshBook(adapter);
    setConfirmOpen(false);
    setSheetOpen(false);
  };

  const handleClosePosition = async (id: string) => {
    if (!account) return;
    const adapter = getAdapter(account);
    await adapter.closePosition(id);
    await refreshBook(adapter);
  };

  const handleDragLevel = async (positionId: string, kind: "sl" | "tp", price: number) => {
    if (!account) return;
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
    await getAdapter(account).updatePosition(positionId, {
      stopLoss: kind === "sl" ? numeric : undefined,
      takeProfit: kind === "tp" ? numeric : undefined,
    });
  };

  const confirmCopy = useMemo(() => {
    const entry = ticket.type === "market" ? lastPrice : Number(ticket.entryPrice);
    const sl = ticket.stopLoss === "" ? null : Number(ticket.stopLoss);
    const tp = ticket.takeProfit === "" ? null : Number(ticket.takeProfit);
    const risk = sl != null && entry != null
      ? Math.abs(entry - sl) * ticket.lots * getSymbolSpec(symbol).contractSize
      : null;
    return [
      `${ticket.side.toUpperCase()} ${ticket.lots} ${symbol} ${ticket.type}`,
      `Entry ${entry == null ? "—" : formatPrice(entry, symbol)}`,
      `SL ${sl == null ? "—" : formatPrice(sl, symbol)}`,
      `TP ${tp == null ? "—" : formatPrice(tp, symbol)}`,
      `Risk ${risk == null ? "—" : formatMoney(risk)}`,
    ].join(" · ");
  }, [ticket, lastPrice, symbol]);

  const panel = (
    <TradingPanel
      symbol={symbol}
      lastPrice={lastPrice}
      ticket={ticket}
      onChange={handleTicketChange}
      onSubmit={() => setConfirmOpen(true)}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-1.5rem)] min-h-[36rem] flex-col gap-2 sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)]">
      <ChartTopBar
        accounts={accounts}
        account={account}
        onAccountChange={handleAccountChange}
        symbol={symbol}
        onSymbolChange={(next) => {
          setSymbol(next);
          setDrawings([]);
        }}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        showEma20={showEma20}
        showEma50={showEma50}
        showRsi={showRsi}
        onToggleEma20={setShowEma20}
        onToggleEma50={setShowEma50}
        onToggleRsi={setShowRsi}
        lastPrice={lastPrice}
      />

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
        </div>

        {!isMobile && <div className="w-[17.5rem] shrink-0">{panel}</div>}
      </div>

      <ChartBottomPanel
        positions={positions}
        orders={orders}
        history={history}
        onClose={handleClosePosition}
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={ticket.type === "market" ? "Confirm market order" : "Confirm pending order"}
        description={confirmCopy}
        confirmLabel={ticket.side === "buy" ? "Buy" : "Sell"}
        onConfirm={handleConfirmTrade}
      />
    </div>
  );
}
