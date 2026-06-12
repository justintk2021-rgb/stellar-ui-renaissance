/**
 * Position-sizing engine: instrument catalog + universal lot-size math.
 *
 * Core model (works for every asset class):
 *   P&L per lot = contractSize × Δprice   (denominated in the QUOTE currency)
 *   Pip value (USD) = contractSize × pipSize × quote→USD
 *   Lot size = Risk (USD) ÷ (SL in pips × pip value per lot)
 *
 * Quote currencies are converted to USD with live FX rates, so pairs like
 * USD/JPY, EUR/GBP, GER40 (EUR) or JPN225 (JPY) stay accurate as rates move.
 * Futures use fixed exchange-defined tick values instead.
 *
 * Synthetic (Deriv) contract sizes and minimum lots verified against
 * https://trade.deriv.me/trading-specifications (all contract size 1, USD).
 */

export type InstrumentCategory =
  | "forex"
  | "crypto"
  | "commodities"
  | "indices"
  | "synthetic"
  | "stocks"
  | "futures";

export interface InstrumentSpec {
  symbol: string;
  name: string;
  category: InstrumentCategory;
  /** Units per 1.0 lot. */
  contractSize: number;
  /** Price movement that equals 1 pip / 1 point for this instrument. */
  pipSize: number;
  /** Quote currency the P&L is denominated in before USD conversion. */
  quote: string;
  /** Base currency (forex only — used to derive a live price). */
  base?: string;
  /** Fixed USD value of one pip per contract (futures only). */
  pipValueUSDOverride?: number;
  /** Broker minimum lot. */
  minLot?: number;
  /** Volume step for rounding. */
  lotStep?: number;
  /** Binance ticker for live price (crypto only). */
  binanceSymbol?: string;
  /** Preferred stop-loss entry mode. */
  defaultSlMode?: "pips" | "price";
}

const FX = (
  symbol: string,
  name: string,
  opts: Partial<InstrumentSpec> = {},
): InstrumentSpec => {
  const [base, quote] = symbol.split("/");
  return {
    symbol,
    name,
    category: "forex",
    contractSize: 100_000,
    pipSize: quote === "JPY" ? 0.01 : 0.0001,
    quote,
    base,
    minLot: 0.01,
    lotStep: 0.01,
    ...opts,
  };
};

const SYN = (
  symbol: string,
  name: string,
  pipSize: number,
  minLot: number,
  lotStep?: number,
): InstrumentSpec => ({
  symbol,
  name,
  category: "synthetic",
  contractSize: 1,
  pipSize,
  quote: "USD",
  minLot,
  lotStep: lotStep ?? (minLot < 0.01 ? minLot : 0.01),
  defaultSlMode: "price",
});

export const INSTRUMENTS: InstrumentSpec[] = [
  /* ---------- Forex majors ---------- */
  FX("EUR/USD", "Euro / US Dollar"),
  FX("GBP/USD", "British Pound / US Dollar"),
  FX("USD/JPY", "US Dollar / Japanese Yen"),
  FX("USD/CHF", "US Dollar / Swiss Franc"),
  FX("AUD/USD", "Australian Dollar / US Dollar"),
  FX("USD/CAD", "US Dollar / Canadian Dollar"),
  FX("NZD/USD", "New Zealand Dollar / US Dollar"),
  /* ---------- Crosses ---------- */
  FX("EUR/GBP", "Euro / British Pound"),
  FX("EUR/JPY", "Euro / Japanese Yen"),
  FX("EUR/AUD", "Euro / Australian Dollar"),
  FX("EUR/CAD", "Euro / Canadian Dollar"),
  FX("EUR/CHF", "Euro / Swiss Franc"),
  FX("EUR/NZD", "Euro / New Zealand Dollar"),
  FX("GBP/JPY", "British Pound / Japanese Yen"),
  FX("GBP/AUD", "British Pound / Australian Dollar"),
  FX("GBP/CAD", "British Pound / Canadian Dollar"),
  FX("GBP/CHF", "British Pound / Swiss Franc"),
  FX("GBP/NZD", "British Pound / New Zealand Dollar"),
  FX("AUD/CAD", "Australian Dollar / Canadian Dollar"),
  FX("AUD/CHF", "Australian Dollar / Swiss Franc"),
  FX("AUD/JPY", "Australian Dollar / Japanese Yen"),
  FX("AUD/NZD", "Australian Dollar / New Zealand Dollar"),
  FX("CAD/CHF", "Canadian Dollar / Swiss Franc"),
  FX("CAD/JPY", "Canadian Dollar / Japanese Yen"),
  FX("CHF/JPY", "Swiss Franc / Japanese Yen"),
  FX("NZD/CAD", "New Zealand Dollar / Canadian Dollar"),
  FX("NZD/CHF", "New Zealand Dollar / Swiss Franc"),
  FX("NZD/JPY", "New Zealand Dollar / Japanese Yen"),
  /* ---------- Exotics ---------- */
  FX("USD/MXN", "US Dollar / Mexican Peso"),
  FX("USD/ZAR", "US Dollar / South African Rand"),
  FX("USD/SGD", "US Dollar / Singapore Dollar"),
  FX("USD/HKD", "US Dollar / Hong Kong Dollar"),
  FX("USD/TRY", "US Dollar / Turkish Lira"),
  FX("USD/SEK", "US Dollar / Swedish Krona"),
  FX("USD/NOK", "US Dollar / Norwegian Krone"),
  FX("USD/DKK", "US Dollar / Danish Krone"),
  FX("USD/PLN", "US Dollar / Polish Zloty"),
  FX("USD/CNH", "US Dollar / Chinese Yuan Offshore", { quote: "CNY" }),
  FX("EUR/TRY", "Euro / Turkish Lira"),
  FX("EUR/SEK", "Euro / Swedish Krona"),
  FX("EUR/NOK", "Euro / Norwegian Krone"),
  FX("EUR/PLN", "Euro / Polish Zloty"),
  FX("EUR/ZAR", "Euro / South African Rand"),
  FX("GBP/ZAR", "British Pound / South African Rand"),

  /* ---------- Crypto (CFD: 1 coin per lot, quoted in USD) ---------- */
  { symbol: "BTC/USD", name: "Bitcoin", category: "crypto", contractSize: 1, pipSize: 1, quote: "USD", minLot: 0.01, lotStep: 0.01, binanceSymbol: "BTCUSDT", defaultSlMode: "price" },
  { symbol: "ETH/USD", name: "Ethereum", category: "crypto", contractSize: 1, pipSize: 0.1, quote: "USD", minLot: 0.01, lotStep: 0.01, binanceSymbol: "ETHUSDT", defaultSlMode: "price" },
  { symbol: "SOL/USD", name: "Solana", category: "crypto", contractSize: 1, pipSize: 0.01, quote: "USD", minLot: 0.1, lotStep: 0.1, binanceSymbol: "SOLUSDT", defaultSlMode: "price" },
  { symbol: "XRP/USD", name: "Ripple", category: "crypto", contractSize: 1, pipSize: 0.0001, quote: "USD", minLot: 1, lotStep: 1, binanceSymbol: "XRPUSDT", defaultSlMode: "price" },
  { symbol: "LTC/USD", name: "Litecoin", category: "crypto", contractSize: 1, pipSize: 0.01, quote: "USD", minLot: 0.1, lotStep: 0.1, binanceSymbol: "LTCUSDT", defaultSlMode: "price" },
  { symbol: "ADA/USD", name: "Cardano", category: "crypto", contractSize: 1, pipSize: 0.0001, quote: "USD", minLot: 1, lotStep: 1, binanceSymbol: "ADAUSDT", defaultSlMode: "price" },
  { symbol: "DOGE/USD", name: "Dogecoin", category: "crypto", contractSize: 1, pipSize: 0.0001, quote: "USD", minLot: 1, lotStep: 1, binanceSymbol: "DOGEUSDT", defaultSlMode: "price" },
  { symbol: "BNB/USD", name: "BNB", category: "crypto", contractSize: 1, pipSize: 0.01, quote: "USD", minLot: 0.1, lotStep: 0.1, binanceSymbol: "BNBUSDT", defaultSlMode: "price" },
  { symbol: "AVAX/USD", name: "Avalanche", category: "crypto", contractSize: 1, pipSize: 0.01, quote: "USD", minLot: 0.1, lotStep: 0.1, binanceSymbol: "AVAXUSDT", defaultSlMode: "price" },
  { symbol: "DOT/USD", name: "Polkadot", category: "crypto", contractSize: 1, pipSize: 0.001, quote: "USD", minLot: 1, lotStep: 1, binanceSymbol: "DOTUSDT", defaultSlMode: "price" },

  /* ---------- Commodities (typical MT4/MT5 CFD specs) ---------- */
  { symbol: "XAU/USD", name: "Gold (100 oz/lot)", category: "commodities", contractSize: 100, pipSize: 0.1, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "XAG/USD", name: "Silver (5,000 oz/lot)", category: "commodities", contractSize: 5000, pipSize: 0.01, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "XPT/USD", name: "Platinum (100 oz/lot)", category: "commodities", contractSize: 100, pipSize: 0.1, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "XPD/USD", name: "Palladium (100 oz/lot)", category: "commodities", contractSize: 100, pipSize: 0.1, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "USOIL", name: "WTI Crude (1,000 bbl/lot)", category: "commodities", contractSize: 1000, pipSize: 0.01, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "UKOIL", name: "Brent Crude (1,000 bbl/lot)", category: "commodities", contractSize: 1000, pipSize: 0.01, quote: "USD", minLot: 0.01, lotStep: 0.01 },
  { symbol: "NATGAS", name: "Natural Gas (10,000 MMBtu/lot)", category: "commodities", contractSize: 10_000, pipSize: 0.001, quote: "USD", minLot: 0.01, lotStep: 0.01 },

  /* ---------- Index CFDs (contract size 1, quoted in local currency) ---------- */
  { symbol: "US500", name: "S&P 500", category: "indices", contractSize: 1, pipSize: 1, quote: "USD", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "US100", name: "NASDAQ 100", category: "indices", contractSize: 1, pipSize: 1, quote: "USD", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "US30", name: "Dow Jones 30", category: "indices", contractSize: 1, pipSize: 1, quote: "USD", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "UK100", name: "FTSE 100", category: "indices", contractSize: 1, pipSize: 1, quote: "GBP", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "GER40", name: "DAX 40", category: "indices", contractSize: 1, pipSize: 1, quote: "EUR", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "FRA40", name: "CAC 40", category: "indices", contractSize: 1, pipSize: 1, quote: "EUR", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "EU50", name: "Euro Stoxx 50", category: "indices", contractSize: 1, pipSize: 1, quote: "EUR", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "JPN225", name: "Nikkei 225", category: "indices", contractSize: 1, pipSize: 1, quote: "JPY", minLot: 1, lotStep: 1, defaultSlMode: "price" },
  { symbol: "AUS200", name: "ASX 200", category: "indices", contractSize: 1, pipSize: 1, quote: "AUD", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "HK50", name: "Hang Seng 50", category: "indices", contractSize: 1, pipSize: 1, quote: "HKD", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "NETH25", name: "Netherlands 25", category: "indices", contractSize: 1, pipSize: 1, quote: "EUR", minLot: 0.1, lotStep: 0.1, defaultSlMode: "price" },
  { symbol: "DXY", name: "US Dollar Index", category: "indices", contractSize: 1, pipSize: 0.01, quote: "USD", minLot: 1, lotStep: 1, defaultSlMode: "price" },

  /* ---------- Deriv synthetics (contract size 1, USD — official specs) ---------- */
  SYN("V10", "Volatility 10 Index", 0.001, 0.5),
  SYN("V10(1s)", "Volatility 10 (1s) Index", 0.01, 0.5),
  SYN("V25", "Volatility 25 Index", 0.001, 0.5),
  SYN("V25(1s)", "Volatility 25 (1s) Index", 0.01, 0.005),
  SYN("V50", "Volatility 50 Index", 0.0001, 4),
  SYN("V50(1s)", "Volatility 50 (1s) Index", 0.01, 0.005),
  SYN("V75", "Volatility 75 Index", 0.01, 0.001),
  SYN("V75(1s)", "Volatility 75 (1s) Index", 0.01, 0.05),
  SYN("V100", "Volatility 100 Index", 0.01, 0.5),
  SYN("V100(1s)", "Volatility 100 (1s) Index", 0.01, 0.2),
  SYN("V150(1s)", "Volatility 150 (1s) Index", 0.01, 0.1),
  SYN("V250(1s)", "Volatility 250 (1s) Index", 0.01, 0.5),
  SYN("BOOM300", "Boom 300 Index", 0.001, 1),
  SYN("BOOM500", "Boom 500 Index", 0.001, 0.2),
  SYN("BOOM1000", "Boom 1000 Index", 0.0001, 0.2),
  SYN("CRASH300", "Crash 300 Index", 0.0001, 0.5),
  SYN("CRASH500", "Crash 500 Index", 0.001, 0.2),
  SYN("CRASH1000", "Crash 1000 Index", 0.0001, 0.2),
  SYN("STEP", "Step Index", 0.1, 0.1),
  SYN("RB100", "Range Break 100 Index", 0.01, 0.01),
  SYN("RB200", "Range Break 200 Index", 0.01, 0.01),
  SYN("JUMP10", "Jump 10 Index", 0.01, 0.01),
  SYN("JUMP25", "Jump 25 Index", 0.01, 0.01),
  SYN("JUMP50", "Jump 50 Index", 0.01, 0.01),
  SYN("JUMP75", "Jump 75 Index", 0.01, 0.01),
  SYN("JUMP100", "Jump 100 Index", 0.01, 0.01),

  /* ---------- Stocks (CFD: 1 share per lot) ---------- */
  ...[
    ["AAPL", "Apple Inc."], ["MSFT", "Microsoft Corporation"], ["GOOGL", "Alphabet Inc."],
    ["AMZN", "Amazon.com Inc."], ["TSLA", "Tesla Inc."], ["META", "Meta Platforms Inc."],
    ["NVDA", "NVIDIA Corporation"], ["AMD", "Advanced Micro Devices"], ["NFLX", "Netflix Inc."],
    ["DIS", "Walt Disney Company"], ["BA", "Boeing Company"], ["JPM", "JPMorgan Chase & Co."],
    ["V", "Visa Inc."], ["MA", "Mastercard Inc."], ["KO", "Coca-Cola Company"],
  ].map(([symbol, name]): InstrumentSpec => ({
    symbol, name, category: "stocks", contractSize: 1, pipSize: 0.01, quote: "USD",
    minLot: 1, lotStep: 1, defaultSlMode: "price",
  })),

  /* ---------- Futures (fixed exchange tick values) ---------- */
  { symbol: "ES", name: "E-mini S&P 500", category: "futures", contractSize: 50, pipSize: 0.25, quote: "USD", pipValueUSDOverride: 12.5, minLot: 1, lotStep: 1 },
  { symbol: "NQ", name: "E-mini NASDAQ 100", category: "futures", contractSize: 20, pipSize: 0.25, quote: "USD", pipValueUSDOverride: 5, minLot: 1, lotStep: 1 },
  { symbol: "YM", name: "E-mini Dow Jones", category: "futures", contractSize: 5, pipSize: 1, quote: "USD", pipValueUSDOverride: 5, minLot: 1, lotStep: 1 },
  { symbol: "RTY", name: "E-mini Russell 2000", category: "futures", contractSize: 50, pipSize: 0.1, quote: "USD", pipValueUSDOverride: 5, minLot: 1, lotStep: 1 },
  { symbol: "GC", name: "Gold Futures", category: "futures", contractSize: 100, pipSize: 0.1, quote: "USD", pipValueUSDOverride: 10, minLot: 1, lotStep: 1 },
  { symbol: "SI", name: "Silver Futures", category: "futures", contractSize: 5000, pipSize: 0.005, quote: "USD", pipValueUSDOverride: 25, minLot: 1, lotStep: 1 },
  { symbol: "CL", name: "Crude Oil WTI", category: "futures", contractSize: 1000, pipSize: 0.01, quote: "USD", pipValueUSDOverride: 10, minLot: 1, lotStep: 1 },
  { symbol: "NG", name: "Natural Gas", category: "futures", contractSize: 10_000, pipSize: 0.001, quote: "USD", pipValueUSDOverride: 10, minLot: 1, lotStep: 1 },
  { symbol: "ZB", name: "30-Year T-Bond", category: "futures", contractSize: 1, pipSize: 0.03125, quote: "USD", pipValueUSDOverride: 31.25, minLot: 1, lotStep: 1 },
  { symbol: "ZN", name: "10-Year T-Note", category: "futures", contractSize: 1, pipSize: 0.015625, quote: "USD", pipValueUSDOverride: 15.625, minLot: 1, lotStep: 1 },
  { symbol: "6E", name: "Euro FX Futures", category: "futures", contractSize: 125_000, pipSize: 0.0001, quote: "USD", pipValueUSDOverride: 12.5, minLot: 1, lotStep: 1 },
  { symbol: "6B", name: "British Pound Futures", category: "futures", contractSize: 62_500, pipSize: 0.0001, quote: "USD", pipValueUSDOverride: 6.25, minLot: 1, lotStep: 1 },
  { symbol: "MES", name: "Micro E-mini S&P 500", category: "futures", contractSize: 5, pipSize: 0.25, quote: "USD", pipValueUSDOverride: 1.25, minLot: 1, lotStep: 1 },
  { symbol: "MNQ", name: "Micro E-mini NASDAQ", category: "futures", contractSize: 2, pipSize: 0.25, quote: "USD", pipValueUSDOverride: 0.5, minLot: 1, lotStep: 1 },
  { symbol: "MGC", name: "Micro Gold Futures", category: "futures", contractSize: 10, pipSize: 0.1, quote: "USD", pipValueUSDOverride: 1, minLot: 1, lotStep: 1 },
];

/* ------------------------ Chart symbol matching ------------------------ */

/** Common TradingView / broker tickers mapped to catalog symbols. */
const SYMBOL_ALIASES: Record<string, string> = {
  GOLD: "XAU/USD",
  SILVER: "XAG/USD",
  SPX: "US500", SPX500: "US500", SPX500USD: "US500", SP500: "US500", US500CASH: "US500",
  NDX: "US100", NAS100: "US100", NAS100USD: "US100", USTEC: "US100", USTECH: "US100",
  DJI: "US30", DJ30: "US30", US30CASH: "US30", WS30: "US30",
  DAX: "GER40", DE40: "GER40", GER30: "GER40", GER40CASH: "GER40",
  FTSE: "UK100", FTSE100: "UK100", UK100CASH: "UK100",
  CAC40: "FRA40", FR40: "FRA40",
  STOXX50: "EU50", SX5E: "EU50",
  JP225: "JPN225", NI225: "JPN225", NIKKEI: "JPN225",
  ASX200: "AUS200", AU200: "AUS200",
  HSI: "HK50", HK33: "HK50",
  WTIUSD: "USOIL", XTIUSD: "USOIL", USOILSPOT: "USOIL", CRUDEOIL: "USOIL", WTICOUSD: "USOIL",
  XBRUSD: "UKOIL", BRENT: "UKOIL", BCOUSD: "UKOIL",
  NATGASUSD: "NATGAS", NGAS: "NATGAS", XNGUSD: "NATGAS",
};

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Match a raw chart ticker (e.g. "OANDA:EURUSD", "BTCUSDT", "XAUUSD")
 * to an instrument in the catalog. Returns null when nothing matches.
 */
export function findInstrumentForChartSymbol(raw: string | null | undefined): InstrumentSpec | null {
  if (!raw) return null;
  let s = raw.trim();
  const colon = s.lastIndexOf(":");
  if (colon >= 0) s = s.slice(colon + 1); // strip exchange prefix
  const norm = normalize(s);
  if (!norm) return null;

  const candidates = [norm];
  if (norm.endsWith("USDT")) candidates.push(norm.slice(0, -1)); // BTCUSDT → BTCUSD

  for (const cand of candidates) {
    const alias = SYMBOL_ALIASES[cand];
    if (alias) {
      const hit = INSTRUMENTS.find((i) => i.symbol === alias);
      if (hit) return hit;
    }
    const direct = INSTRUMENTS.find((i) => normalize(i.symbol) === cand);
    if (direct) return direct;
  }
  return null;
}

/* ----------------------------- FX conversion ----------------------------- */

/** Static fallback (approximate) used only when the live feed is unavailable. */
export const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, CAD: 1.36, AUD: 1.52,
  NZD: 1.64, MXN: 18.5, ZAR: 18.2, SGD: 1.34, HKD: 7.8, TRY: 35, SEK: 10.5,
  NOK: 10.8, DKK: 6.9, PLN: 4.0, CNY: 7.2,
};

/** USD value of 1 unit of `currency`, given a USD-based rate table (USD→X). */
export function currencyToUsd(currency: string, usdRates: Record<string, number>): number {
  if (currency === "USD") return 1;
  const rate = usdRates[currency] ?? FALLBACK_USD_RATES[currency];
  return rate && rate > 0 ? 1 / rate : 1;
}

/** Live price of a forex pair derived from the USD-based table. */
export function forexPairPrice(
  spec: InstrumentSpec,
  usdRates: Record<string, number>,
): number | null {
  if (!spec.base) return null;
  const baseRate = spec.base === "USD" ? 1 : usdRates[spec.base];
  const quoteRate = spec.quote === "USD" ? 1 : usdRates[spec.quote];
  if (!baseRate || !quoteRate) return null;
  return quoteRate / baseRate;
}

/* ----------------------------- Lot-size math ----------------------------- */

export interface LotSizeInput {
  spec: InstrumentSpec;
  riskUSD: number;
  /** Stop-loss distance, meaning depends on slMode. */
  stopLoss: number;
  slMode: "pips" | "price";
  usdRates: Record<string, number>;
  /** Manual overrides (the calculator's "custom values" toggle). */
  customPipValueUSD?: number;
  customContractSize?: number;
}

export interface LotSizeResult {
  /** USD value of 1 pip for 1.0 lot. */
  pipValueUSD: number;
  /** Stop-loss expressed in pips. */
  slPips: number;
  /** Raw (unrounded) lot size from the risk formula. */
  rawLots: number;
  /** Risk-safe lots: rounded DOWN to the volume step. */
  lots: number;
  /** True when rawLots > 0 but below the broker minimum. */
  belowMinimum: boolean;
  minLot: number;
  lotStep: number;
  /** USD actually at risk with the rounded lots. */
  actualRiskUSD: number;
  /** lots × contract size. */
  positionUnits: number;
  contractSize: number;
}

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  // Floor to step with float-noise guard so risk never exceeds the target.
  const steps = Math.floor(value / step + 1e-9);
  const result = steps * step;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
  return Number(result.toFixed(decimals));
}

export function computeLotSize(input: LotSizeInput): LotSizeResult {
  const { spec, riskUSD, stopLoss, slMode, usdRates } = input;

  const contractSize = input.customContractSize ?? spec.contractSize;
  const pipValueUSD =
    input.customPipValueUSD ??
    (spec.pipValueUSDOverride !== undefined
      ? spec.pipValueUSDOverride
      : contractSize * spec.pipSize * currencyToUsd(spec.quote, usdRates));

  const slPips = slMode === "price" ? stopLoss / spec.pipSize : stopLoss;

  const rawLots = slPips > 0 && pipValueUSD > 0 ? riskUSD / (slPips * pipValueUSD) : 0;

  const minLot = spec.minLot ?? 0.01;
  const lotStep = spec.lotStep ?? 0.01;

  const rounded = roundToStep(rawLots, lotStep);
  const belowMinimum = rawLots > 0 && rounded < minLot;
  const lots = belowMinimum ? minLot : rounded;

  return {
    pipValueUSD,
    slPips,
    rawLots,
    lots: Math.max(0, lots),
    belowMinimum,
    minLot,
    lotStep,
    actualRiskUSD: Math.max(0, lots * slPips * pipValueUSD),
    positionUnits: Math.max(0, lots * contractSize),
    contractSize,
  };
}

/* ----------------------------- Labels ----------------------------- */

export function unitLabel(category: InstrumentCategory): string {
  switch (category) {
    case "stocks": return "shares";
    case "futures": return "contracts";
    default: return "lots";
  }
}

export function pipLabel(category: InstrumentCategory): string {
  switch (category) {
    case "forex":
    case "commodities":
      return "pips";
    case "futures": return "ticks";
    default: return "points";
  }
}
