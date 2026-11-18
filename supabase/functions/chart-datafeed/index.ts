import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Candle datafeed for chart pages (Lightweight Charts / TV JS API).
 *
 * Routes:
 *   GET ?action=config
 *   GET ?action=symbols&symbol=BTCUSD
 *   GET ?action=search&query=eur
 *   GET ?action=history&symbol=...&resolution=...&from=...&to=...
 *
 * Live sources (in order):
 *   1) FOREX.com / City Index CIAPI when FOREXCOM_* secrets are set (forex / metals / stocks)
 *   2) OANDA v20 when OANDA_API_TOKEN is set
 *   3) Twelve Data when TWELVEDATA_API_KEY is set
 *   4) Yahoo Finance public chart API (no key) — always available fallback
 *   Crypto: Binance first, then Yahoo
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ----------------------------- Symbol routing ----------------------------- */

const CRYPTO_QUOTES = ["USDT", "USDC", "BTC", "ETH", "BNB"];
const KNOWN_CRYPTO_BASES = [
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LTC", "BCH", "LINK", "BNB",
];

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isCryptoSymbol(symbol: string): boolean {
  const s = normalizeSymbol(symbol);
  if (CRYPTO_QUOTES.some((q) => s.endsWith(q) && s.length > q.length)) return true;
  if (s.endsWith("USD") && KNOWN_CRYPTO_BASES.includes(s.slice(0, -3))) return true;
  return false;
}

/** BTCUSD → BTCUSDT for Binance spot. */
function toBinanceSymbol(symbol: string): string {
  const s = normalizeSymbol(symbol);
  if (s.endsWith("USD") && !s.endsWith("USDT")) return `${s}T`;
  return s;
}

/** EURUSD → EUR/USD for Twelve Data. */
function toTwelveDataSymbol(symbol: string): string {
  const s = normalizeSymbol(symbol);
  if (s === "XAUUSD") return "XAU/USD";
  if (s === "XAGUSD") return "XAG/USD";
  if (s === "NAS100" || s === "NAS100USD" || s === "USTEC") return "NDX";
  if (s === "US30" || s === "US30USD") return "DJI";
  if (s === "SPX500" || s === "US500" || s === "SPX500USD") return "SPX";
  if (/^[A-Z]{6}$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3)}`;
  return symbol.toUpperCase();
}

/** EURUSD → EUR_USD for OANDA. */
function toOandaInstrument(symbol: string): string {
  const s = normalizeSymbol(symbol);
  const aliases: Record<string, string> = {
    XAUUSD: "XAU_USD",
    XAGUSD: "XAG_USD",
    NAS100: "NAS100_USD",
    NAS100USD: "NAS100_USD",
    USTEC: "NAS100_USD",
    US30: "US30_USD",
    US30USD: "US30_USD",
    SPX500: "SPX500_USD",
    US500: "SPX500_USD",
    SPX500USD: "SPX500_USD",
    GER40: "DE30_EUR",
    GER30: "DE30_EUR",
    DE30: "DE30_EUR",
    DE30EUR: "DE30_EUR",
    UK100: "UK100_GBP",
    UK100GBP: "UK100_GBP",
    JP225: "JP225_USD",
    JPN225: "JP225_USD",
  };
  if (aliases[s]) return aliases[s];
  if (/^[A-Z]{6}$/.test(s)) return `${s.slice(0, 3)}_${s.slice(3)}`;
  return s;
}

/** Map app symbols onto Yahoo Finance tickers. */
function toYahooSymbol(symbol: string): string {
  const s = normalizeSymbol(symbol);
  const aliases: Record<string, string> = {
    XAUUSD: "GC=F",
    GOLD: "GC=F",
    XAGUSD: "SI=F",
    SILVER: "SI=F",
    NAS100: "NQ=F",
    NAS100USD: "NQ=F",
    USTEC: "NQ=F",
    US30: "YM=F",
    US30USD: "YM=F",
    SPX500: "ES=F",
    US500: "ES=F",
    SPX500USD: "ES=F",
    BTCUSD: "BTC-USD",
    ETHUSD: "ETH-USD",
    SOLUSD: "SOL-USD",
    XRPUSD: "XRP-USD",
  };
  if (aliases[s]) return aliases[s];
  if (isCryptoSymbol(s) && s.endsWith("USD")) return `${s.slice(0, -3)}-USD`;
  if (/^[A-Z]{6}$/.test(s)) return `${s}=X`;
  return `${s}=X`;
}

/* ----------------------------- Resolutions ----------------------------- */

const BINANCE_INTERVALS: Record<string, string> = {
  "1": "1m", "5": "5m", "15": "15m", "30": "30m", "60": "1h", "240": "4h",
  "1D": "1d", "D": "1d", "1W": "1w", "W": "1w", "1M": "1M", "M": "1M",
};

const TWELVEDATA_INTERVALS: Record<string, string> = {
  "1": "1min", "5": "5min", "15": "15min", "30": "30min", "60": "1h", "240": "4h",
  "1D": "1day", "D": "1day", "1W": "1week", "W": "1week", "1M": "1month", "M": "1month",
};

const OANDA_GRANULARITY: Record<string, string> = {
  "1": "M1", "5": "M5", "15": "M15", "30": "M30", "60": "H1", "240": "H4",
  "1D": "D", "D": "D", "1W": "W", "W": "W", "1M": "M", "M": "M",
};

const YAHOO_INTERVALS: Record<string, string> = {
  "1": "1m", "5": "5m", "15": "15m", "30": "30m", "60": "60m", "240": "60m",
  "1D": "1d", "D": "1d", "1W": "1wk", "W": "1wk", "1M": "1mo", "M": "1mo",
};

const FOREXCOM_BASE = "https://ciapi.cityindex.com/TradingAPI";
const FOREXCOM_INTERVALS: Record<string, { interval: string; span: number; stepSec: number }> = {
  "1": { interval: "MINUTE", span: 1, stepSec: 60 },
  "5": { interval: "MINUTE", span: 5, stepSec: 300 },
  "15": { interval: "MINUTE", span: 15, stepSec: 900 },
  "30": { interval: "MINUTE", span: 30, stepSec: 1800 },
  "60": { interval: "HOUR", span: 1, stepSec: 3600 },
  "240": { interval: "HOUR", span: 4, stepSec: 14400 },
  "1D": { interval: "DAY", span: 1, stepSec: 86400 },
  D: { interval: "DAY", span: 1, stepSec: 86400 },
  "1W": { interval: "WEEK", span: 1, stepSec: 604800 },
  W: { interval: "WEEK", span: 1, stepSec: 604800 },
  "1M": { interval: "MONTH", span: 1, stepSec: 2592000 },
  M: { interval: "MONTH", span: 1, stepSec: 2592000 },
};

interface Bar {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function finiteBars(bars: Bar[]): Bar[] {
  return bars
    .filter((bar) =>
      [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite),
    )
    .sort((a, b) => a.time - b.time);
}

type ForexComSecrets = { UserName: string; Password: string; AppKey: string };
type ForexComSession = { userName: string; session: string };

const forexMarketIdCache = new Map<string, number>();
let forexSession: ForexComSession | null = null;

function forexComSecrets(): ForexComSecrets | null {
  const UserName = Deno.env.get("FOREXCOM_USERNAME")?.trim() ?? "";
  const Password = Deno.env.get("FOREXCOM_PASSWORD") ?? "";
  const AppKey = Deno.env.get("FOREXCOM_APP_KEY")?.trim() ?? "";
  if (!UserName || !Password || !AppKey) return null;
  return { UserName, Password, AppKey };
}

function parseWcfDate(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value !== "string") return NaN;
  const wcf = /\/Date\((-?\d+)/.exec(value);
  if (wcf) return Number(wcf[1]);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function forexSearchTerms(symbol: string): string[] {
  const s = normalizeSymbol(symbol);
  if (s === "XAUUSD" || s === "GOLD") return ["XAU/USD", "XAUUSD", "Gold"];
  if (s === "XAGUSD" || s === "SILVER") return ["XAG/USD", "XAGUSD", "Silver"];
  if (s === "NAS100" || s === "NAS100USD" || s === "USTEC") return ["NAS100", "US Tech 100", "US100"];
  if (s === "US30" || s === "US30USD") return ["US30", "Wall Street", "DJ30"];
  if (s === "SPX500" || s === "US500" || s === "SPX500USD") return ["US500", "SPX500", "S&P 500"];
  if (/^[A-Z]{6}$/.test(s)) return [`${s.slice(0, 3)}/${s.slice(3)}`, s];
  return [s, symbol];
}

function scoreForexMarket(symbol: string, name: string): number {
  const n = name.toUpperCase();
  const compact = n.replace(/[^A-Z0-9]/g, "");
  const s = normalizeSymbol(symbol);
  if (s === "XAUUSD" || s === "GOLD") {
    if (/SILVER|\bXAG\b/.test(n)) return -1;
    let score = 0;
    if (/\bGOLD\b|\bXAU\b/.test(n) || compact.includes("XAUUSD")) score += 80;
    if (/XAU[/-]?USD/.test(n) || compact === "XAUUSD") score += 40;
    if (/\bCFD\b/.test(n)) score += 10;
    return score || -1;
  }
  let score = 0;
  if (compact === s) score += 100;
  if (compact.includes(s)) score += 40;
  if (/^[A-Z]{6}$/.test(s)) {
    const slash = `${s.slice(0, 3)}/${s.slice(3)}`;
    if (n.includes(slash)) score += 90;
  }
  return score;
}

async function ensureForexSession(force = false): Promise<ForexComSession> {
  const secrets = forexComSecrets();
  if (!secrets) throw new Error("FOREX.com not configured");
  if (!force && forexSession) return forexSession;

  const res = await fetch(`${FOREXCOM_BASE}/session`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      UserName: secrets.UserName,
      Password: secrets.Password,
      AppKey: secrets.AppKey,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FOREX.com session ${res.status}: ${text.slice(0, 180)}`);
  }
  let data: { Session?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("FOREX.com session: invalid JSON");
  }
  if (!data.Session) throw new Error("FOREX.com session: missing token");
  forexSession = { userName: secrets.UserName, session: data.Session };
  return forexSession;
}

function isForexSessionError(status: number, body: string): boolean {
  if (status === 401) return true;
  return /session/i.test(body) && /expir|invalid|unauthor/i.test(body);
}

async function forexRequest(path: string): Promise<unknown> {
  let lastError = "FOREX.com request failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await ensureForexSession(attempt === 1);
    const res = await fetch(`${FOREXCOM_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        Username: session.userName,
        UserName: session.userName,
        Session: session.session,
      },
    });
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("FOREX.com: invalid JSON");
      }
    }
    lastError = `FOREX.com ${res.status}: ${text.slice(0, 180)}`;
    if (attempt === 0 && isForexSessionError(res.status, text)) {
      forexSession = null;
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

async function resolveForexMarketId(symbol: string): Promise<number> {
  const key = normalizeSymbol(symbol);
  const cached = forexMarketIdCache.get(key);
  if (cached) return cached;

  const terms = forexSearchTerms(symbol);
  let bestId: number | null = null;
  let bestScore = 0;

  for (const term of terms) {
    const data = await forexRequest(
      `/market/search?SearchByMarketName=TRUE&Query=${encodeURIComponent(term)}`,
    ) as { Markets?: Array<{ MarketId?: number; Name?: string }> };
    const markets = Array.isArray(data?.Markets) ? data.Markets : [];
    for (const market of markets) {
      const id = Number(market.MarketId);
      if (!Number.isFinite(id) || id <= 0) continue;
      const score = scoreForexMarket(symbol, String(market.Name ?? ""));
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (bestId && bestScore >= 80) break;
  }

  if (!bestId) throw new Error(`FOREX.com market not found: ${symbol}`);
  forexMarketIdCache.set(key, bestId);
  return bestId;
}

async function fetchForexComBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  if (!forexComSecrets()) throw new Error("FOREX.com not configured");

  const mapped = FOREXCOM_INTERVALS[resolution] ?? FOREXCOM_INTERVALS["15"];
  const marketId = await resolveForexMarketId(symbol);
  const spanSec = Math.max(toSec - fromSec, mapped.stepSec);
  const pricebars = Math.min(4000, Math.max(10, Math.ceil(spanSec / mapped.stepSec) + 8));
  const data = await forexRequest(
    `/market/${marketId}/barhistory?interval=${mapped.interval}&span=${mapped.span}` +
      `&pricebars=${pricebars}&priceType=MID`,
  ) as { PriceBars?: Array<{ BarDate?: unknown; Open?: number; High?: number; Low?: number; Close?: number }> };

  const rows = Array.isArray(data?.PriceBars) ? data.PriceBars : [];
  const bars = rows.map((row) => ({
    time: parseWcfDate(row.BarDate),
    open: Number(row.Open),
    high: Number(row.High),
    low: Number(row.Low),
    close: Number(row.Close),
    volume: 0,
  }));
  return finiteBars(bars).filter((bar) => {
    const t = Math.floor(bar.time / 1000);
    return t >= fromSec - mapped.stepSec && t <= toSec + mapped.stepSec;
  });
}

/* ----------------------------- Data sources ----------------------------- */

async function fetchBinanceBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  const interval = BINANCE_INTERVALS[resolution] ?? "15m";
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${toBinanceSymbol(symbol)}` +
    `&interval=${interval}&startTime=${fromSec * 1000}&endTime=${toSec * 1000}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return finiteBars(rows.map((r: unknown[]) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  })));
}

async function fetchTwelveDataBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  const apiKey = Deno.env.get("TWELVEDATA_API_KEY");
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY not configured");

  const interval = TWELVEDATA_INTERVALS[resolution] ?? "15min";
  const start = new Date(fromSec * 1000).toISOString().slice(0, 19).replace("T", " ");
  const end = new Date(toSec * 1000).toISOString().slice(0, 19).replace("T", " ");
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(toTwelveDataSymbol(symbol))}` +
    `&interval=${interval}&start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}` +
    `&timezone=UTC&outputsize=5000&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TwelveData ${res.status}`);
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message ?? "TwelveData error");
  const values = data?.values;
  if (!Array.isArray(values)) return [];
  return finiteBars(values.map((v: Record<string, string>) => ({
    time: new Date(`${v.datetime.replace(" ", "T")}Z`).getTime(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume ?? 0),
  })));
}

async function fetchOandaBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  const token = Deno.env.get("OANDA_API_TOKEN");
  if (!token) throw new Error("OANDA_API_TOKEN not configured");

  const host = Deno.env.get("OANDA_API_HOST") || "https://api-fxpractice.oanda.com";
  const granularity = OANDA_GRANULARITY[resolution] ?? "M15";
  const instrument = toOandaInstrument(symbol);
  const from = new Date(fromSec * 1000).toISOString();
  const to = new Date(toSec * 1000).toISOString();
  const url =
    `${host}/v3/instruments/${encodeURIComponent(instrument)}/candles` +
    `?price=M&granularity=${granularity}&from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}&smooth=false`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Datetime-Format": "RFC3339",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OANDA ${res.status}: ${text.slice(0, 180)}`);
  }
  const data = await res.json();
  const candles = Array.isArray(data?.candles) ? data.candles : [];
  return finiteBars(candles
    .filter((c: { complete?: boolean; mid?: Record<string, string> }) => c?.mid)
    .map((c: { time: string; volume?: number; mid: Record<string, string> }) => ({
      time: new Date(c.time).getTime(),
      open: Number(c.mid.o),
      high: Number(c.mid.h),
      low: Number(c.mid.l),
      close: Number(c.mid.c),
      volume: Number(c.volume ?? 0),
    })));
}

async function fetchYahooBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  const interval = YAHOO_INTERVALS[resolution] ?? "15m";
  const yahooSymbol = toYahooSymbol(symbol);
  // Yahoo rejects some long intraday windows; clamp to a safe lookback.
  const maxLookbackSec =
    interval === "1m" ? 7 * 86400 :
    interval === "5m" || interval === "15m" || interval === "30m" ? 60 * 86400 :
    interval === "60m" ? 730 * 86400 :
    5 * 365 * 86400;
  const period2 = Math.max(toSec, Math.floor(Date.now() / 1000));
  // Prefer requested from, but never exceed Yahoo's intraday lookback limits.
  const period1 = Math.max(0, fromSec, period2 - maxLookbackSec);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps.length || !quote) return [];

  const bars: Bar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    // Yahoo leaves nulls for gaps; Number(null) === 0 and would spike the chart.
    const rawOpen = quote.open?.[i];
    const rawHigh = quote.high?.[i];
    const rawLow = quote.low?.[i];
    const rawClose = quote.close?.[i];
    if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null) continue;
    const open = Number(rawOpen);
    const high = Number(rawHigh);
    const low = Number(rawLow);
    const close = Number(rawClose);
    if (![open, high, low, close].every((v) => Number.isFinite(v) && v > 0)) continue;
    const t = Number(timestamps[i]);
    if (t < fromSec - 120 || t > toSec + 120) continue;
    bars.push({
      time: t * 1000,
      open,
      high,
      low,
      close,
      volume: Number(quote.volume?.[i] ?? 0) || 0,
    });
  }
  return finiteBars(bars);
}

async function fetchLiveBars(
  symbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<Bar[]> {
  const errors: string[] = [];

  if (isCryptoSymbol(symbol)) {
    try {
      const bars = await fetchBinanceBars(symbol, resolution, fromSec, toSec);
      if (bars.length) return bars;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    const yahoo = await fetchYahooBars(symbol, resolution, fromSec, toSec);
    if (yahoo.length) return yahoo;
    throw new Error(errors.join(" | ") || "No crypto bars");
  }

  if (forexComSecrets()) {
    try {
      const bars = await fetchForexComBars(symbol, resolution, fromSec, toSec);
      if (bars.length) return bars;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("chart-datafeed forex.com error:", msg);
      errors.push(msg);
    }
  }

  if (Deno.env.get("OANDA_API_TOKEN")) {
    try {
      const bars = await fetchOandaBars(symbol, resolution, fromSec, toSec);
      if (bars.length) return bars;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (Deno.env.get("TWELVEDATA_API_KEY")) {
    try {
      const bars = await fetchTwelveDataBars(symbol, resolution, fromSec, toSec);
      if (bars.length) return bars;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const yahoo = await fetchYahooBars(symbol, resolution, fromSec, toSec);
    if (yahoo.length) return yahoo;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  throw new Error(errors.join(" | ") || "No live bars available");
}

/* ----------------------------- Handlers ----------------------------- */

function handleConfig(): Response {
  return json({
    supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
    supports_group_request: false,
    supports_marks: false,
    supports_search: true,
    supports_timescale_marks: false,
  });
}

function priceScaleFor(symbol: string, crypto: boolean): number {
  const s = normalizeSymbol(symbol);
  if (crypto) return 100;
  if (s.startsWith("XAU") || s.startsWith("XAG") || s.includes("JPY")) return 1000;
  if (s.startsWith("NAS") || s.startsWith("US30") || s.startsWith("SPX") || s.startsWith("JP225")) {
    return 100;
  }
  return 100000;
}

function handleSymbolInfo(symbol: string): Response {
  const crypto = isCryptoSymbol(symbol);
  return json({
    name: symbol.toUpperCase(),
    ticker: symbol.toUpperCase(),
    description: symbol.toUpperCase(),
    type: crypto ? "crypto" : "forex",
    session: crypto ? "24x7" : "24x5",
    timezone: "Etc/UTC",
    exchange: crypto ? "Binance" : "FX",
    listed_exchange: crypto ? "Binance" : "FX",
    minmov: 1,
    pricescale: priceScaleFor(symbol, crypto),
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
    volume_precision: 2,
    data_status: "streaming",
  });
}

const COMMON_SYMBOLS = [
  { symbol: "EURUSD", description: "Euro / US Dollar", type: "forex" },
  { symbol: "GBPUSD", description: "British Pound / US Dollar", type: "forex" },
  { symbol: "USDJPY", description: "US Dollar / Japanese Yen", type: "forex" },
  { symbol: "AUDUSD", description: "Australian Dollar / US Dollar", type: "forex" },
  { symbol: "USDCAD", description: "US Dollar / Canadian Dollar", type: "forex" },
  { symbol: "XAUUSD", description: "Gold / US Dollar", type: "cfd" },
  { symbol: "BTCUSD", description: "Bitcoin / US Dollar", type: "crypto" },
  { symbol: "ETHUSD", description: "Ethereum / US Dollar", type: "crypto" },
  { symbol: "SOLUSD", description: "Solana / US Dollar", type: "crypto" },
];

function handleSearch(query: string): Response {
  const q = query.toUpperCase();
  const matches = COMMON_SYMBOLS.filter(
    (s) => s.symbol.includes(q) || s.description.toUpperCase().includes(q),
  ).map((s) => ({
    symbol: s.symbol,
    full_name: s.symbol,
    description: s.description,
    exchange: s.type === "crypto" ? "Binance" : "FX",
    ticker: s.symbol,
    type: s.type,
  }));
  return json(matches);
}

async function handleHistory(params: URLSearchParams): Promise<Response> {
  const symbol = params.get("symbol") ?? "";
  const resolution = params.get("resolution") ?? "15";
  const fromSec = Number(params.get("from"));
  const toSec = Number(params.get("to"));
  if (!symbol || !Number.isFinite(fromSec) || !Number.isFinite(toSec)) {
    return json({ s: "error", errmsg: "Missing symbol/from/to" }, 400);
  }

  try {
    const bars = await fetchLiveBars(symbol, resolution, fromSec, toSec);
    if (bars.length === 0) return json({ s: "no_data" });
    return json({
      s: "ok",
      t: bars.map((b) => Math.floor(b.time / 1000)),
      o: bars.map((b) => b.open),
      h: bars.map((b) => b.high),
      l: bars.map((b) => b.low),
      c: bars.map((b) => b.close),
      v: bars.map((b) => b.volume),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("chart-datafeed history error:", msg);
    return json({ s: "error", errmsg: msg }, 200);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  switch (action) {
    case "config":
      return handleConfig();
    case "symbols":
      return handleSymbolInfo(url.searchParams.get("symbol") ?? "");
    case "search":
      return handleSearch(url.searchParams.get("query") ?? "");
    case "history":
      return await handleHistory(url.searchParams);
    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
});
