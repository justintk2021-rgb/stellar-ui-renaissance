import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Candle datafeed for TradingView Advanced Charts.
 *
 * Routes:
 *   GET ?action=config                         → datafeed capabilities
 *   GET ?action=symbols&symbol=BTCUSD          → symbol metadata
 *   GET ?action=search&query=eur               → symbol search
 *   GET ?action=history&symbol=...&resolution=...&from=...&to=... → OHLCV bars
 *
 * Crypto resolves via Binance public API (no key needed).
 * Forex / metals / stocks resolve via Twelve Data when TWELVEDATA_API_KEY is set.
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

function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  if (CRYPTO_QUOTES.some((q) => s.endsWith(q) && s.length > q.length)) return true;
  // BTCUSD / ETHUSD style
  if (s.endsWith("USD") && KNOWN_CRYPTO_BASES.includes(s.slice(0, -3))) return true;
  return false;
}

/** BTCUSD → BTCUSDT for Binance spot. */
function toBinanceSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith("USD") && !s.endsWith("USDT")) return `${s}T`;
  return s;
}

/** EURUSD → EUR/USD for Twelve Data. */
function toTwelveDataSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace("/", "");
  if (/^[A-Z]{6}$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3)}`;
  if (s === "XAUUSD") return "XAU/USD";
  if (s === "XAGUSD") return "XAG/USD";
  return symbol.toUpperCase();
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

interface Bar {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  return rows.map((r: unknown[]) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
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
  return values
    .map((v: Record<string, string>) => ({
      time: new Date(`${v.datetime.replace(" ", "T")}Z`).getTime(),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume ?? 0),
    }))
    .sort((a: Bar, b: Bar) => a.time - b.time);
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
    pricescale: crypto ? 100 : 100000,
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
    const bars = isCryptoSymbol(symbol)
      ? await fetchBinanceBars(symbol, resolution, fromSec, toSec)
      : await fetchTwelveDataBars(symbol, resolution, fromSec, toSec);

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
