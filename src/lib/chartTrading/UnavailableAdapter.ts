import { ChartMarketError } from "./tradeLockerMap";
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

export class UnavailableAdapter implements BrokerAdapter {
  readonly id: string;
  readonly account: ChartBrokerAccount;
  readonly supportsTrading = false;
  readonly supportsMarketData = false;

  constructor(account: ChartBrokerAccount) {
    this.id = account.id;
    this.account = account;
  }

  async getInstruments(): Promise<ChartInstrument[]> {
    throw this.unavailable();
  }

  async getCandles(): Promise<Candle[]> {
    throw this.unavailable();
  }

  async loadMoreCandles(): Promise<Candle[]> {
    return [];
  }

  subscribePrice(_symbol: string, _onTick: (tick: PriceTick) => void): () => void {
    return () => undefined;
  }

  async placeOrder(_order: PlaceOrderRequest): Promise<PlaceOrderResult> {
    throw this.unavailable();
  }

  async getPositions(): Promise<Position[]> {
    return [];
  }

  async getOrders(): Promise<PendingOrder[]> {
    return [];
  }

  async getHistory(): Promise<HistoryTrade[]> {
    return [];
  }

  async closePosition(): Promise<HistoryTrade | null> {
    return null;
  }

  async updatePosition(): Promise<Position | null> {
    return null;
  }

  destroy(): void {}

  private unavailable() {
    return new ChartMarketError("unavailable", "Chart data not available for this broker yet");
  }
}
