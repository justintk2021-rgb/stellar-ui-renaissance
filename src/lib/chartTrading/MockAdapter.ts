import { generateMockCandles, tickLastCandle } from "./mockCandles";
import {
  getSymbolSpec,
  positionPnl,
  type BrokerAdapter,
  type Candle,
  type ChartBrokerAccount,
  type ChartTimeframe,
  type HistoryTrade,
  type PendingOrder,
  type PlaceOrderRequest,
  type PlaceOrderResult,
  type Position,
  type PriceTick,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedOffset(id: string, index: number): number {
  let h = index + 1;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export class MockAdapter implements BrokerAdapter {
  readonly id: string;
  readonly account: ChartBrokerAccount;

  private candles = new Map<string, Candle[]>();
  private positions: Position[] = [];
  private orders: PendingOrder[] = [];
  private history: HistoryTrade[] = [];
  private activeSymbol = "EURUSD";
  private activeTimeframe: ChartTimeframe = "15m";
  private timers = new Set<ReturnType<typeof setInterval>>();
  private lastPrices = new Map<string, number>();

  constructor(account: ChartBrokerAccount) {
    this.id = account.id;
    this.account = account;
    this.seedDemoBook();
  }

  async getCandles(symbol: string, timeframe: ChartTimeframe, count = 280): Promise<Candle[]> {
    this.activeSymbol = symbol;
    this.activeTimeframe = timeframe;
    const key = this.key(symbol, timeframe);
    if (!this.candles.has(key)) {
      this.candles.set(key, generateMockCandles(symbol, timeframe, count, this.account.id));
    }
    const series = this.candles.get(key)!;
    const last = series[series.length - 1];
    if (last) {
      this.lastPrices.set(symbol, last.close);
      this.markPositions(last.close, symbol);
    }
    return series.map((c) => ({ ...c }));
  }

  subscribePrice(symbol: string, onTick: (tick: PriceTick) => void): () => void {
    this.activeSymbol = symbol;
    const spec = getSymbolSpec(symbol);
    const timer = setInterval(() => {
      const key = this.key(symbol, this.activeTimeframe);
      const series = this.candles.get(key);
      if (!series?.length) return;
      const next = tickLastCandle(series[series.length - 1], symbol);
      series[series.length - 1] = next;
      this.lastPrices.set(symbol, next.close);
      this.markPositions(next.close, symbol);
      onTick({
        symbol,
        last: next.close,
        bid: next.close - spec.spread / 2,
        ask: next.close + spec.spread / 2,
        time: Math.floor(Date.now() / 1000),
        candle: { ...next },
      });
    }, 1000);
    this.timers.add(timer);
    return () => {
      clearInterval(timer);
      this.timers.delete(timer);
    };
  }

  async placeOrder(order: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const spec = getSymbolSpec(order.symbol);
    const last = this.lastPrices.get(order.symbol) || spec.basePrice;
    const fill = order.type === "market" ? last : (order.entryPrice ?? last);

    if (order.type !== "market") {
      const pending: PendingOrder = {
        id: uid("ord"),
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        lots: order.lots,
        entryPrice: fill,
        stopLoss: order.stopLoss ?? null,
        takeProfit: order.takeProfit ?? null,
        createdAt: Date.now(),
      };
      this.orders = [pending, ...this.orders];
      return { order: pending };
    }

    const position: Position = {
      id: uid("pos"),
      symbol: order.symbol,
      side: order.side,
      lots: order.lots,
      entryPrice: fill,
      stopLoss: order.stopLoss ?? null,
      takeProfit: order.takeProfit ?? null,
      currentPrice: last,
      pnl: positionPnl(order.side, fill, last, order.lots, order.symbol),
      openedAt: Date.now(),
    };
    this.positions = [position, ...this.positions];
    return { position };
  }

  async getPositions(): Promise<Position[]> {
    this.markToLastKnown();
    return this.positions.map((p) => ({ ...p }));
  }

  async getOrders(): Promise<PendingOrder[]> {
    return this.orders.map((o) => ({ ...o }));
  }

  async getHistory(): Promise<HistoryTrade[]> {
    return this.history.map((h) => ({ ...h }));
  }

  async closePosition(id: string): Promise<HistoryTrade | null> {
    const idx = this.positions.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const [position] = this.positions.splice(idx, 1);
    const closed: HistoryTrade = {
      id: uid("hst"),
      symbol: position.symbol,
      side: position.side,
      lots: position.lots,
      entryPrice: position.entryPrice,
      exitPrice: position.currentPrice,
      pnl: position.pnl,
      openedAt: position.openedAt,
      closedAt: Date.now(),
    };
    this.history = [closed, ...this.history];
    return closed;
  }

  async updatePosition(
    id: string,
    patch: { stopLoss?: number | null; takeProfit?: number | null },
  ): Promise<Position | null> {
    const position = this.positions.find((p) => p.id === id);
    if (!position) return null;
    if ("stopLoss" in patch) position.stopLoss = patch.stopLoss ?? null;
    if ("takeProfit" in patch) position.takeProfit = patch.takeProfit ?? null;
    return { ...position };
  }

  destroy(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
  }

  private key(symbol: string, timeframe: ChartTimeframe): string {
    return `${symbol}:${timeframe}`;
  }

  private markPositions(price: number, symbol?: string) {
    if (!price) return;
    this.positions = this.positions.map((p) => {
      if (symbol && p.symbol !== symbol) return p;
      return {
        ...p,
        currentPrice: price,
        pnl: positionPnl(p.side, p.entryPrice, price, p.lots, p.symbol),
      };
    });
  }

  private markToLastKnown() {
    this.positions = this.positions.map((p) => {
      const price = this.lastPrices.get(p.symbol) ?? p.currentPrice;
      return {
        ...p,
        currentPrice: price,
        pnl: positionPnl(p.side, p.entryPrice, price, p.lots, p.symbol),
      };
    });
  }

  private seedDemoBook() {
    const symbol = "EURUSD";
    const spec = getSymbolSpec(symbol);
    const n = seedOffset(this.account.id, 0);
    const last = spec.basePrice;
    this.lastPrices.set(symbol, last);

    const buyEntry = last - spec.pipSize * (8 + n * 12);
    this.positions.push({
      id: uid("pos"),
      symbol,
      side: "buy",
      lots: 0.5,
      entryPrice: buyEntry,
      stopLoss: buyEntry - spec.pipSize * 18,
      takeProfit: buyEntry + spec.pipSize * 32,
      currentPrice: last,
      pnl: positionPnl("buy", buyEntry, last, 0.5, symbol),
      openedAt: Date.now() - 1000 * 60 * 42,
    });

    const gold = getSymbolSpec("XAUUSD");
    this.lastPrices.set("XAUUSD", gold.basePrice);
    const goldEntry = gold.basePrice + 2.4;
    this.positions.push({
      id: uid("pos"),
      symbol: "XAUUSD",
      side: "sell",
      lots: 0.1,
      entryPrice: goldEntry,
      stopLoss: goldEntry + 6,
      takeProfit: goldEntry - 9,
      currentPrice: gold.basePrice,
      pnl: positionPnl("sell", goldEntry, gold.basePrice, 0.1, "XAUUSD"),
      openedAt: Date.now() - 1000 * 60 * 18,
    });

    this.orders.push({
      id: uid("ord"),
      symbol: "NAS100",
      side: "buy",
      type: "limit",
      lots: 1,
      entryPrice: getSymbolSpec("NAS100").basePrice - 40,
      stopLoss: getSymbolSpec("NAS100").basePrice - 90,
      takeProfit: getSymbolSpec("NAS100").basePrice + 80,
      createdAt: Date.now() - 1000 * 60 * 9,
    });

    this.history.push(
      {
        id: uid("hst"),
        symbol: "GBPUSD",
        side: "buy",
        lots: 0.2,
        entryPrice: 1.2698,
        exitPrice: 1.2731,
        pnl: positionPnl("buy", 1.2698, 1.2731, 0.2, "GBPUSD"),
        openedAt: Date.now() - 1000 * 60 * 180,
        closedAt: Date.now() - 1000 * 60 * 95,
      },
      {
        id: uid("hst"),
        symbol: "USDJPY",
        side: "sell",
        lots: 0.3,
        entryPrice: 149.88,
        exitPrice: 149.41,
        pnl: positionPnl("sell", 149.88, 149.41, 0.3, "USDJPY"),
        openedAt: Date.now() - 1000 * 60 * 400,
        closedAt: Date.now() - 1000 * 60 * 240,
      },
      {
        id: uid("hst"),
        symbol: "BTCUSD",
        side: "buy",
        lots: 0.05,
        entryPrice: 66810,
        exitPrice: 66120,
        pnl: positionPnl("buy", 66810, 66120, 0.05, "BTCUSD"),
        openedAt: Date.now() - 1000 * 60 * 800,
        closedAt: Date.now() - 1000 * 60 * 620,
      },
    );
  }
}
