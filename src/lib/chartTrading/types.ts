export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export const CHART_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD",
  "NAS100",
  "BTCUSD",
] as const;
export type ChartSymbol = (typeof CHART_SYMBOLS)[number];

export type OrderType = "market" | "limit" | "stop";
export type OrderSide = "buy" | "sell";
export type BrokerPlatform = "tradelocker" | "mt5" | "mock";
export type AccountEnvironment = "demo" | "live";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceTick {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  time: number;
  candle: Candle;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  lots: number;
  entryPrice?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export interface Position {
  id: string;
  symbol: string;
  side: OrderSide;
  lots: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  currentPrice: number;
  pnl: number;
  openedAt: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: Exclude<OrderType, "market">;
  lots: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  createdAt: number;
}

export interface HistoryTrade {
  id: string;
  symbol: string;
  side: OrderSide;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
}

export interface ChartInstrument {
  symbol: string;
  name: string;
  type?: string;
  tradableInstrumentId?: number;
  infoRouteId?: number;
  tradeRouteId?: number;
  precision: number;
  minMove: number;
}

export interface ChartBrokerAccount {
  id: string;
  label: string;
  platform: BrokerPlatform;
  environment: AccountEnvironment;
  accountNumber: string;
  brokerName: string;
  connectionId?: string | null;
  accountId?: string | null;
  accNum?: number | null;
}

export interface PlaceOrderResult {
  position?: Position;
  order?: PendingOrder;
}

export interface BrokerAdapter {
  id: string;
  account: ChartBrokerAccount;
  readonly supportsTrading: boolean;
  readonly supportsMarketData: boolean;
  getInstruments(): Promise<ChartInstrument[]>;
  getCandles(symbol: string, timeframe: ChartTimeframe, count?: number): Promise<Candle[]>;
  loadMoreCandles(symbol: string, timeframe: ChartTimeframe, beforeTime: number, count?: number): Promise<Candle[]>;
  subscribePrice(symbol: string, onTick: (tick: PriceTick) => void): () => void;
  placeOrder(order: PlaceOrderRequest): Promise<PlaceOrderResult>;
  getPositions(): Promise<Position[]>;
  getOrders(): Promise<PendingOrder[]>;
  getHistory(): Promise<HistoryTrade[]>;
  closePosition(id: string): Promise<HistoryTrade | null>;
  updatePosition(
    id: string,
    patch: { stopLoss?: number | null; takeProfit?: number | null },
  ): Promise<Position | null>;
  destroy(): void;
}

export interface SymbolSpec {
  symbol: ChartSymbol;
  label: string;
  precision: number;
  minMove: number;
  pipSize: number;
  contractSize: number;
  basePrice: number;
  volatility: number;
  spread: number;
}

export const SYMBOL_SPECS: Record<ChartSymbol, SymbolSpec> = {
  EURUSD: {
    symbol: "EURUSD",
    label: "EUR/USD",
    precision: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100_000,
    basePrice: 1.0842,
    volatility: 0.00028,
    spread: 0.00008,
  },
  GBPUSD: {
    symbol: "GBPUSD",
    label: "GBP/USD",
    precision: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100_000,
    basePrice: 1.2715,
    volatility: 0.00034,
    spread: 0.0001,
  },
  USDJPY: {
    symbol: "USDJPY",
    label: "USD/JPY",
    precision: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 100_000,
    basePrice: 149.62,
    volatility: 0.045,
    spread: 0.012,
  },
  XAUUSD: {
    symbol: "XAUUSD",
    label: "XAU/USD",
    precision: 2,
    minMove: 0.01,
    pipSize: 0.1,
    contractSize: 100,
    basePrice: 2384.5,
    volatility: 1.85,
    spread: 0.18,
  },
  NAS100: {
    symbol: "NAS100",
    label: "NAS100",
    precision: 1,
    minMove: 0.1,
    pipSize: 1,
    contractSize: 1,
    basePrice: 20140,
    volatility: 28,
    spread: 1.2,
  },
  BTCUSD: {
    symbol: "BTCUSD",
    label: "BTC/USD",
    precision: 1,
    minMove: 0.1,
    pipSize: 1,
    contractSize: 1,
    basePrice: 67240,
    volatility: 180,
    spread: 12,
  },
};

export const TIMEFRAME_SECONDS: Record<ChartTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
};

export function isChartSymbol(value: string): value is ChartSymbol {
  return (CHART_SYMBOLS as readonly string[]).includes(value);
}

export function getSymbolSpec(symbol: string): SymbolSpec {
  if (isChartSymbol(symbol)) return SYMBOL_SPECS[symbol];
  const precision = symbol.toUpperCase().includes("JPY")
    ? 3
    : symbol.toUpperCase().includes("XAU") || symbol.toUpperCase().includes("XAG")
      ? 2
      : /^[A-Z]{6}$/.test(symbol.toUpperCase())
        ? 5
        : 2;
  const minMove = Number((10 ** -precision).toFixed(precision));
  return {
    symbol: "EURUSD",
    label: symbol,
    precision,
    minMove,
    pipSize: minMove * 10,
    contractSize: 1,
    basePrice: 0,
    volatility: minMove,
    spread: minMove,
  };
}

export function positionPnl(side: OrderSide, entry: number, current: number, lots: number, symbol: string): number {
  const spec = getSymbolSpec(symbol);
  const dir = side === "buy" ? 1 : -1;
  return (current - entry) * dir * lots * spec.contractSize;
}

export function riskPreview(entry: number, stopLoss: number | null, lots: number, symbol: string): number | null {
  if (stopLoss == null || !Number.isFinite(stopLoss) || !Number.isFinite(entry) || lots <= 0) return null;
  const spec = getSymbolSpec(symbol);
  return Math.abs(entry - stopLoss) * lots * spec.contractSize;
}

export function formatPrice(value: number, symbol: string): string {
  const spec = getSymbolSpec(symbol);
  return value.toFixed(spec.precision);
}

export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}$${formatted}`;
}

export function platformLabel(platform: BrokerPlatform): string {
  if (platform === "tradelocker") return "TradeLocker";
  if (platform === "mt5") return "MT5";
  return "Broker";
}
