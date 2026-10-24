import { invokeTradeLockerMarket } from "./marketClient";
import {
  ChartMarketError,
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

  async getCandles(_symbol: string, _timeframe: ChartTimeframe, _count?: number): Promise<Candle[]> {
    return [];
  }

  async loadMoreCandles(
    _symbol: string,
    _timeframe: ChartTimeframe,
    _beforeTime: number,
    _count?: number,
  ): Promise<Candle[]> {
    return [];
  }

  subscribePrice(_symbol: string, _onTick: (tick: PriceTick) => void): () => void {
    return () => undefined;
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

  destroy(): void {}

  private scope() {
    return {
      connectionId: this.account.connectionId || "",
      accountId: this.account.accountId,
      accNum: this.account.accNum,
    };
  }
}
