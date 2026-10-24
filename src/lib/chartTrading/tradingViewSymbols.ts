import {
  CHART_SYMBOLS,
  getSymbolSpec,
  type ChartInstrument,
  type ChartTimeframe,
} from "./types";

/**
 * Real-time TradingView symbols only.
 * Forex / metals / indices: OANDA (live). Crypto: BITSTAMP or BINANCE (live).
 */
const REALTIME_SYMBOLS: Record<string, string> = {
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  USDCHF: "OANDA:USDCHF",
  AUDUSD: "OANDA:AUDUSD",
  USDCAD: "OANDA:USDCAD",
  NZDUSD: "OANDA:NZDUSD",
  EURGBP: "OANDA:EURGBP",
  EURJPY: "OANDA:EURJPY",
  EURCHF: "OANDA:EURCHF",
  EURCAD: "OANDA:EURCAD",
  EURAUD: "OANDA:EURAUD",
  EURNZD: "OANDA:EURNZD",
  GBPJPY: "OANDA:GBPJPY",
  GBPCHF: "OANDA:GBPCHF",
  GBPAUD: "OANDA:GBPAUD",
  GBPCAD: "OANDA:GBPCAD",
  AUDJPY: "OANDA:AUDJPY",
  AUDNZD: "OANDA:AUDNZD",
  AUDCAD: "OANDA:AUDCAD",
  CADJPY: "OANDA:CADJPY",
  CHFJPY: "OANDA:CHFJPY",
  NZDJPY: "OANDA:NZDJPY",
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "OANDA:XAGUSD",
  NAS100: "OANDA:NAS100USD",
  NAS100USD: "OANDA:NAS100USD",
  US30: "OANDA:US30USD",
  US30USD: "OANDA:US30USD",
  SPX500: "OANDA:SPX500USD",
  US500: "OANDA:SPX500USD",
  SPX500USD: "OANDA:SPX500USD",
  GER40: "OANDA:DE30EUR",
  GER30: "OANDA:DE30EUR",
  DE30: "OANDA:DE30EUR",
  DE30EUR: "OANDA:DE30EUR",
  UK100: "OANDA:UK100GBP",
  UK100GBP: "OANDA:UK100GBP",
  JP225: "OANDA:JP225USD",
  JPN225: "OANDA:JP225USD",
  JP225USD: "OANDA:JP225USD",
  AU200: "OANDA:AU200AUD",
  AUS200: "OANDA:AU200AUD",
  AU200AUD: "OANDA:AU200AUD",
  BTCUSD: "BITSTAMP:BTCUSD",
  ETHUSD: "BITSTAMP:ETHUSD",
  BTCUSDT: "BINANCE:BTCUSDT",
  ETHUSDT: "BINANCE:ETHUSDT",
  SOLUSDT: "BINANCE:SOLUSDT",
  XRPUSDT: "BINANCE:XRPUSDT",
};

const SYMBOL_ALIASES: Record<string, string> = {
  EURUSDM: "EURUSD",
  GBPUSDM: "GBPUSD",
  XAUUSDM: "XAUUSD",
  GOLD: "XAUUSD",
  SILVER: "XAGUSD",
  NAS100CASH: "NAS100",
  USTEC: "NAS100",
  US100: "NAS100",
  NASDAQ100: "NAS100",
  NDX: "NAS100",
  US30CASH: "US30",
  DJ30: "US30",
  DJI: "US30",
  DOW: "US30",
  WS30: "US30",
  SP500: "SPX500",
  SPX: "SPX500",
  DAX: "GER40",
  DAX40: "GER40",
  FTSE: "UK100",
  UK100CASH: "UK100",
  NI225: "JP225",
  BTC: "BTCUSD",
  BITCOIN: "BTCUSD",
  ETH: "ETHUSD",
  ETHEREUM: "ETHUSD",
};

const CRYPTO_SPOT = /^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|BNB|AVAX|DOT|LINK)/;
const DEFAULT_PICKS = [...CHART_SYMBOLS, "US30"] as const;

export const TRADINGVIEW_INTERVALS: Record<ChartTimeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1H": "60",
  "4H": "240",
  "1D": "D",
};

export const TRADINGVIEW_WIDGET_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export function normalizeChartSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function toTradingViewSymbol(raw: string): string {
  const normalized = normalizeChartSymbol(raw);
  const aliased = SYMBOL_ALIASES[normalized] ?? normalized;
  const mapped = REALTIME_SYMBOLS[aliased] ?? REALTIME_SYMBOLS[normalized];
  if (mapped) return mapped;

  if (normalized.endsWith("USDT")) return `BINANCE:${normalized}`;
  if (normalized.endsWith("USD") && CRYPTO_SPOT.test(normalized)) {
    return `BITSTAMP:${normalized}`;
  }
  if (/^[A-Z]{6}$/.test(normalized)) return `OANDA:${normalized}`;
  return `OANDA:${aliased}`;
}

export function toTradingViewInterval(timeframe: ChartTimeframe): string {
  return TRADINGVIEW_INTERVALS[timeframe];
}

export function getChartTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
  } catch {
    return "Etc/UTC";
  }
}

export function instrumentFromSymbol(symbol: string): ChartInstrument {
  const spec = getSymbolSpec(symbol);
  return {
    symbol,
    name: spec.label,
    precision: spec.precision,
    minMove: spec.minMove,
  };
}

export const DEFAULT_CHART_INSTRUMENTS: ChartInstrument[] = DEFAULT_PICKS.map(instrumentFromSymbol);

export function mergeChartInstruments(accountInstruments: ChartInstrument[]): ChartInstrument[] {
  if (!accountInstruments.length) return DEFAULT_CHART_INSTRUMENTS;
  const seen = new Set<string>();
  const next: ChartInstrument[] = [];
  for (const item of accountInstruments) {
    const key = normalizeChartSymbol(item.symbol);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next.length ? next : DEFAULT_CHART_INSTRUMENTS;
}
