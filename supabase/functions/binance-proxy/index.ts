import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Map intervals to CryptoCompare API endpoints and parameters
const intervalConfig: Record<string, { endpoint: string; aggregate: number }> = {
  "1m": { endpoint: "histominute", aggregate: 1 },
  "5m": { endpoint: "histominute", aggregate: 5 },
  "15m": { endpoint: "histominute", aggregate: 15 },
  "1h": { endpoint: "histohour", aggregate: 1 },
  "4h": { endpoint: "histohour", aggregate: 4 },
  "1d": { endpoint: "histoday", aggregate: 1 },
  "1w": { endpoint: "histoday", aggregate: 7 },
};

// Map symbols to CryptoCompare format
const symbolMap: Record<string, { fsym: string; tsym: string }> = {
  BTCUSDT: { fsym: "BTC", tsym: "USDT" },
  ETHUSDT: { fsym: "ETH", tsym: "USDT" },
  BNBUSDT: { fsym: "BNB", tsym: "USDT" },
  SOLUSDT: { fsym: "SOL", tsym: "USDT" },
  XRPUSDT: { fsym: "XRP", tsym: "USDT" },
  ADAUSDT: { fsym: "ADA", tsym: "USDT" },
  DOGEUSDT: { fsym: "DOGE", tsym: "USDT" },
  // Forex and indices - use USD pairs
  EURUSD: { fsym: "EUR", tsym: "USD" },
  GBPUSD: { fsym: "GBP", tsym: "USD" },
  XAUUSD: { fsym: "XAU", tsym: "USD" },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '15m';
    const limit = parseInt(url.searchParams.get('limit') || '500');

    console.log(`Fetching data for ${symbol} at ${interval} interval`);

    const symbolInfo = symbolMap[symbol];
    if (!symbolInfo) {
      console.log(`Unknown symbol: ${symbol}, returning empty data`);
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = intervalConfig[interval] || intervalConfig["15m"];
    
    // CryptoCompare API
    const apiUrl = `https://min-api.cryptocompare.com/data/v2/${config.endpoint}?fsym=${symbolInfo.fsym}&tsym=${symbolInfo.tsym}&limit=${Math.min(limit, 2000)}&aggregate=${config.aggregate}`;
    
    console.log(`Calling CryptoCompare API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CryptoCompare API error:', errorText);
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.Response === 'Error') {
      console.error('CryptoCompare error:', result.Message);
      throw new Error(result.Message);
    }

    const data = result.Data?.Data || [];
    console.log(`Received ${data.length} candles from CryptoCompare`);

    // Convert to Binance-like format for compatibility
    // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
    const formattedData = data.map((candle: { time: number; open: number; high: number; low: number; close: number; volumefrom: number }) => [
      candle.time * 1000, // Open time in ms
      String(candle.open),
      String(candle.high),
      String(candle.low),
      String(candle.close),
      String(candle.volumefrom || 0),
      (candle.time + 60) * 1000, // Close time
      "0", // Quote asset volume
      0, // Number of trades
      "0", // Taker buy base
      "0", // Taker buy quote
      "0" // Ignore
    ]);

    return new Response(JSON.stringify(formattedData), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});