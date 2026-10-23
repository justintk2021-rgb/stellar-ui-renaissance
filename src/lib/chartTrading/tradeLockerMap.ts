import { TIMEFRAME_SECONDS, type Candle, type ChartTimeframe } from "./types";

export const TL_RESOLUTIONS: Record<ChartTimeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1H",
  "4H": "4H",
  "1D": "1D",
};

export type MarketErrorCode =
  | "expired"
  | "rate_limit"
  | "market_closed"
  | "unavailable"
  | "unauthorized"
  | "unknown";

export class ChartMarketError extends Error {
  readonly code: MarketErrorCode;

  constructor(code: MarketErrorCode, message: string) {
    super(message);
    this.name = "ChartMarketError";
    this.code = code;
  }
}

export function classifyMarketError(status: number, body: unknown): ChartMarketError {
  if (body && typeof body === "object" && "code" in body) {
    const code = String((body as { code?: unknown }).code) as MarketErrorCode;
    const message = stringifyError(body);
    if (code === "expired" || code === "rate_limit" || code === "market_closed" || code === "unavailable" || code === "unauthorized") {
      return new ChartMarketError(code, message || "TradeLocker request failed.");
    }
  }
  const text = stringifyError(body);
  const lower = text.toLowerCase();

  if (status === 401 || status === 403 || /expired|reconnect|invalid session|unauthorized|refresh token/.test(lower)) {
    return new ChartMarketError("expired", "Session expired. Reconnect TradeLocker in Settings.");
  }
  if (/failed to send a request to the edge function|unknown action/.test(lower)) {
    return new ChartMarketError(
      "unavailable",
      "Chart market data is not deployed yet. Deploy the latest tradelocker function: supabase functions deploy tradelocker",
    );
  }
  if (status === 429 || /rate limit|too many requests|throttle/.test(lower)) {
    return new ChartMarketError("rate_limit", "TradeLocker rate limit reached. Retrying shortly.");
  }
  if (/market.?closed|not tradable|outside trading/.test(lower)) {
    return new ChartMarketError("market_closed", "Market is closed for this symbol.");
  }
  if (status === 401) {
    return new ChartMarketError("unauthorized", text || "Not authorized.");
  }
  return new ChartMarketError("unknown", text || "TradeLocker request failed.");
}

export function stringifyError(body: unknown): string {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
    if (typeof record.errmsg === "string") return record.errmsg;
    try {
      return JSON.stringify(body);
    } catch {
      return "";
    }
  }
  return String(body);
}

export function alignBarTimeUtc(unixSeconds: number, timeframe: ChartTimeframe): number {
  const step = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(unixSeconds / step) * step;
}

export function defaultHistoryRange(timeframe: ChartTimeframe, count: number, nowSec = Math.floor(Date.now() / 1000)) {
  const step = TIMEFRAME_SECONDS[timeframe];
  const to = alignBarTimeUtc(nowSec, timeframe) + step;
  const from = to - step * Math.max(count, 50);
  return { from, to };
}

export interface RawHistoryBar {
  t?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export function mapHistoryBars(bars: RawHistoryBar[], timeframe: ChartTimeframe): Candle[] {
  const mapped = bars
    .map((bar) => {
      const rawTime = Number(bar.t ?? bar.time);
      if (!Number.isFinite(rawTime)) return null;
      const seconds = rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime);
      const open = Number(bar.o ?? bar.open);
      const high = Number(bar.h ?? bar.high);
      const low = Number(bar.l ?? bar.low);
      const close = Number(bar.c ?? bar.close);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      return {
        time: alignBarTimeUtc(seconds, timeframe),
        open,
        high,
        low,
        close,
        volume: Number(bar.v ?? bar.volume) || 0,
      } satisfies Candle;
    })
    .filter((bar): bar is Candle => Boolean(bar))
    .sort((a, b) => a.time - b.time);

  const unique = new Map<number, Candle>();
  for (const bar of mapped) unique.set(bar.time, bar);
  return [...unique.values()];
}

export function applyQuoteToCandle(
  last: Candle | null,
  quote: { last: number; time?: number },
  timeframe: ChartTimeframe,
): Candle {
  const nowSec = quote.time && quote.time > 0
    ? (quote.time > 1e12 ? Math.floor(quote.time / 1000) : Math.floor(quote.time))
    : Math.floor(Date.now() / 1000);
  const barTime = alignBarTimeUtc(nowSec, timeframe);
  const price = quote.last;

  if (!last || barTime > last.time) {
    return {
      time: barTime,
      open: last && barTime > last.time ? last.close : price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    };
  }

  return {
    ...last,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: price,
  };
}

export function midPrice(bid?: number | null, ask?: number | null, fallback?: number | null): number | null {
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid && ask) return (bid + ask) / 2;
  if (Number.isFinite(ask) && ask) return ask;
  if (Number.isFinite(bid) && bid) return bid;
  if (Number.isFinite(fallback) && fallback) return fallback;
  return null;
}

export function inferPrecision(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s.includes("XAU") || s.includes("XAG")) return 2;
  if (s.includes("NAS") || s.includes("US30") || s.includes("US500") || s.includes("SPX")) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  if (/^[A-Z]{6}$/.test(s)) return 5;
  return 2;
}

export function inferMinMove(precision: number): number {
  return Number((10 ** -precision).toFixed(precision));
}

export function mapRawInstruments(raw: unknown[]): ChartInstrumentLike[] {
  return (raw || []).map((item) => {
    const inst = (item || {}) as Record<string, unknown>;
    const symbol = String(inst.name || inst.symbol || inst.tradableInstrumentId || "");
    const routes = Array.isArray(inst.routes) ? inst.routes as Array<{ id?: number; type?: string }> : [];
    const info = routes.find((route) => String(route.type).toUpperCase() === "INFO") || routes[0];
    const trade = routes.find((route) => String(route.type).toUpperCase() === "TRADE") || routes[0];
    const precision = inferPrecision(symbol);
    return {
      symbol,
      name: String(inst.name || symbol),
      type: String(inst.type || ""),
      tradableInstrumentId: Number(inst.tradableInstrumentId),
      infoRouteId: Number(info?.id),
      tradeRouteId: Number(trade?.id),
      precision,
      minMove: inferMinMove(precision),
    };
  }).filter((inst) => inst.symbol && Number.isFinite(inst.tradableInstrumentId) && Number.isFinite(inst.infoRouteId));
}

export interface ChartInstrumentLike {
  symbol: string;
  name: string;
  type?: string;
  tradableInstrumentId?: number;
  infoRouteId?: number;
  tradeRouteId?: number;
  precision: number;
  minMove: number;
}

export function mapBrokerPositions(raw: unknown[]): Array<{
  id: string;
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  currentPrice: number;
  pnl: number;
  openedAt: number;
}> {
  return (raw || []).map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const side = String(row.side || row.type || "buy").toLowerCase();
    const opened = row.openedAt ?? row.open_time ?? row.openTime;
    return {
      id: String(row.id ?? row.position_id ?? row.positionId ?? ""),
      symbol: String(row.symbol || ""),
      side: side.includes("sell") || side.includes("short") ? "sell" as const : "buy" as const,
      lots: Number(row.lots ?? row.volume ?? row.size ?? row.qty) || 0,
      entryPrice: Number(row.entryPrice ?? row.open_price ?? row.avgPrice) || 0,
      stopLoss: Number.isFinite(Number(row.stopLoss ?? row.stop_loss)) ? Number(row.stopLoss ?? row.stop_loss) : null,
      takeProfit: Number.isFinite(Number(row.takeProfit ?? row.take_profit)) ? Number(row.takeProfit ?? row.take_profit) : null,
      currentPrice: Number(row.currentPrice ?? row.current_price ?? row.entryPrice ?? row.open_price) || 0,
      pnl: Number(row.pnl ?? row.floating_pl ?? row.unrealizedPl) || 0,
      openedAt: opened ? new Date(opened as string | number).getTime() || Number(opened) || Date.now() : Date.now(),
    };
  }).filter((row) => row.id);
}

export function mapBrokerOrders(raw: unknown[]) {
  return (raw || []).map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const type = String(row.type ?? row.order_type ?? "limit").toLowerCase();
    return {
      id: String(row.id ?? row.broker_order_id ?? ""),
      symbol: String(row.symbol || ""),
      side: String(row.side || "buy").toLowerCase() === "sell" ? "sell" as const : "buy" as const,
      type: type.includes("stop") ? "stop" as const : "limit" as const,
      lots: Number(row.lots ?? row.size ?? row.qty) || 0,
      entryPrice: Number(row.entryPrice ?? row.entry_price ?? row.price) || 0,
      stopLoss: Number.isFinite(Number(row.stopLoss ?? row.stop_loss)) ? Number(row.stopLoss ?? row.stop_loss) : null,
      takeProfit: Number.isFinite(Number(row.takeProfit ?? row.take_profit)) ? Number(row.takeProfit ?? row.take_profit) : null,
      createdAt: row.createdAt ?? row.created_broker_at ? new Date(String(row.createdAt ?? row.created_broker_at)).getTime() : Date.now(),
    };
  }).filter((row) => row.id);
}

export function mapBrokerHistory(raw: unknown[]) {
  return (raw || []).map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      symbol: String(row.symbol || ""),
      side: String(row.side || "buy").toLowerCase() === "sell" ? "sell" as const : "buy" as const,
      lots: Number(row.lots ?? row.size) || 0,
      entryPrice: Number(row.entryPrice ?? row.entry_price) || 0,
      exitPrice: Number(row.exitPrice ?? row.exit_price) || 0,
      pnl: Number(row.pnl ?? row.realized_pl) || 0,
      openedAt: row.openedAt ?? row.opened_at ? new Date(String(row.openedAt ?? row.opened_at)).getTime() : Date.now(),
      closedAt: row.closedAt ?? row.closed_at ? new Date(String(row.closedAt ?? row.closed_at)).getTime() : Date.now(),
    };
  }).filter((row) => row.id);
}

export function marketErrorMessage(error: unknown): { code: MarketErrorCode; message: string } {
  if (error instanceof ChartMarketError) {
    return { code: error.code, message: error.message };
  }
  const text = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return classifyMarketError(0, text);
}
