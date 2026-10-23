import { invokeTradeLockerMarket } from "./marketClient";
import {
  applyQuoteToCandle,
  ChartMarketError,
  defaultHistoryRange,
  mapBrokerHistory,
  mapBrokerOrders,
  mapBrokerPositions,
  mapRawInstruments,
} from "./tradeLockerMap";
import type {
  BrokerAdapter,
  Candle,
  ChartBrokerAccount,
  ChartInstrument,
  ChartTimeframe,
  HistoryTrade,
  PendingOrder,
  PlaceOrderRequest,
  PlaceOrderResult,
  Position,
  PriceTick,
} from "./types";

const TRADING_DISABLED = new ChartMarketError("unavailable", "Live trading coming soon");

export class TradeLockerAdapter implements BrokerAdapter {
  readonly id: string;
  readonly account: ChartBrokerAccount;
  readonly supportsTrading = false;
  readonly supportsMarketData = true;

  private instruments: ChartInstrument[] = [];
  private instrumentsLoaded = false;
  private candles = new Map<string, Candle[]>();
  private activeSymbol = "";
  private activeTimeframe: ChartTimeframe = "15m";
  private timers = new Set<ReturnType<typeof setInterval>>();
  private loadingMore = false;

  constructor(account: ChartBrokerAccount) {
    this.id = account.id;
    this.account = account;
  }

  async getInstruments(): Promise<ChartInstrument[]> {
    if (this.instrumentsLoaded) return this.instruments;
    const data = await invokeTradeLockerMarket<{ instruments: unknown[] }>({
      action: "instruments",
      ...this.scope(),
    });
    const raw = data.instruments || [];
    this.instruments = raw[0] && typeof raw[0] === "object" && "infoRouteId" in (raw[0] as object)
      ? (raw as ChartInstrument[])
      : mapRawInstruments(raw);
    this.instrumentsLoaded = true;
    return this.instruments;
  }

  async getCandles(symbol: string, timeframe: ChartTimeframe, count = 300): Promise<Candle[]> {
    this.activeSymbol = symbol;
    this.activeTimeframe = timeframe;
    const key = this.key(symbol, timeframe);
    const range = defaultHistoryRange(timeframe, count);
    const instrument = await this.requireInstrument(symbol);
    const data = await invokeTradeLockerMarket<{ candles: Candle[]; code?: string; message?: string }>({
      action: "candles",
      ...this.scope(),
      symbol,
      timeframe,
      tradableInstrumentId: instrument.tradableInstrumentId,
      routeId: instrument.infoRouteId,
      fromMs: range.from * 1000,
      toMs: range.to * 1000,
    });
    const series = data.candles || [];
    this.candles.set(key, series);
    if (data.code === "market_closed" && !series.length) {
      throw new ChartMarketError("market_closed", data.message || "Market is closed for this symbol.");
    }
    return series.map((c) => ({ ...c }));
  }

  async loadMoreCandles(symbol: string, timeframe: ChartTimeframe, beforeTime: number, count = 200): Promise<Candle[]> {
    if (this.loadingMore) return [];
    const key = this.key(symbol, timeframe);
    const existing = this.candles.get(key) || [];
    if (!existing.length) return [];
    this.loadingMore = true;
    try {
      const instrument = await this.requireInstrument(symbol);
      const range = defaultHistoryRange(timeframe, count, beforeTime - 1);
      const data = await invokeTradeLockerMarket<{ candles: Candle[] }>({
        action: "candles",
        ...this.scope(),
        symbol,
        timeframe,
        tradableInstrumentId: instrument.tradableInstrumentId,
        routeId: instrument.infoRouteId,
        fromMs: range.from * 1000,
        toMs: Math.min(range.to, beforeTime) * 1000,
      });
      const older = (data.candles || []).filter((bar) => bar.time < beforeTime);
      if (!older.length) return [];
      const merged = [...older, ...existing];
      const unique = new Map<number, Candle>();
      for (const bar of merged) unique.set(bar.time, bar);
      const next = [...unique.values()].sort((a, b) => a.time - b.time);
      this.candles.set(key, next);
      return older;
    } finally {
      this.loadingMore = false;
    }
  }

  subscribePrice(symbol: string, onTick: (tick: PriceTick) => void): () => void {
    this.activeSymbol = symbol;
    let delay = 1000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stopped) return;
      try {
        const instrument = await this.requireInstrument(symbol);
        const data = await invokeTradeLockerMarket<{ quote: { bid: number; ask: number; last: number; time: number } }>({
          action: "quote",
          ...this.scope(),
          symbol,
          tradableInstrumentId: instrument.tradableInstrumentId,
          routeId: instrument.infoRouteId,
        });
        const quote = data.quote;
        const key = this.key(symbol, this.activeTimeframe);
        const series = this.candles.get(key) || [];
        const last = series[series.length - 1] ?? null;
        const candle = applyQuoteToCandle(last, quote, this.activeTimeframe);
        if (last && last.time === candle.time) {
          series[series.length - 1] = candle;
        } else if (!last || candle.time > last.time) {
          series.push(candle);
        }
        this.candles.set(key, series);
        onTick({
          symbol,
          bid: quote.bid,
          ask: quote.ask,
          last: quote.last,
          time: quote.time,
          candle: { ...candle },
        });
        delay = 1000;
      } catch (error) {
        if (error instanceof ChartMarketError && error.code === "rate_limit") {
          delay = Math.min(delay * 2, 8000);
        }
      } finally {
        if (!stopped) {
          timer = setTimeout(poll, delay);
          this.timers.add(timer as unknown as ReturnType<typeof setInterval>);
        }
      }
    };

    timer = setTimeout(poll, 250);
    this.timers.add(timer as unknown as ReturnType<typeof setInterval>);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  async placeOrder(_order: PlaceOrderRequest): Promise<PlaceOrderResult> {
    throw TRADING_DISABLED;
  }

  async getPositions(): Promise<Position[]> {
    const data = await invokeTradeLockerMarket<{ positions: unknown[] }>({
      action: "positions",
      ...this.scope(),
    });
    return mapBrokerPositions(data.positions || []) as Position[];
  }

  async getOrders(): Promise<PendingOrder[]> {
    const data = await invokeTradeLockerMarket<{ orders: unknown[] }>({
      action: "orders",
      ...this.scope(),
    });
    return mapBrokerOrders(data.orders || []) as PendingOrder[];
  }

  async getHistory(): Promise<HistoryTrade[]> {
    const data = await invokeTradeLockerMarket<{ history: unknown[] }>({
      action: "history",
      ...this.scope(),
    });
    return mapBrokerHistory(data.history || []) as HistoryTrade[];
  }

  async closePosition(): Promise<HistoryTrade | null> {
    throw TRADING_DISABLED;
  }

  async updatePosition(): Promise<Position | null> {
    return null;
  }

  destroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  private scope() {
    return {
      connectionId: this.account.connectionId || "",
      accountId: this.account.accountId,
      accNum: this.account.accNum,
    };
  }

  private key(symbol: string, timeframe: ChartTimeframe) {
    return `${symbol}:${timeframe}`;
  }

  private async requireInstrument(symbol: string): Promise<ChartInstrument> {
    const instruments = await this.getInstruments();
    const match = instruments.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
    if (!match) {
      throw new ChartMarketError("unknown", `Instrument ${symbol} is not available on this account.`);
    }
    return match;
  }
}
